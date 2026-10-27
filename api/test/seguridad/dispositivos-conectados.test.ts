import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearQr,
  crearSuperAdmin,
  crearUsuarioConPin,
  type Escenario,
  type SuperAdminDePrueba,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesionDePlataforma,
  type Problema,
  type Sesion,
} from '../helpers/http.js';
import { fechaIsoUtc } from '../helpers/esperados.js';

const RUTA = '/api/v1/sesiones';
const PLATAFORMA = '/api/v1/plataforma';

interface SesionListada {
  id: string;
  plataforma: string | null;
  dispositivo: string | null;
  ip: string | null;
  iniciada_at: string;
  ultima_actividad_at: string;
  expira_at: string;
  actual: boolean;
}
interface Lista {
  datos: SesionListada[];
}

function elemento<T>(lista: readonly T[], indice: number): T {
  const valor = lista[indice];
  if (valor === undefined) throw new Error(`falta el elemento ${indice}`);
  return valor;
}

const instalacion = (n: number): string => `instalacion-aleatoria-${String(n).padStart(4, '0')}`;

describe('dispositivos conectados: sesiones por instalación y plataforma (ADR 0030 §4.1)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;

  beforeEach(async () => {
    prueba = await crearAppDePrueba(undefined, {
      SESIONES_MAX_POR_USUARIO: '3',
      SESIONES_MAX_POR_INSTALACION: '2',
    });
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  async function entrar(
    pin: string,
    origen: { n?: number; plataforma?: string; dispositivo?: string; ip?: string } = {},
  ): Promise<Sesion> {
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: RUTA,
      payload: {
        pin,
        ...(origen.n === undefined ? {} : { instalacion_id: instalacion(origen.n) }),
        ...(origen.plataforma === undefined ? {} : { plataforma: origen.plataforma }),
        ...(origen.dispositivo === undefined ? {} : { dispositivo: origen.dispositivo }),
      },
      ...(origen.ip === undefined ? {} : { remoteAddress: origen.ip }),
    });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<Sesion>();
  }

  const listar = async (sesion: Sesion): Promise<SesionListada[]> => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: RUTA,
      headers: conUsuario(sesion),
    });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<Lista>().datos;
  };

  const sesionDe = async (sesion: Sesion): Promise<string> => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: `${RUTA}/actual`,
      headers: conUsuario(sesion),
    });
    return respuesta.statusCode === 200 ? 'viva' : 'muerta';
  };

  const refrescar = (sesion: Sesion) =>
    prueba.app.inject({
      method: 'POST',
      url: `${RUTA}/refresco`,
      payload: { refresco: sesion.refresco },
    });

  const filaDeSesiones = async (usuarioId: string): Promise<RowDataPacket[]> => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT * FROM sesiones WHERE usuario_id = ? ORDER BY id',
      [usuarioId],
    );
    return filas;
  };

  describe('registro de la sesión', () => {
    it('guarda instalación, plataforma, nombre del dispositivo y última actividad', async () => {
      await entrar(a.usuario.pin, { n: 1, plataforma: 'android', dispositivo: 'Pixel 8' });
      const [fila] = await filaDeSesiones(a.usuario.id);
      expect(fila).toMatchObject({
        instalacion_id: instalacion(1),
        plataforma: 'android',
        nombre_dispositivo: 'Pixel 8',
      });
      expect(fila?.ultima_actividad_at).toBeInstanceOf(Date);
    });

    it('un cliente anterior, sin nada de eso, sigue entrando', async () => {
      await entrar(a.usuario.pin);
      const [fila] = await filaDeSesiones(a.usuario.id);
      expect(fila).toMatchObject({ instalacion_id: null, plataforma: null });
    });

    it.each([
      [{ plataforma: 'windows' }],
      [{ instalacion_id: 'corto' }],
      [{ instalacion_id: 'con espacios y simbolos raros!!' }],
      [{ dispositivo: 'x'.repeat(61) }],
      [{ dispositivo: '' }],
      [{ imei: '123456789012345' }],
    ])('rechaza un origen inválido o intrusivo: %j', async (extra) => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: RUTA,
        payload: { pin: a.usuario.pin, ...extra },
      });
      expect(respuesta.statusCode).toBe(400);
    });

    it('la lista no expone el refresh ni el identificador de instalación', async () => {
      const sesion = await entrar(a.usuario.pin, {
        n: 1,
        plataforma: 'ios',
        dispositivo: 'iPhone',
      });
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: RUTA,
        headers: conUsuario(sesion),
      });
      expect(respuesta.body).not.toContain(instalacion(1));
      expect(respuesta.body).not.toContain(sesion.refresco);
      expect(respuesta.body).not.toContain('refresh');
    });
  });

  describe('listar mis sesiones', () => {
    it('lista solo las mías, con la actual marcada y el contrato exacto', async () => {
      const telefono = await entrar(a.usuario.pin, {
        n: 1,
        plataforma: 'android',
        dispositivo: 'Pixel 8',
      });
      const navegador = await entrar(a.usuario.pin, {
        n: 2,
        plataforma: 'web',
        dispositivo: 'Firefox',
      });
      await entrar(a.administrador.pin, { n: 3, plataforma: 'ios' });

      const datos = await listar(navegador);
      expect(datos).toHaveLength(2);
      expect(datos.filter((s) => s.actual)).toHaveLength(1);
      expect(datos.find((s) => s.actual)).toEqual({
        id: expect.stringMatching(/^\d+$/) as string,
        plataforma: 'web',
        dispositivo: 'Firefox',
        ip: expect.any(String) as string,
        iniciada_at: fechaIsoUtc(),
        ultima_actividad_at: fechaIsoUtc(),
        expira_at: fechaIsoUtc(),
        actual: true,
      });
      expect(datos.find((s) => !s.actual)?.plataforma).toBe('android');
      expect(await sesionDe(telefono)).toBe('viva');
    });

    it('no lista las cerradas ni las vencidas', async () => {
      const uno = await entrar(a.usuario.pin, { n: 1 });
      const dos = await entrar(a.usuario.pin, { n: 2 });
      await prueba.pool.query(
        'UPDATE sesiones SET expira_at = NOW(3) - INTERVAL 1 DAY WHERE usuario_id = ? AND instalacion_id = ?',
        [a.usuario.id, instalacion(1)],
      );
      expect(await listar(dos)).toHaveLength(1);
      expect(uno.acceso).not.toBe(dos.acceso);
    });

    it('exige autenticación', async () => {
      const respuesta = await prueba.app.inject({ method: 'GET', url: RUTA });
      expect(respuesta.statusCode).toBe(401);
    });

    it('registra la última actividad en la primera petición y no la reescribe antes de 5 minutos', async () => {
      const sesion = await entrar(a.usuario.pin, { n: 1 });
      await prueba.pool.query(
        'UPDATE sesiones SET ultima_actividad_at = NULL WHERE usuario_id = ?',
        [a.usuario.id],
      );
      await listar(sesion);
      const [primera] = await filaDeSesiones(a.usuario.id);
      expect(primera?.ultima_actividad_at).toBeInstanceOf(Date);
      await listar(sesion);
      const [segunda] = await filaDeSesiones(a.usuario.id);
      expect(segunda?.ultima_actividad_at).toEqual(primera?.ultima_actividad_at);
    });
  });

  describe('topes de sesiones simultáneas', () => {
    it('volver a entrar desde la misma instalación reemplaza la sesión anterior', async () => {
      const vieja = await entrar(a.usuario.pin, { n: 1 });
      const nueva = await entrar(a.usuario.pin, { n: 1 });
      expect(await sesionDe(vieja)).toBe('muerta');
      expect(await sesionDe(nueva)).toBe('viva');
      expect((await refrescar(vieja)).statusCode).toBe(401);
      const filas = await filaDeSesiones(a.usuario.id);
      expect(filas.filter((f) => f.revocada_at === null)).toHaveLength(1);
      expect(filas[0]?.motivo_cierre).toBe('misma_instalacion');
    });

    it('con el tope por usuario cerrado cae la más antigua y entrar nunca se rechaza', async () => {
      const s = [];
      for (let n = 1; n <= 4; n += 1) s.push(await entrar(a.usuario.pin, { n }));
      expect(await sesionDe(elemento(s, 0))).toBe('muerta');
      for (const viva of s.slice(1)) expect(await sesionDe(viva)).toBe('viva');
      const filas = await filaDeSesiones(a.usuario.id);
      expect(filas[0]).toMatchObject({ motivo_cierre: 'limite_usuario' });
      expect(String(filas[0]?.revocada_por)).toBe(a.usuario.id);
    });

    it('con el tope por instalación, varios usuarios en un aparato desplazan al más antiguo', async () => {
      const otro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'US02', [a.rolMiembroId], {
        superiorId: a.administrador.id,
      });
      const tercero = await crearUsuarioConPin(prueba.pool, a.cuenta, 'US03', [a.rolMiembroId], {
        superiorId: a.administrador.id,
      });
      const uno = await entrar(a.usuario.pin, { n: 9 });
      const dos = await entrar(otro.pin, { n: 9 });
      const tres = await entrar(tercero.pin, { n: 9 });
      expect(await sesionDe(uno)).toBe('muerta');
      expect(await sesionDe(dos)).toBe('viva');
      expect(await sesionDe(tres)).toBe('viva');
      const [fila] = await filaDeSesiones(a.usuario.id);
      expect(fila?.motivo_cierre).toBe('limite_instalacion');
    });

    it('ingresos simultáneos del mismo usuario respetan el tope (las filas se bloquean)', async () => {
      const resultados = await Promise.all(
        [1, 2, 3, 4, 5, 6].map((n) => entrar(a.usuario.pin, { n })),
      );
      expect(resultados).toHaveLength(6);
      const filas = await filaDeSesiones(a.usuario.id);
      expect(filas.filter((f) => f.revocada_at === null).length).toBeLessThanOrEqual(3);
    });

    it('los cierres por tope quedan en la bitácora con origen api', async () => {
      for (let n = 1; n <= 4; n += 1) await entrar(a.usuario.pin, { n });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT * FROM bitacoras WHERE tabla = 'sesiones' AND accion = 'actualizado'",
      );
      expect(filas).toHaveLength(1);
      // El autor es quien ingresó (PIN ya verificado), no un cierre sin dueño.
      expect(filas[0]).toMatchObject({ origen: 'api', tenant_id: a.cuenta.id });
      expect(String(filas[0]?.usuario_id)).toBe(a.usuario.id);
      expect(JSON.stringify(filas[0]?.antes)).not.toContain('refresh');
      expect(JSON.stringify(filas[0]?.despues)).not.toContain('refresh');
    });

    it('ingresos simultáneos de usuarios distintos desde la misma instalación no dan 5xx (deadlock de rango)', async () => {
      const otros = await Promise.all(
        ['US02', 'US03', 'US04'].map((sufijo) =>
          crearUsuarioConPin(prueba.pool, a.cuenta, sufijo, [a.rolMiembroId], {
            superiorId: a.administrador.id,
          }),
        ),
      );
      const pines = [a.usuario.pin, ...otros.map((u) => u.pin)];
      // Dos rondas cruzadas para que los topes (por usuario y por instalación) se pisen.
      const respuestas = await Promise.all(
        [...pines, ...pines].map((pin) =>
          prueba.app.inject({
            method: 'POST',
            url: RUTA,
            payload: { pin, instalacion_id: instalacion(7) },
          }),
        ),
      );
      expect(respuestas.map((r) => r.statusCode)).toEqual(respuestas.map(() => 200));
      const [vivas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS n FROM sesiones WHERE instalacion_id = ? AND revocada_at IS NULL',
        [instalacion(7)],
      );
      expect(Number(vivas[0]?.n)).toBeLessThanOrEqual(2);
    });

    it('cerrar las demás sesiones de un usuario mientras otro ingresa desde la misma instalación no da 5xx', async () => {
      const otro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'US02', [a.rolMiembroId], {
        superiorId: a.administrador.id,
      });
      const mia = await entrar(a.usuario.pin, { n: 3 });
      await entrar(a.usuario.pin, { n: 4 });
      const respuestas = await Promise.all([
        ...[1, 2, 3, 4].map(() =>
          prueba.app.inject({
            method: 'DELETE',
            url: `${RUTA}/otras`,
            headers: conUsuario(mia),
          }),
        ),
        ...[1, 2, 3, 4].map(() =>
          prueba.app.inject({
            method: 'POST',
            url: RUTA,
            payload: { pin: otro.pin, instalacion_id: instalacion(3) },
          }),
        ),
      ]);
      for (const r of respuestas) expect(r.statusCode, r.body).toBeLessThan(500);
    });

    it('si suspenden al usuario justo entre la lectura previa y la transacción, no nace la sesión', async () => {
      const conexion = await prueba.pool.getConnection();
      try {
        // Esta conexión retiene el bloqueo de la fila: la transacción del ingreso espera acá, con la
        // lectura previa (sin bloqueo) ya hecha y viendo al usuario activo.
        await conexion.beginTransaction();
        await conexion.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [a.usuario.id]);
        const ingreso = prueba.app.inject({
          method: 'POST',
          url: RUTA,
          payload: { pin: a.usuario.pin, instalacion_id: instalacion(1) },
        });
        await new Promise((resolver) => setTimeout(resolver, 1500));
        await conexion.query(
          "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
          [a.usuario.id],
        );
        await conexion.commit();
        const respuesta = await ingreso;
        expect(respuesta.statusCode, respuesta.body).toBe(403);
        expect(respuesta.json<Problema>()).toMatchObject({ code: 'sesion.usuario_suspendido' });
      } finally {
        conexion.release();
      }
      expect(await filaDeSesiones(a.usuario.id)).toHaveLength(0);
    });

    it('instalacion_id e ip no se copian a la bitácora', async () => {
      await entrar(a.usuario.pin, { n: 1, ip: '10.9.8.7' });
      await entrar(a.usuario.pin, { n: 1, ip: '10.9.8.7' });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT * FROM bitacoras WHERE tabla = 'sesiones'",
      );
      expect(filas.length).toBeGreaterThan(0);
      const texto = JSON.stringify(filas);
      expect(texto).not.toContain(instalacion(1));
      expect(texto).not.toContain('10.9.8.7');
    });

    it('el tope de una cuenta no cierra sesiones de otra aunque usen la misma instalación', async () => {
      const deA = await entrar(a.usuario.pin, { n: 5 });
      await entrar(b.usuario.pin, { n: 5 });
      await entrar(b.administrador.pin, { n: 5 });
      await entrar(b.usuario.pin, { n: 5 });
      expect(await sesionDe(deA)).toBe('viva');
    });

    it('abrir muchas sesiones no multiplica el cupo de peticiones: el limitador cuenta por usuario', async () => {
      await prueba.cerrar();
      prueba = await crearAppDePrueba(undefined, {
        SESIONES_MAX_POR_USUARIO: '10',
        LIMITE_LECTURA_POR_MINUTO: '5',
      });
      const sesiones: Sesion[] = [];
      for (let n = 1; n <= 5; n += 1) sesiones.push(await entrar(a.usuario.pin, { n }));
      let rechazadas = 0;
      for (let i = 0; i < 10; i += 1) {
        const respuesta = await prueba.app.inject({
          method: 'GET',
          url: RUTA,
          headers: conUsuario(elemento(sesiones, i % sesiones.length)),
        });
        if (respuesta.statusCode === 429) rechazadas += 1;
      }
      expect(rechazadas).toBeGreaterThanOrEqual(5);
    });
  });

  describe('cerrar una sesión propia', () => {
    it('cierra otra sesión mía: su acceso y su refresh dejan de valer de inmediato', async () => {
      const telefono = await entrar(a.usuario.pin, { n: 1 });
      const navegador = await entrar(a.usuario.pin, { n: 2 });
      const idTelefono = (await listar(navegador)).find((s) => !s.actual)?.id;

      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/${idTelefono}`,
        headers: conUsuario(navegador),
      });
      expect(respuesta.statusCode).toBe(204);
      expect(await sesionDe(telefono)).toBe('muerta');
      expect((await refrescar(telefono)).statusCode).toBe(401);
      expect(await sesionDe(navegador)).toBe('viva');
      const [fila] = await filaDeSesiones(a.usuario.id);
      expect(fila).toMatchObject({ motivo_cierre: 'propia' });
      expect(fila?.revocada_at).toBeInstanceOf(Date);
    });

    it('cerrar la actual equivale a salir', async () => {
      const sesion = await entrar(a.usuario.pin, { n: 1 });
      const id = (await listar(sesion))[0]?.id;
      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/${id}`,
        headers: conUsuario(sesion),
      });
      expect(respuesta.statusCode).toBe(204);
      expect(await sesionDe(sesion)).toBe('muerta');
      expect((await filaDeSesiones(a.usuario.id))[0]?.motivo_cierre).toBe('salida');
    });

    it('una sesión de otro usuario de la misma cuenta es 404 y sigue viva', async () => {
      const mia = await entrar(a.usuario.pin, { n: 1 });
      const ajena = await entrar(a.administrador.pin, { n: 2 });
      const idAjena = (await listar(ajena))[0]?.id;
      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/${idAjena}`,
        headers: conUsuario(mia),
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('sesion.no_encontrada');
      expect(await sesionDe(ajena)).toBe('viva');
    });

    it('aislamiento: la sesión de la cuenta B es 404 para la cuenta A', async () => {
      const deB = await entrar(b.usuario.pin, { n: 1 });
      const idDeB = (await listar(deB))[0]?.id;
      const deA = await entrar(a.administrador.pin, { n: 2 });
      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/${idDeB}`,
        headers: conUsuario(deA),
      });
      expect(respuesta.statusCode).toBe(404);
      expect(await sesionDe(deB)).toBe('viva');
    });

    it('una sesión ya cerrada es 404; un id mal formado, 400', async () => {
      const uno = await entrar(a.usuario.pin, { n: 1 });
      const dos = await entrar(a.usuario.pin, { n: 2 });
      const id = (await listar(dos)).find((s) => !s.actual)?.id;
      const cerrar = () =>
        prueba.app.inject({ method: 'DELETE', url: `${RUTA}/${id}`, headers: conUsuario(dos) });
      expect((await cerrar()).statusCode).toBe(204);
      expect((await cerrar()).statusCode).toBe(404);
      expect(uno.acceso).toBeTruthy();
      const malo = await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/abc`,
        headers: conUsuario(dos),
      });
      expect(malo.statusCode).toBe(400);
    });

    it('cierra todas las demás y conserva la actual; devuelve cuántas cerró', async () => {
      const uno = await entrar(a.usuario.pin, { n: 1 });
      const dos = await entrar(a.usuario.pin, { n: 2 });
      const tres = await entrar(a.usuario.pin, { n: 3 });
      const otroUsuario = await entrar(a.administrador.pin, { n: 4 });
      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/otras`,
        headers: conUsuario(tres),
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toEqual({ cerradas: 2 });
      expect(await sesionDe(uno)).toBe('muerta');
      expect(await sesionDe(dos)).toBe('muerta');
      expect((await refrescar(uno)).statusCode).toBe(401);
      expect(await sesionDe(tres)).toBe('viva');
      expect(await sesionDe(otroUsuario)).toBe('viva');
    });

    it('las sesiones que cierro yo quedan en la bitácora', async () => {
      await entrar(a.usuario.pin, { n: 1 });
      const actual = await entrar(a.usuario.pin, { n: 2 });
      await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/otras`,
        headers: conUsuario(actual),
      });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT * FROM bitacoras WHERE tabla = 'sesiones'",
      );
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({ origen: 'api', usuario_id: a.usuario.id });
    });
  });

  describe('un superior ve y cierra las sesiones de su rama (ADR 0028 §4, ADR 0033)', () => {
    let titular: UsuarioDePrueba;
    let miembro: UsuarioDePrueba;
    let ajeno: UsuarioDePrueba;

    beforeEach(async () => {
      titular = await crearUsuarioConPin(prueba.pool, a.cuenta, 'TI01', [a.rolTitularId], {
        superiorId: a.administrador.id,
      });
      miembro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'MI01', [a.rolMiembroId], {
        superiorId: titular.id,
      });
      ajeno = await crearUsuarioConPin(prueba.pool, a.cuenta, 'TI02', [a.rolTitularId], {
        superiorId: a.administrador.id,
      });
    });

    const delUsuario = (
      actor: Sesion,
      usuarioId: string,
      sufijo = '',
      metodo: 'GET' | 'DELETE' = 'GET',
    ) =>
      prueba.app.inject({
        method: metodo,
        url: `/api/v1/usuarios/${usuarioId}/sesiones${sufijo}`,
        headers: conUsuario(actor),
      });

    it('el Titular ve las sesiones de su Miembro', async () => {
      await entrar(miembro.pin, { n: 1, plataforma: 'android', dispositivo: 'Moto' });
      const actor = await entrar(titular.pin, { n: 2 });
      const respuesta = await delUsuario(actor, miembro.id);
      expect(respuesta.statusCode).toBe(200);
      const datos = respuesta.json<Lista>().datos;
      expect(datos).toHaveLength(1);
      expect(datos[0]).toMatchObject({ plataforma: 'android', dispositivo: 'Moto', actual: false });
    });

    it('el Titular cierra una sesión de su Miembro: queda motivo, autor y bitácora', async () => {
      const sesionMiembro = await entrar(miembro.pin, { n: 1 });
      const actor = await entrar(titular.pin, { n: 2 });
      const id = (await delUsuario(actor, miembro.id)).json<Lista>().datos[0]?.id;
      const respuesta = await delUsuario(actor, miembro.id, `/${id}`, 'DELETE');
      expect(respuesta.statusCode).toBe(204);
      expect(await sesionDe(sesionMiembro)).toBe('muerta');
      expect((await refrescar(sesionMiembro)).statusCode).toBe(401);
      expect(await sesionDe(actor)).toBe('viva');
      const [fila] = await filaDeSesiones(miembro.id);
      expect(fila).toMatchObject({ motivo_cierre: 'superior' });
      expect(String(fila?.revocada_por)).toBe(titular.id);
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT * FROM bitacoras WHERE tabla = 'sesiones' AND registro_id = ?",
        [id],
      );
      expect(bitacora).toHaveLength(1);
      expect(bitacora[0]).toMatchObject({ origen: 'api', usuario_id: titular.id });
    });

    it('cerrar todas las del Miembro las cierra y anula sus QR vigentes', async () => {
      const uno = await entrar(miembro.pin, { n: 1 });
      const dos = await entrar(miembro.pin, { n: 2 });
      const qr = await crearQr(prueba.pool, a.cuenta, miembro.id, [a.puertaPrincipal.id]);
      const actor = await entrar(titular.pin, { n: 3 });
      const respuesta = await delUsuario(actor, miembro.id, '', 'DELETE');
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toEqual({ cerradas: 2 });
      expect(await sesionDe(uno)).toBe('muerta');
      expect(await sesionDe(dos)).toBe('muerta');
      const [qrs] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT anulado_at FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      expect(qrs[0]?.anulado_at).toBeInstanceOf(Date);
    });

    it('cerrar UNA sesión no anula los QR del Miembro', async () => {
      await entrar(miembro.pin, { n: 1 });
      const qr = await crearQr(prueba.pool, a.cuenta, miembro.id, [a.puertaPrincipal.id]);
      const actor = await entrar(titular.pin, { n: 3 });
      const id = (await delUsuario(actor, miembro.id)).json<Lista>().datos[0]?.id;
      await delUsuario(actor, miembro.id, `/${id}`, 'DELETE');
      const [qrs] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT anulado_at FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      expect(qrs[0]?.anulado_at).toBeNull();
    });

    it('el Titular no ve ni cierra las de un par, de su superior ni las propias: 404', async () => {
      await entrar(ajeno.pin, { n: 1 });
      const delAdmin = await entrar(a.administrador.pin, { n: 2 });
      const actor = await entrar(titular.pin, { n: 3 });
      for (const objetivo of [ajeno.id, a.administrador.id, titular.id]) {
        const lista = await delUsuario(actor, objetivo);
        expect(lista.statusCode).toBe(404);
        expect(lista.json<Problema>().code).toBe('usuario.no_encontrado');
        expect((await delUsuario(actor, objetivo, '', 'DELETE')).statusCode).toBe(404);
      }
      expect(await sesionDe(delAdmin)).toBe('viva');
    });

    it('una sesión de otro usuario de la rama, usada con el id de este, es 404', async () => {
      const otroMiembro = await crearUsuarioConPin(
        prueba.pool,
        a.cuenta,
        'MI02',
        [a.rolMiembroId],
        {
          superiorId: titular.id,
        },
      );
      const sesionOtro = await entrar(otroMiembro.pin, { n: 1 });
      await entrar(miembro.pin, { n: 2 });
      const actor = await entrar(titular.pin, { n: 3 });
      const idOtro = (await listar(sesionOtro))[0]?.id;
      const respuesta = await delUsuario(actor, miembro.id, `/${idOtro}`, 'DELETE');
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('sesion.no_encontrada');
      expect(await sesionDe(sesionOtro)).toBe('viva');
    });

    it('el Administrador ve y cierra las de cualquiera de su cuenta', async () => {
      await entrar(miembro.pin, { n: 1 });
      const actor = await entrar(a.administrador.pin, { n: 2 });
      expect((await delUsuario(actor, miembro.id)).json<Lista>().datos).toHaveLength(1);
      expect((await delUsuario(actor, miembro.id, '', 'DELETE')).json()).toEqual({ cerradas: 1 });
    });

    it('sin el permiso, 403: el Miembro no ve ni cierra las de nadie', async () => {
      const actor = await entrar(a.usuario.pin, { n: 1 });
      const lista = await delUsuario(actor, miembro.id);
      expect(lista.statusCode).toBe(403);
      expect((await delUsuario(actor, miembro.id, '', 'DELETE')).statusCode).toBe(403);
    });

    it('aislamiento: el Administrador de A pidiendo un usuario de B recibe 404', async () => {
      await entrar(b.usuario.pin, { n: 1 });
      const actor = await entrar(a.administrador.pin, { n: 2 });
      expect((await delUsuario(actor, b.usuario.id)).statusCode).toBe(404);
      expect((await delUsuario(actor, b.usuario.id, '', 'DELETE')).statusCode).toBe(404);
      expect((await filaDeSesiones(b.usuario.id)).every((f) => f.revocada_at === null)).toBe(true);
    });
  });

  describe('AGROCOM ve y cierra las de cualquier cuenta (ADR 0033)', () => {
    let lucia: SuperAdminDePrueba;
    let headers: { authorization: string };

    beforeEach(async () => {
      lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
      headers = conUsuario(
        await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
      );
    });

    const ruta = (cuenta: string, usuario: string, sufijo = ''): string =>
      `${PLATAFORMA}/cuentas/${cuenta}/usuarios/${usuario}/sesiones${sufijo}`;

    it('lista, cierra una y cierra todas (anulando sus QR), con motivo plataforma y bitácora', async () => {
      const uno = await entrar(a.usuario.pin, {
        n: 1,
        plataforma: 'ios',
        dispositivo: 'iPhone 15',
      });
      const dos = await entrar(a.usuario.pin, { n: 2 });
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);

      const lista = await prueba.app.inject({
        method: 'GET',
        url: ruta(a.cuenta.id, a.usuario.id),
        headers,
      });
      expect(lista.statusCode, lista.body).toBe(200);
      const datos = lista.json<Lista>().datos;
      expect(datos).toHaveLength(2);
      expect(datos.every((s) => !s.actual)).toBe(true);

      const una = await prueba.app.inject({
        method: 'DELETE',
        url: ruta(a.cuenta.id, a.usuario.id, `/${datos[0]?.id}`),
        headers,
      });
      expect(una.statusCode).toBe(204);
      const todas = await prueba.app.inject({
        method: 'DELETE',
        url: ruta(a.cuenta.id, a.usuario.id),
        headers,
      });
      expect(todas.json()).toEqual({ cerradas: 1 });
      expect(await sesionDe(uno)).toBe('muerta');
      expect(await sesionDe(dos)).toBe('muerta');

      const filas = await filaDeSesiones(a.usuario.id);
      expect(filas.every((f) => f.motivo_cierre === 'plataforma')).toBe(true);
      expect(filas.every((f) => String(f.revocada_por) === lucia.id)).toBe(true);
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT * FROM bitacoras WHERE tabla = 'sesiones'",
      );
      expect(bitacora).toHaveLength(2);
      expect(bitacora.every((f) => String(f.usuario_id) === lucia.id && f.origen === 'api')).toBe(
        true,
      );
      const [qrs] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT anulado_at FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      expect(qrs[0]?.anulado_at).toBeInstanceOf(Date);
    });

    it('aislamiento: un usuario de B con el id de la cuenta A es 404 y no se toca', async () => {
      const deB = await entrar(b.usuario.pin, { n: 1 });
      for (const metodo of ['GET', 'DELETE'] as const) {
        const respuesta = await prueba.app.inject({
          method: metodo,
          url: ruta(a.cuenta.id, b.usuario.id),
          headers,
        });
        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
      }
      expect(await sesionDe(deB)).toBe('viva');
    });

    it('una cuenta inexistente es 404', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: ruta('999999', a.usuario.id),
        headers,
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('cuenta.no_encontrada');
    });

    it('un usuario de cuenta no accede a estas rutas, y un super admin sin el permiso recibe 403', async () => {
      const usuario = await entrar(a.administrador.pin, { n: 1 });
      const deCuenta = await prueba.app.inject({
        method: 'GET',
        url: ruta(a.cuenta.id, a.usuario.id),
        headers: conUsuario(usuario),
      });
      expect([401, 403]).toContain(deCuenta.statusCode);

      await prueba.pool.query(
        `DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id
         WHERE p.codigo IN ('seguridad.sesion_cuenta.ver', 'seguridad.sesion_cuenta.cerrar')`,
      );
      const sin = await prueba.app.inject({
        method: 'GET',
        url: ruta(a.cuenta.id, a.usuario.id),
        headers,
      });
      expect(sin.statusCode).toBe(403);
      const sinCerrar = await prueba.app.inject({
        method: 'DELETE',
        url: ruta(a.cuenta.id, a.usuario.id),
        headers,
      });
      expect(sinCerrar.statusCode).toBe(403);
    });
  });

  describe('sesiones de plataforma (super admin)', () => {
    let lucia: SuperAdminDePrueba;

    beforeEach(async () => {
      lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    });

    const entrarAdmin = async (n: number, plataforma = 'web'): Promise<Sesion> => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: `${PLATAFORMA}/sesiones`,
        payload: {
          usuario: 'lucia.paz',
          contrasena: lucia.contrasena,
          instalacion_id: instalacion(n),
          plataforma,
          dispositivo: 'Panel',
        },
      });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      return respuesta.json<Sesion>();
    };

    it('lista las propias, cierra una ajena a la actual y las demás', async () => {
      const uno = await entrarAdmin(1);
      const dos = await entrarAdmin(2);
      const tres = await entrarAdmin(3);
      const lista = await prueba.app.inject({
        method: 'GET',
        url: `${PLATAFORMA}/sesiones`,
        headers: conUsuario(tres),
      });
      const datos = lista.json<Lista>().datos;
      expect(datos).toHaveLength(3);
      expect(datos.find((s) => s.actual)?.plataforma).toBe('web');

      const idUno = datos.find((s) => !s.actual)?.id;
      const cierra = await prueba.app.inject({
        method: 'DELETE',
        url: `${PLATAFORMA}/sesiones/${idUno}`,
        headers: conUsuario(tres),
      });
      expect(cierra.statusCode).toBe(204);

      const otras = await prueba.app.inject({
        method: 'DELETE',
        url: `${PLATAFORMA}/sesiones/otras`,
        headers: conUsuario(tres),
      });
      expect(otras.statusCode).toBe(200);
      expect(otras.json<{ cerradas: number }>().cerradas).toBe(1);
      const vivas = [uno, dos].map(async (s) => {
        const r = await prueba.app.inject({
          method: 'GET',
          url: `${PLATAFORMA}/perfil`,
          headers: conUsuario(s),
        });
        return r.statusCode;
      });
      expect(await Promise.all(vivas)).toEqual([401, 401]);
      const refresco = await refrescar(uno);
      expect(refresco.statusCode).toBe(401);
    });

    it('si desactivan al super admin entre la contraseña y la transacción, no nace la sesión', async () => {
      const conexion = await prueba.pool.getConnection();
      try {
        await conexion.beginTransaction();
        await conexion.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [lucia.id]);
        const ingreso = prueba.app.inject({
          method: 'POST',
          url: `${PLATAFORMA}/sesiones`,
          payload: {
            usuario: 'lucia.paz',
            contrasena: lucia.contrasena,
            instalacion_id: instalacion(1),
          },
        });
        await new Promise((resolver) => setTimeout(resolver, 1500));
        await conexion.query(
          "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
          [lucia.id],
        );
        await conexion.commit();
        const respuesta = await ingreso;
        expect(respuesta.statusCode, respuesta.body).toBe(401);
      } finally {
        conexion.release();
      }
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT id FROM sesiones WHERE usuario_id = ?',
        [lucia.id],
      );
      expect(filas).toHaveLength(0);
    });

    it('ingresos simultáneos del super admin desde la misma instalación no dan 5xx', async () => {
      const respuestas = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          prueba.app.inject({
            method: 'POST',
            url: `${PLATAFORMA}/sesiones`,
            payload: {
              usuario: 'lucia.paz',
              contrasena: lucia.contrasena,
              instalacion_id: instalacion(2),
            },
          }),
        ),
      );
      expect(respuestas.map((r) => r.statusCode)).toEqual(respuestas.map(() => 200));
    });

    it('el tope por usuario también rige para el super admin', async () => {
      const sesiones: Sesion[] = [];
      for (let n = 1; n <= 4; n += 1) sesiones.push(await entrarAdmin(n));
      const r = await prueba.app.inject({
        method: 'GET',
        url: `${PLATAFORMA}/perfil`,
        headers: conUsuario(elemento(sesiones, 0)),
      });
      expect(r.statusCode).toBe(401);
    });

    it('no puede cerrar la sesión de otro super admin ni de un usuario de cuenta: 404', async () => {
      const otro = await crearSuperAdmin(prueba.pool, 'otro.admin');
      const deOtro = await prueba.app.inject({
        method: 'POST',
        url: `${PLATAFORMA}/sesiones`,
        payload: { usuario: 'otro.admin', contrasena: otro.contrasena },
      });
      const ajena = await prueba.app.inject({
        method: 'GET',
        url: `${PLATAFORMA}/sesiones`,
        headers: conUsuario(deOtro.json<Sesion>()),
      });
      const id = ajena.json<Lista>().datos[0]?.id;
      const mia = await entrarAdmin(1);
      const respuesta = await prueba.app.inject({
        method: 'DELETE',
        url: `${PLATAFORMA}/sesiones/${id}`,
        headers: conUsuario(mia),
      });
      expect(respuesta.statusCode).toBe(404);

      const deUsuario = await entrar(a.usuario.pin, { n: 8 });
      const idUsuario = (await listar(deUsuario))[0]?.id;
      const cruzada = await prueba.app.inject({
        method: 'DELETE',
        url: `${PLATAFORMA}/sesiones/${idUsuario}`,
        headers: conUsuario(mia),
      });
      expect(cruzada.statusCode).toBe(404);
      expect(await sesionDe(deUsuario)).toBe('viva');
    });
  });

  it('un usuario no puede listar rutas de plataforma con su token', async () => {
    const sesion = await entrar(a.usuario.pin, { n: 1 });
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: `${PLATAFORMA}/sesiones`,
      headers: conUsuario(sesion),
    });
    expect([401, 403]).toContain(respuesta.statusCode);
  });
});
