import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearRol,
  crearSuperAdmin,
  crearUsuarioConPin,
  type Escenario,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Sesion,
} from '../helpers/http.js';

interface UsuarioConUso {
  id: string;
  rol: string | null;
  unidad: string | null;
  qr_emitidos: number;
  qr_usados: number;
  max_qr_en_un_dia: number;
  ultimo_qr_at: string | null;
  inactivo: boolean;
  ruidoso: boolean;
}

interface Estadisticas {
  ventana_dias: number;
  umbral_inactivo_dias: number;
  umbral_ruidoso_por_dia: number;
  resumen: {
    usuarios: number;
    inactivos: number;
    ruidosos: number;
    titulares_cerca_del_tope: number;
  };
  usuarios: UsuarioConUso[];
  titulares: {
    id: string;
    unidad: string | null;
    miembros: number;
    tope: number;
    porcentaje: number;
    cerca_del_tope: boolean;
  }[];
  ramas?: { id: string; usuarios: number }[];
}

const DIA = 86_400_000;

/** Un instante de hace `dias` días a las 12:00 UTC (08:00 en La Paz): dentro del mismo día local. */
function haceDias(dias: number, hora = 12): Date {
  const fecha = new Date(Date.now() - dias * DIA);
  fecha.setUTCHours(hora, 0, 0, 0);
  return fecha;
}

describe('estadísticas de uso de los usuarios (ADR 0028 §4)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesionAdminA: Sesion;
  let ramas: {
    titular: UsuarioDePrueba;
    miembroActivo: UsuarioDePrueba;
    miembroInactivo: UsuarioDePrueba;
    guardia: UsuarioDePrueba;
    admin2: UsuarioDePrueba;
    titular2: UsuarioDePrueba;
    miembro2: UsuarioDePrueba;
  };

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    ramas = await armarRamas();
    sesionAdminA = await iniciarSesion(prueba.app, a.administrador.pin);
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  /** Inserta un QR con la fecha de creación que se quiera (la API siempre emite "ahora"). */
  async function qr(
    cuentaId: string,
    emisorId: string,
    creadoAt: Date,
    usado = false,
  ): Promise<void> {
    await prueba.pool.query(
      'INSERT INTO qr_accesos (tenant_id, emitido_por, token_hash, vence_at, usado_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        cuentaId,
        emisorId,
        randomBytes(32).toString('hex'),
        new Date(creadoAt.getTime() + DIA),
        usado ? new Date(creadoAt.getTime() + 60_000) : null,
        creadoAt,
      ],
    );
  }

  async function envejecer(usuarioId: string, dias: number): Promise<void> {
    await prueba.pool.query('UPDATE usuarios SET created_at = ? WHERE id = ?', [
      new Date(Date.now() - dias * DIA),
      usuarioId,
    ]);
  }

  async function armarRamas() {
    const { pool } = prueba;
    const rolGuardia = await crearRol(pool, a.cuenta, 'Guardia', ['organizacion.puerta.ver']);
    const titular = await crearUsuarioConPin(pool, a.cuenta, 'TI01', [a.rolTitularId], {
      superiorId: a.administrador.id,
    });
    await pool.query(
      'INSERT INTO unidades (tenant_id, sitio_id, nombre, titular_id) VALUES (?, ?, ?, ?)',
      [a.cuenta.id, a.sitioId, 'Casa 12', titular.id],
    );
    const miembroActivo = await crearUsuarioConPin(pool, a.cuenta, 'MI01', [a.rolMiembroId], {
      superiorId: titular.id,
    });
    const miembroInactivo = await crearUsuarioConPin(pool, a.cuenta, 'MI02', [a.rolMiembroId], {
      superiorId: titular.id,
    });
    const guardia = await crearUsuarioConPin(pool, a.cuenta, 'GU01', [rolGuardia], {
      superiorId: a.administrador.id,
    });
    const admin2 = await crearUsuarioConPin(pool, a.cuenta, 'AD02', [a.rolAdministradorId]);
    const titular2 = await crearUsuarioConPin(pool, a.cuenta, 'TI02', [a.rolTitularId], {
      superiorId: admin2.id,
    });
    const miembro2 = await crearUsuarioConPin(pool, a.cuenta, 'MI03', [a.rolMiembroId], {
      superiorId: titular2.id,
    });
    return { titular, miembroActivo, miembroInactivo, guardia, admin2, titular2, miembro2 };
  }

  const estadisticas = async (sesion: Sesion): Promise<Estadisticas> =>
    (
      await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/usuarios/estadisticas',
        headers: conUsuario(sesion),
      })
    ).json<Estadisticas>();
  const deUsuario = (e: Estadisticas, id: string) => e.usuarios.find((u) => u.id === id);

  describe('GET /api/v1/usuarios/estadisticas', () => {
    it('trae los umbrales fijos y solo la rama del Administrador, sin él ni la de otro', async () => {
      const e = await estadisticas(sesionAdminA);
      expect(e).toMatchObject({
        ventana_dias: 30,
        umbral_inactivo_dias: 30,
        umbral_ruidoso_por_dia: 10,
      });
      const ids = e.usuarios.map((u) => u.id).sort();
      expect(ids).toEqual(
        [
          a.usuario.id,
          ramas.titular.id,
          ramas.miembroActivo.id,
          ramas.miembroInactivo.id,
          ramas.guardia.id,
        ].sort(),
      );
      for (const ajeno of [
        a.administrador.id,
        ramas.admin2.id,
        ramas.titular2.id,
        ramas.miembro2.id,
      ]) {
        expect(ids).not.toContain(ajeno);
      }
    });

    it('un usuario recién creado sin QR todavía no es inactivo; uno viejo sin QR sí', async () => {
      await envejecer(ramas.miembroInactivo.id, 45);
      const e = await estadisticas(sesionAdminA);
      expect(deUsuario(e, a.usuario.id)).toMatchObject({ inactivo: false, qr_emitidos: 0 });
      expect(deUsuario(e, ramas.miembroInactivo.id)).toMatchObject({
        inactivo: true,
        qr_emitidos: 0,
        ultimo_qr_at: null,
      });
    });

    it('generar un QR en la ventana saca de inactivo, y se cuentan emitidos y usados', async () => {
      await envejecer(ramas.miembroActivo.id, 90);
      await qr(a.cuenta.id, ramas.miembroActivo.id, haceDias(3));
      await qr(a.cuenta.id, ramas.miembroActivo.id, haceDias(2), true);
      const e = await estadisticas(sesionAdminA);
      expect(deUsuario(e, ramas.miembroActivo.id)).toMatchObject({
        inactivo: false,
        ruidoso: false,
        qr_emitidos: 2,
        qr_usados: 1,
        max_qr_en_un_dia: 1,
      });
    });

    it('un QR más viejo que la ventana no cuenta, pero sí figura como último QR', async () => {
      await envejecer(ramas.guardia.id, 90);
      const antiguo = haceDias(45);
      await qr(a.cuenta.id, ramas.guardia.id, antiguo);
      const e = await estadisticas(sesionAdminA);
      const guardia = deUsuario(e, ramas.guardia.id);
      expect(guardia).toMatchObject({ inactivo: true, qr_emitidos: 0, rol: 'Guardia' });
      expect(guardia?.ultimo_qr_at).toBe(antiguo.toISOString());
    });

    it('ruidoso es más de 10 QR en un mismo día: 10 no, 11 sí', async () => {
      for (let i = 0; i < 10; i += 1) await qr(a.cuenta.id, ramas.miembroActivo.id, haceDias(2));
      for (let i = 0; i < 11; i += 1) await qr(a.cuenta.id, ramas.titular.id, haceDias(2));
      const e = await estadisticas(sesionAdminA);
      expect(deUsuario(e, ramas.miembroActivo.id)).toMatchObject({
        ruidoso: false,
        max_qr_en_un_dia: 10,
      });
      expect(deUsuario(e, ramas.titular.id)).toMatchObject({ ruidoso: true, max_qr_en_un_dia: 11 });
    });

    it('el mismo número repartido en varios días no es ruido', async () => {
      for (let dia = 1; dia <= 12; dia += 1)
        await qr(a.cuenta.id, ramas.miembroActivo.id, haceDias(dia));
      const e = await estadisticas(sesionAdminA);
      expect(deUsuario(e, ramas.miembroActivo.id)).toMatchObject({
        ruidoso: false,
        qr_emitidos: 12,
        max_qr_en_un_dia: 1,
      });
    });

    it('el día se corta en la hora de La Paz, no en UTC', async () => {
      // 11 QR entre las 02:00 y las 03:59 UTC son las 22:00–23:59 del día anterior en La Paz...
      for (let i = 0; i < 6; i += 1)
        await qr(a.cuenta.id, ramas.titular.id, haceDias(3, 2 + (i % 2)));
      // ...y 5 más a las 04:00–05:00 UTC ya son del día siguiente en La Paz: no se suman a las anteriores
      for (let i = 0; i < 5; i += 1)
        await qr(a.cuenta.id, ramas.titular.id, haceDias(3, 4 + (i % 2)));
      const e = await estadisticas(sesionAdminA);
      expect(deUsuario(e, ramas.titular.id)).toMatchObject({
        qr_emitidos: 11,
        max_qr_en_un_dia: 6,
        ruidoso: false,
      });
    });

    it('ordena primero a los ruidosos y después a los inactivos, y los cuenta en el resumen', async () => {
      await envejecer(ramas.miembroInactivo.id, 45);
      for (let i = 0; i < 11; i += 1) await qr(a.cuenta.id, ramas.titular.id, haceDias(2));
      await qr(a.cuenta.id, ramas.miembroActivo.id, haceDias(1));
      await qr(a.cuenta.id, a.usuario.id, haceDias(1));
      await qr(a.cuenta.id, ramas.guardia.id, haceDias(1));
      const e = await estadisticas(sesionAdminA);
      expect(e.usuarios[0]?.id).toBe(ramas.titular.id);
      expect(e.usuarios[1]?.id).toBe(ramas.miembroInactivo.id);
      expect(e.resumen).toMatchObject({ usuarios: 5, ruidosos: 1, inactivos: 1 });
    });

    it('los Titulares con su unidad, sus Miembros y cuánto de su tope usan', async () => {
      await prueba.pool.query('UPDATE cuentas SET max_miembros_por_titular = 2 WHERE id = ?', [
        a.cuenta.id,
      ]);
      const e = await estadisticas(sesionAdminA);
      expect(e.titulares).toEqual([
        {
          id: ramas.titular.id,
          etiqueta: expect.any(String) as string,
          unidad: 'Casa 12',
          miembros: 2,
          tope: 2,
          porcentaje: 100,
          cerca_del_tope: true,
        },
      ]);
      expect(e.resumen.titulares_cerca_del_tope).toBe(1);
    });

    it('con el tope por defecto, 2 Miembros de 10 no está cerca', async () => {
      const e = await estadisticas(sesionAdminA);
      expect(e.titulares[0]).toMatchObject({
        miembros: 2,
        tope: 10,
        porcentaje: 20,
        cerca_del_tope: false,
      });
      expect(e.resumen.titulares_cerca_del_tope).toBe(0);
    });

    it('ramas: la actividad de otra rama no se mezcla con la propia', async () => {
      for (let i = 0; i < 11; i += 1) await qr(a.cuenta.id, ramas.titular2.id, haceDias(2));
      const e = await estadisticas(sesionAdminA);
      expect(e.resumen.ruidosos).toBe(0);
      const sesionAdmin2 = await iniciarSesion(prueba.app, ramas.admin2.pin);
      const e2 = await estadisticas(sesionAdmin2);
      expect(e2.usuarios.map((u) => u.id).sort()).toEqual(
        [ramas.titular2.id, ramas.miembro2.id].sort(),
      );
      expect(deUsuario(e2, ramas.titular2.id)).toMatchObject({ ruidoso: true });
    });

    it('aislamiento: nada de otra cuenta, ni sus usuarios ni sus QR', async () => {
      for (let i = 0; i < 20; i += 1) await qr(b.cuenta.id, b.usuario.id, haceDias(2));
      const e = await estadisticas(sesionAdminA);
      expect(e.usuarios.map((u) => u.id)).not.toContain(b.usuario.id);
      expect(e.resumen.ruidosos).toBe(0);
      const sesionAdminB = await iniciarSesion(prueba.app, b.administrador.pin);
      const eB = await estadisticas(sesionAdminB);
      expect(eB.usuarios.map((u) => u.id)).toEqual([b.usuario.id]);
      expect(deUsuario(eB, b.usuario.id)).toMatchObject({ qr_emitidos: 20, ruidoso: true });
    });

    it('solo el Administrador la ve: un Titular o un Miembro reciben 403', async () => {
      for (const pin of [ramas.titular.pin, a.usuario.pin]) {
        const sesion = await iniciarSesion(prueba.app, pin);
        const respuesta = await prueba.app.inject({
          method: 'GET',
          url: '/api/v1/usuarios/estadisticas',
          headers: conUsuario(sesion),
        });
        expect(respuesta.statusCode).toBe(403);
      }
    });

    it('exige sesión', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/usuarios/estadisticas',
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/plataforma/cuentas/:id/estadisticas-de-usuarios', () => {
    let headers: { authorization: string };

    beforeEach(async () => {
      const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
      headers = conUsuario(
        await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
      );
    });

    const deCuenta = (cuentaId: string, cabeceras = headers) =>
      prueba.app.inject({
        method: 'GET',
        url: `/api/v1/plataforma/cuentas/${cuentaId}/estadisticas-de-usuarios`,
        headers: cabeceras,
      });

    it('AGROCOM ve a todos los usuarios de la cuenta y cuántos cuelgan de cada Administrador', async () => {
      for (let i = 0; i < 11; i += 1) await qr(a.cuenta.id, ramas.titular2.id, haceDias(2));
      const respuesta = await deCuenta(a.cuenta.id);
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      const e = respuesta.json<Estadisticas>();
      // Los dos Administradores no se evalúan; los demás sí, de ambas ramas
      expect(e.usuarios.map((u) => u.id)).not.toContain(a.administrador.id);
      expect(e.usuarios.map((u) => u.id)).toContain(ramas.miembro2.id);
      expect(e.resumen.usuarios).toBe(7);
      expect(deUsuario(e, ramas.titular2.id)).toMatchObject({ ruidoso: true });
      // Rama de A: US01, titular, 2 miembros del titular y guardia = 5; rama de AD02: titular2 y miembro2 = 2
      const porId = new Map((e.ramas ?? []).map((r) => [r.id, r.usuarios]));
      expect(porId.get(a.administrador.id)).toBe(5);
      expect(porId.get(ramas.admin2.id)).toBe(2);
    });

    it('aislamiento: pedir una cuenta no trae usuarios ni QR de otra', async () => {
      for (let i = 0; i < 20; i += 1) await qr(b.cuenta.id, b.usuario.id, haceDias(2));
      const e = (await deCuenta(a.cuenta.id)).json<Estadisticas>();
      expect(e.usuarios.map((u) => u.id)).not.toContain(b.usuario.id);
      expect(e.resumen.ruidosos).toBe(0);
      const eB = (await deCuenta(b.cuenta.id)).json<Estadisticas>();
      expect(eB.usuarios.map((u) => u.id)).toEqual([b.usuario.id]);
      expect(eB.ramas).toEqual([
        { id: b.administrador.id, etiqueta: expect.any(String) as string, usuarios: 1 },
      ]);
    });

    it('una cuenta inexistente es 404', async () => {
      expect((await deCuenta('99999999')).statusCode).toBe(404);
    });

    it('solo AGROCOM: el Administrador de la cuenta recibe 401', async () => {
      expect((await deCuenta(a.cuenta.id, conUsuario(sesionAdminA))).statusCode).toBe(401);
    });
  });
});
