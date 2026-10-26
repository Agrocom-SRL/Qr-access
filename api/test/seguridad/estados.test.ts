import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearQr,
  crearSuperAdmin,
  crearUsuarioConPin,
  type Escenario,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
  type Sesion,
} from '../helpers/http.js';

interface Validacion {
  abrir: boolean;
  motivo_code: string;
}

interface EstadoDeUsuario {
  id: string;
  estado: string;
  estado_efectivo: string;
  estado_origen: string | null;
  estado_motivo: string | null;
  estado_desde: string | null;
  estado_impuesto_por: string | null;
}

/** Un árbol de una cuenta: admin -> (titular -> miembro) y admin -> (otro titular -> otro miembro). */
interface Arbol {
  titular: UsuarioDePrueba;
  miembro: UsuarioDePrueba;
  titular2: UsuarioDePrueba;
  miembro2: UsuarioDePrueba;
}

const MOTIVO = 'uso indebido de la puerta';

/** Las columnas JSON llegan ya leídas o como texto, según el conector. */
const comoObjeto = (valor: unknown): unknown =>
  typeof valor === 'string' ? (JSON.parse(valor) as unknown) : valor;

describe('estados de usuario y cuenta: restringido, suspendido y reactivar (ADR 0033 §1, ADR 0031 §0 a §2, D-25)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let ramas: Arbol;
  let ramasB: Arbol;
  let admin: Sesion;
  let adminB: Sesion;
  let titular: Sesion;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  async function armarArbol(escenario: Escenario, sufijo: string): Promise<Arbol> {
    const { pool } = prueba;
    const superiorId = escenario.administrador.id;
    const titular = await crearUsuarioConPin(
      pool,
      escenario.cuenta,
      `T1${sufijo}`,
      [escenario.rolTitularId],
      { superiorId },
    );
    const titular2 = await crearUsuarioConPin(
      pool,
      escenario.cuenta,
      `T2${sufijo}`,
      [escenario.rolTitularId],
      { superiorId },
    );
    const miembro = await crearUsuarioConPin(
      pool,
      escenario.cuenta,
      `M1${sufijo}`,
      [escenario.rolMiembroId],
      { superiorId: titular.id },
    );
    const miembro2 = await crearUsuarioConPin(
      pool,
      escenario.cuenta,
      `M2${sufijo}`,
      [escenario.rolMiembroId],
      { superiorId: titular2.id },
    );
    return { titular, titular2, miembro, miembro2 };
  }

  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    ramas = await armarArbol(a, 'A1');
    ramasB = await armarArbol(b, 'B1');
    admin = await iniciarSesion(prueba.app, a.administrador.pin);
    adminB = await iniciarSesion(prueba.app, b.administrador.pin);
    titular = await iniciarSesion(prueba.app, ramas.titular.pin);
  });

  const cambiar = (
    sesion: Sesion,
    usuarioId: string,
    accion: 'restriccion' | 'suspension' | 'reactivacion',
    cuerpo: object | undefined = accion === 'reactivacion' ? undefined : { motivo: MOTIVO },
  ) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/usuarios/${usuarioId}/${accion}`,
      headers: conUsuario(sesion),
      ...(cuerpo === undefined ? {} : { payload: cuerpo }),
    });
  const estadoDe = async (sesion: Sesion, usuarioId: string): Promise<EstadoDeUsuario> => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: `/api/v1/usuarios/${usuarioId}/estado`,
      headers: conUsuario(sesion),
    });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<EstadoDeUsuario>();
  };
  const generar = (sesion: Sesion, puertaId = a.puertaPrincipal.id) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos',
      headers: conUsuario(sesion),
      payload: { puerta_ids: [puertaId] },
    });
  const validar = (texto: string, dispositivo = a.dispositivoPrincipal) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: dispositivo.encabezado },
      payload: { token: texto, leido_en: new Date().toISOString() },
    });
  const sesionActual = (sesion: Sesion) =>
    prueba.app.inject({
      method: 'GET',
      url: '/api/v1/sesiones/actual',
      headers: conUsuario(sesion),
    });
  const ingresar = (pin: string) =>
    prueba.app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { pin } });
  const filaDe = async (tabla: 'usuarios' | 'cuentas', id: string) => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      tabla === 'usuarios'
        ? 'SELECT * FROM usuarios WHERE id = ?'
        : 'SELECT * FROM cuentas WHERE id = ?',
      [id],
    );
    return filas[0];
  };
  const anuladoDe = async (
    qrId: string,
  ): Promise<{ anulado_at: Date | null; anulado_por: string | null }> => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT anulado_at, anulado_por FROM qr_accesos WHERE id = ?',
      [qrId],
    );
    const fila = filas[0] as { anulado_at: Date | null; anulado_por: string | null } | undefined;
    return { anulado_at: fila?.anulado_at ?? null, anulado_por: fila?.anulado_por ?? null };
  };
  const sesionesVivas = async (usuarioId: string): Promise<number> => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id = ? AND revocada_at IS NULL',
      [usuarioId],
    );
    return Number(filas[0]?.n);
  };

  describe('aislamiento entre cuentas (invariante 1)', () => {
    it('la cuenta A no restringe, suspende, reactiva ni consulta a nadie de B: 404 y nada cambia', async () => {
      for (const accion of ['restriccion', 'suspension', 'reactivacion'] as const) {
        const respuesta = await cambiar(admin, ramasB.titular.id, accion);
        expect(respuesta.statusCode, accion).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
      }
      const consulta = await prueba.app.inject({
        method: 'GET',
        url: `/api/v1/usuarios/${ramasB.titular.id}/estado`,
        headers: conUsuario(admin),
      });
      expect(consulta.statusCode).toBe(404);
      expect((await filaDe('usuarios', ramasB.titular.id))?.estado).toBe('activo');
      // Y a la inversa: B tampoco toca a A.
      expect((await cambiar(adminB, ramas.titular.id, 'suspension')).statusCode).toBe(404);
      expect((await filaDe('usuarios', ramas.titular.id))?.estado).toBe('activo');
    });

    it('suspender en A no deja huella en B: sus sesiones y QR siguen vivos', async () => {
      const qrB = await crearQr(prueba.pool, b.cuenta, ramasB.titular.id, [b.puertaPrincipal.id]);
      await iniciarSesion(prueba.app, ramasB.titular.pin);
      await cambiar(admin, ramas.titular.id, 'suspension');
      expect((await anuladoDe(qrB.id)).anulado_at).toBeNull();
      expect(await sesionesVivas(ramasB.titular.id)).toBe(1);
    });
  });

  describe('quién puede cambiar un estado', () => {
    it('un Titular restringe y suspende a su Miembro', async () => {
      expect((await cambiar(titular, ramas.miembro.id, 'restriccion')).statusCode).toBe(204);
      expect((await cambiar(titular, ramas.miembro.id, 'suspension')).statusCode).toBe(204);
      expect((await filaDe('usuarios', ramas.miembro.id))?.estado).toBe('suspendido');
    });

    it('un Titular no restringe ni suspende a un par ni a un superior: no existen para él (404)', async () => {
      for (const objetivo of [ramas.titular2.id, ramas.miembro2.id, a.administrador.id]) {
        for (const accion of ['restriccion', 'suspension'] as const) {
          expect((await cambiar(titular, objetivo, accion)).statusCode).toBe(404);
        }
      }
      expect((await filaDe('usuarios', ramas.titular2.id))?.estado).toBe('activo');
      expect((await filaDe('usuarios', a.administrador.id))?.estado).toBe('activo');
    });

    it('nadie se restringe a sí mismo', async () => {
      const respuesta = await cambiar(admin, a.administrador.id, 'suspension');
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('usuario.propio');
    });

    it('sin el permiso del rol, 403; un Miembro no administra estados', async () => {
      const miembro = await iniciarSesion(prueba.app, a.usuario.pin);
      for (const accion of ['restriccion', 'suspension', 'reactivacion'] as const) {
        const respuesta = await cambiar(miembro, ramas.miembro.id, accion);
        expect(respuesta.statusCode, accion).toBe(403);
        expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
      }
    });

    it('el motivo es obligatorio y corto', async () => {
      for (const cuerpo of [
        {},
        { motivo: '   ' },
        { motivo: 'x'.repeat(201) },
        { motivo: MOTIVO, otro: 1 },
      ]) {
        expect((await cambiar(admin, ramas.titular.id, 'restriccion', cuerpo)).statusCode).toBe(
          400,
        );
        expect((await cambiar(admin, ramas.titular.id, 'suspension', cuerpo)).statusCode).toBe(400);
      }
      expect((await filaDe('usuarios', ramas.titular.id))?.estado).toBe('activo');
    });

    it('un estado impuesto por un superior no lo levanta ni lo agrava quien está debajo', async () => {
      await cambiar(admin, ramas.miembro.id, 'restriccion');
      // El Titular es superior del Miembro, pero el Administrador lo es del Titular: manda el de arriba.
      for (const accion of ['reactivacion', 'suspension', 'restriccion'] as const) {
        const respuesta = await cambiar(titular, ramas.miembro.id, accion);
        // `restriccion` sobre quien ya está restringido no cambia nada (idempotente).
        if (accion === 'restriccion') expect(respuesta.statusCode).toBe(204);
        else {
          expect(respuesta.statusCode, accion).toBe(403);
          expect(respuesta.json<Problema>().code).toBe('estado.impuesto_por_superior');
        }
      }
      const propio = await estadoDe(titular, ramas.miembro.id);
      expect(propio.estado).toBe('restringido');
      expect(propio.estado_impuesto_por).toBe(a.administrador.id);
      // Quien lo impuso sí lo levanta.
      expect((await cambiar(admin, ramas.miembro.id, 'reactivacion')).statusCode).toBe(204);
      expect((await estadoDe(admin, ramas.miembro.id)).estado).toBe('activo');
    });

    it('lo que impuso el Titular lo levanta su superior', async () => {
      await cambiar(titular, ramas.miembro.id, 'suspension');
      expect((await cambiar(admin, ramas.miembro.id, 'reactivacion')).statusCode).toBe(204);
      expect((await estadoDe(admin, ramas.miembro.id)).estado).toBe('activo');
    });

    it('un estado sin autor conocido (lo migrado) o puesto por AGROCOM no lo levanta nadie de la cuenta', async () => {
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'migracion', estado_impuesto_por = NULL WHERE id = ?",
        [ramas.titular2.id],
      );
      const respuesta = await cambiar(admin, ramas.titular2.id, 'reactivacion');
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('estado.impuesto_por_superior');
    });

    it('levantar exige el permiso del estado que se levanta', async () => {
      await cambiar(admin, ramas.miembro.id, 'restriccion');
      await prueba.pool.query(
        "DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = ? AND p.codigo = 'seguridad.usuario.restringir'",
        [a.rolAdministradorId],
      );
      const sinPermiso = await iniciarSesion(prueba.app, a.administrador.pin);
      const respuesta = await cambiar(sinPermiso, ramas.miembro.id, 'reactivacion');
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
    });

    it('repetir el mismo estado no cambia nada: ni quién lo impuso ni la bitácora', async () => {
      await cambiar(admin, ramas.titular.id, 'restriccion');
      const antes = await filaDe('usuarios', ramas.titular.id);
      const [bitacoraAntes] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS n FROM bitacoras',
      );
      expect((await cambiar(admin, ramas.titular.id, 'restriccion')).statusCode).toBe(204);
      expect((await cambiar(admin, ramas.titular2.id, 'reactivacion')).statusCode).toBe(204);
      expect((await filaDe('usuarios', ramas.titular.id))?.estado_desde).toEqual(
        antes?.estado_desde,
      );
      const [bitacoraDespues] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS n FROM bitacoras',
      );
      expect(bitacoraDespues[0]?.n).toBe(bitacoraAntes[0]?.n);
    });
  });

  describe('restringido', () => {
    it('conserva la sesión y consulta, pero no genera QR nuevos (qr.generacion_restringida)', async () => {
      expect((await cambiar(admin, ramas.titular.id, 'restriccion')).statusCode).toBe(204);

      const actual = await sesionActual(titular);
      expect(actual.statusCode).toBe(200);
      expect(actual.json()).toMatchObject({ estado: 'restringido', estado_origen: 'usuario' });
      expect((await ingresar(ramas.titular.pin)).statusCode).toBe(200);

      const respuesta = await generar(titular);
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json()).toMatchObject({
        code: 'qr.generacion_restringida',
        origen: 'usuario',
      });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS n FROM qr_accesos WHERE generado_por = ?',
        [ramas.titular.id],
      );
      expect(Number(filas[0]?.n)).toBe(0);
    });

    it('sus QR ya generados siguen vivos y abren la puerta hasta vencer', async () => {
      const generado = await generar(titular);
      expect(generado.statusCode).toBe(201);
      const { id, texto } = generado.json<{ id: string; texto: string }>();
      await cambiar(admin, ramas.titular.id, 'restriccion');

      expect((await anuladoDe(id)).anulado_at).toBeNull();
      const respuesta = await validar(texto);
      expect(respuesta.json<Validacion>()).toMatchObject({
        abrir: true,
        motivo_code: 'acceso.permitido',
      });
    });

    it('arrastra a su rama: el Miembro tampoco genera, y la vecina sí', async () => {
      const miembro = await iniciarSesion(prueba.app, ramas.miembro.pin);
      const miembro2 = await iniciarSesion(prueba.app, ramas.miembro2.pin);
      const delMiembro = await generar(miembro);
      expect(delMiembro.statusCode).toBe(201);

      await cambiar(admin, ramas.titular.id, 'restriccion');

      const bloqueado = await generar(miembro);
      expect(bloqueado.statusCode).toBe(403);
      expect(bloqueado.json()).toMatchObject({
        code: 'qr.generacion_restringida',
        origen: 'superior',
      });
      // El estado de la fila del Miembro no cambió: se deriva.
      expect((await filaDe('usuarios', ramas.miembro.id))?.estado).toBe('activo');
      expect(await estadoDe(admin, ramas.miembro.id)).toMatchObject({
        estado: 'activo',
        estado_efectivo: 'restringido',
        estado_origen: 'superior',
      });
      // Su QR de antes sigue abriendo.
      const abierto = await validar(delMiembro.json<{ texto: string }>().texto);
      expect(abierto.json<Validacion>().abrir).toBe(true);
      // Otra rama no se entera.
      expect((await generar(miembro2)).statusCode).toBe(201);
      expect((await generar(admin)).statusCode).toBe(201);
    });

    it('reactivar al raíz devuelve la rama, salvo quien tenga un estado propio', async () => {
      const miembro = await iniciarSesion(prueba.app, ramas.miembro.pin);
      await cambiar(admin, ramas.titular.id, 'restriccion');
      expect((await generar(miembro)).statusCode).toBe(403);

      expect((await cambiar(admin, ramas.titular.id, 'reactivacion')).statusCode).toBe(204);
      expect((await generar(miembro)).statusCode).toBe(201);
      expect((await generar(titular)).statusCode).toBe(201);

      // Con un estado propio, el Miembro sigue restringido aunque el raíz vuelva.
      await cambiar(titular, ramas.miembro.id, 'restriccion');
      await cambiar(admin, ramas.titular.id, 'restriccion');
      await cambiar(admin, ramas.titular.id, 'reactivacion');
      expect((await generar(miembro)).statusCode).toBe(403);
      expect((await generar(titular)).statusCode).toBe(201);
    });

    it('una cuenta restringida no genera, pero lo ya generado abre y nadie pierde la sesión', async () => {
      const prev = await generar(admin);
      const lectura = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', await superAdmin());
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/plataforma/cuentas/${a.cuenta.id}/restriccion`,
        headers: conUsuario(lectura),
        payload: { motivo: MOTIVO },
      });
      expect(respuesta.statusCode, respuesta.body).toBe(204);

      expect((await sesionActual(admin)).statusCode).toBe(200);
      const bloqueado = await generar(admin);
      expect(bloqueado.statusCode).toBe(403);
      expect(bloqueado.json()).toMatchObject({
        code: 'qr.generacion_restringida',
        origen: 'cuenta',
      });
      expect((await validar(prev.json<{ texto: string }>().texto)).json<Validacion>().abrir).toBe(
        true,
      );
      expect((await filaDe('cuentas', a.cuenta.id))?.estado).toBe('restringido');
      // B no se entera.
      expect((await generar(adminB, b.puertaPrincipal.id)).statusCode).toBe(201);
    });
  });

  describe('suspendido', () => {
    it('cierra las sesiones de la rama, anula sus QR vigentes en el acto y bloquea el ingreso', async () => {
      const miembro = await iniciarSesion(prueba.app, ramas.miembro.pin);
      const qrTitular = await crearQr(prueba.pool, a.cuenta, ramas.titular.id, [
        a.puertaPrincipal.id,
      ]);
      const qrMiembro = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [
        a.puertaPrincipal.id,
      ]);
      const qrVecino = await crearQr(prueba.pool, a.cuenta, ramas.titular2.id, [
        a.puertaPrincipal.id,
      ]);
      const qrUsado = await crearQr(
        prueba.pool,
        a.cuenta,
        ramas.titular.id,
        [a.puertaPrincipal.id],
        {
          usadoAt: new Date(Date.now() - 60_000),
        },
      );

      expect((await cambiar(admin, ramas.titular.id, 'suspension')).statusCode).toBe(204);

      // Sesiones: la del Titular y la de su Miembro mueren con el mismo JWT.
      expect((await sesionActual(titular)).statusCode).toBe(401);
      expect((await sesionActual(miembro)).statusCode).toBe(401);
      expect(await sesionesVivas(ramas.titular.id)).toBe(0);
      expect(await sesionesVivas(ramas.miembro.id)).toBe(0);
      for (const pin of [ramas.titular.pin, ramas.miembro.pin]) {
        const respuesta = await ingresar(pin);
        expect(respuesta.statusCode).toBe(403);
        expect(respuesta.json<Problema>().code).toBe('sesion.usuario_suspendido');
      }
      // QR: los de la rama, anulados por quien suspendió; los de otra rama y los ya usados, intactos.
      for (const id of [qrTitular.id, qrMiembro.id]) {
        const anulado = await anuladoDe(id);
        expect(anulado.anulado_at).toBeInstanceOf(Date);
        expect(anulado.anulado_por).toBe(a.administrador.id);
      }
      expect((await anuladoDe(qrVecino.id)).anulado_at).toBeNull();
      expect((await anuladoDe(qrUsado.id)).anulado_at).toBeNull();
      expect((await validar(qrTitular.texto)).json<Validacion>()).toMatchObject({
        abrir: false,
        motivo_code: 'qr.anulado',
      });
      expect((await validar(qrVecino.texto)).json<Validacion>().abrir).toBe(true);
      // La vecina conserva su sesión.
      expect(
        (await sesionActual(await iniciarSesion(prueba.app, ramas.titular2.pin))).statusCode,
      ).toBe(200);
    });

    it('queda guardado quién, cuándo y por qué, y la bitácora lo registra con su origen', async () => {
      await cambiar(admin, ramas.titular.id, 'suspension', { motivo: `  ${MOTIVO}  ` });
      expect(await estadoDe(admin, ramas.titular.id)).toMatchObject({
        estado: 'suspendido',
        estado_efectivo: 'suspendido',
        estado_origen: 'usuario',
        estado_motivo: MOTIVO,
        estado_impuesto_por: a.administrador.id,
        estado_desde: expect.stringMatching(/Z$/) as string,
      });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id, origen, antes, despues FROM bitacoras WHERE tabla = 'usuarios' AND registro_id = ? AND accion = 'actualizado' ORDER BY id DESC LIMIT 1",
        [ramas.titular.id],
      );
      expect(filas[0]).toMatchObject({ origen: 'api' });
      expect(String(filas[0]?.usuario_id)).toBe(a.administrador.id);
      expect(comoObjeto(filas[0]?.despues)).toMatchObject({
        estado: 'suspendido',
        estado_motivo: MOTIVO,
        estado_impuesto_por: a.administrador.id,
      });
      expect(comoObjeto(filas[0]?.antes)).toMatchObject({ estado: 'activo' });
    });

    it('reactivar al raíz devuelve la rama, pero los QR anulados no reviven', async () => {
      const qrMiembro = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [
        a.puertaPrincipal.id,
      ]);
      await cambiar(admin, ramas.titular.id, 'suspension');
      expect((await ingresar(ramas.miembro.pin)).statusCode).toBe(403);

      expect((await cambiar(admin, ramas.titular.id, 'reactivacion')).statusCode).toBe(204);

      expect((await ingresar(ramas.titular.pin)).statusCode).toBe(200);
      expect((await ingresar(ramas.miembro.pin)).statusCode).toBe(200);
      expect((await anuladoDe(qrMiembro.id)).anulado_at).toBeInstanceOf(Date);
      expect((await validar(qrMiembro.texto)).json<Validacion>()).toMatchObject({
        abrir: false,
        motivo_code: 'qr.anulado',
      });
      // Se generan de nuevo.
      expect((await generar(await iniciarSesion(prueba.app, ramas.miembro.pin))).statusCode).toBe(
        201,
      );
    });

    it('quien tenía un estado propio antes lo conserva al volver el raíz', async () => {
      await cambiar(titular, ramas.miembro.id, 'restriccion');
      await cambiar(admin, ramas.titular.id, 'suspension');
      await cambiar(admin, ramas.titular.id, 'reactivacion');
      expect((await ingresar(ramas.miembro.pin)).statusCode).toBe(200);
      expect((await estadoDe(admin, ramas.miembro.id)).estado_efectivo).toBe('restringido');
    });

    it('pasa de restringido a suspendido: ahí sí se cierran sesiones y se anulan QR', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [a.puertaPrincipal.id]);
      await cambiar(admin, ramas.titular.id, 'restriccion');
      expect((await anuladoDe(qr.id)).anulado_at).toBeNull();
      await cambiar(admin, ramas.titular.id, 'suspension');
      expect((await anuladoDe(qr.id)).anulado_at).toBeInstanceOf(Date);
    });

    it('todo ocurre en una sola transacción: si anular los QR falla, no queda suspendido a medias', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [a.puertaPrincipal.id]);
      // Un trigger de prueba hace fallar la anulación de QR; se quita en cuanto termina.
      await prueba.pool.query(
        "CREATE TRIGGER trg_prueba_falla_anulacion BEFORE UPDATE ON qr_accesos FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'falla de prueba'",
      );
      try {
        const respuesta = await cambiar(admin, ramas.titular.id, 'suspension');
        expect(respuesta.statusCode).toBe(500);
      } finally {
        await prueba.pool.query('DROP TRIGGER IF EXISTS trg_prueba_falla_anulacion');
      }
      expect((await filaDe('usuarios', ramas.titular.id))?.estado).toBe('activo');
      expect(await sesionesVivas(ramas.titular.id)).toBe(1);
      expect((await anuladoDe(qr.id)).anulado_at).toBeNull();
      expect((await sesionActual(titular)).statusCode).toBe(200);
    });
  });

  describe('la validación respeta el estado efectivo del generador (ADR 0031 §2)', () => {
    const filaDeEvento = async (): Promise<RowDataPacket | undefined> => {
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT resultado, motivo_code FROM eventos_acceso ORDER BY id DESC LIMIT 1',
      );
      return filas[0];
    };

    it('un superior suspendido (aunque el QR no se haya anulado) no abre y queda registrado', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [a.puertaPrincipal.id]);
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'x' WHERE id = ?",
        [a.administrador.id],
      );
      const respuesta = await validar(qr.texto);
      expect(respuesta.json<Validacion>()).toMatchObject({
        abrir: false,
        motivo_code: 'qr.generador_suspendido',
      });
      expect(await filaDeEvento()).toMatchObject({
        resultado: 'rechazado',
        motivo_code: 'qr.generador_suspendido',
      });
      expect((await anuladoDe(qr.id)).anulado_at).toBeNull();
    });

    it('el abuelo restringido NO frena un QR ya generado', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [a.puertaPrincipal.id]);
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'restringido', estado_desde = NOW(3), estado_motivo = 'x' WHERE id = ?",
        [a.administrador.id],
      );
      expect((await validar(qr.texto)).json<Validacion>().abrir).toBe(true);
    });

    it('una cuenta suspendida: la placa autentica, el QR se rechaza con su motivo y queda registrado', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [a.puertaPrincipal.id]);
      await prueba.pool.query(
        "UPDATE cuentas SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'x' WHERE id = ?",
        [a.cuenta.id],
      );
      const respuesta = await validar(qr.texto);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json<Validacion>()).toMatchObject({
        abrir: false,
        motivo_code: 'qr.cuenta_suspendida',
      });
      expect(await filaDeEvento()).toMatchObject({
        resultado: 'rechazado',
        motivo_code: 'qr.cuenta_suspendida',
      });
      expect((await anuladoDe(qr.id)).anulado_at).toBeNull();
    });

    it('un superior eliminado deja el QR sin dueño vigente: no abre', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [a.puertaPrincipal.id]);
      await prueba.pool.query('UPDATE usuarios SET deleted_at = NOW(3) WHERE id = ?', [
        ramas.titular.id,
      ]);
      expect((await validar(qr.texto)).json<Validacion>()).toMatchObject({
        abrir: false,
        motivo_code: 'qr.anulado',
      });
    });

    it('la validación no se limita ni se bloquea por estar el generador restringido: el QR del Guardia en otra rama sigue', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, ramas.miembro2.id, [a.puertaPrincipal.id]);
      await cambiar(admin, ramas.titular.id, 'suspension');
      expect((await validar(qr.texto)).json<Validacion>().abrir).toBe(true);
    });
  });

  describe('cuentas (AGROCOM, seguridad.cuenta.editar)', () => {
    let plataforma: { acceso: string };
    const cuentaCambia = (
      cuentaId: string,
      accion: 'restriccion' | 'suspension' | 'reactivacion',
      cuerpo?: object,
    ) =>
      prueba.app.inject({
        method: 'POST',
        url: `/api/v1/plataforma/cuentas/${cuentaId}/${accion}`,
        headers: conUsuario(plataforma),
        ...(accion === 'reactivacion' ? {} : { payload: cuerpo ?? { motivo: MOTIVO } }),
      });

    beforeEach(async () => {
      await superAdmin();
      plataforma = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', CONTRASENA);
    });

    it('suspender cierra todas las sesiones, anula todos los QR vigentes y bloquea el ingreso', async () => {
      const qrAdmin = await crearQr(prueba.pool, a.cuenta, a.administrador.id, [
        a.puertaPrincipal.id,
      ]);
      const qrMiembro = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [
        a.puertaPrincipal.id,
      ]);
      const qrB = await crearQr(prueba.pool, b.cuenta, ramasB.miembro.id, [b.puertaPrincipal.id]);

      expect((await cuentaCambia(a.cuenta.id, 'suspension')).statusCode).toBe(204);

      expect((await sesionActual(admin)).statusCode).toBe(401);
      expect((await sesionActual(titular)).statusCode).toBe(401);
      expect(await sesionesVivas(a.administrador.id)).toBe(0);
      for (const pin of [a.administrador.pin, ramas.miembro.pin]) {
        const respuesta = await ingresar(pin);
        expect(respuesta.statusCode).toBe(403);
        expect(respuesta.json<Problema>().code).toBe('sesion.cuenta_suspendida');
      }
      for (const id of [qrAdmin.id, qrMiembro.id]) {
        expect((await anuladoDe(id)).anulado_at).toBeInstanceOf(Date);
      }
      const rechazo = await validar(qrAdmin.texto);
      expect(rechazo.statusCode).toBe(200);
      expect(rechazo.json<Validacion>().abrir).toBe(false);
      // Cuenta B intacta.
      expect((await anuladoDe(qrB.id)).anulado_at).toBeNull();
      expect((await sesionActual(adminB)).statusCode).toBe(200);
      expect((await validar(qrB.texto, b.dispositivoPrincipal)).json<Validacion>().abrir).toBe(
        true,
      );
      // La fila queda con quién, cuándo y por qué.
      expect(await filaDe('cuentas', a.cuenta.id)).toMatchObject({
        estado: 'suspendido',
        estado_motivo: MOTIVO,
      });
    });

    it('reactivar la cuenta devuelve el ingreso pero no revive los QR anulados', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, ramas.miembro.id, [a.puertaPrincipal.id]);
      await cuentaCambia(a.cuenta.id, 'suspension');
      expect((await cuentaCambia(a.cuenta.id, 'reactivacion')).statusCode).toBe(204);
      expect((await ingresar(a.administrador.pin)).statusCode).toBe(200);
      expect((await validar(qr.texto)).json<Validacion>()).toMatchObject({
        abrir: false,
        motivo_code: 'qr.anulado',
      });
      expect(await filaDe('cuentas', a.cuenta.id)).toMatchObject({
        estado: 'activo',
        estado_motivo: null,
        estado_desde: null,
      });
    });

    it('motivo obligatorio, cuenta inexistente 404 y sin permiso 403', async () => {
      expect((await cuentaCambia(a.cuenta.id, 'suspension', {})).statusCode).toBe(400);
      const inexistente = await cuentaCambia('999999', 'suspension');
      expect(inexistente.statusCode).toBe(404);
      expect(inexistente.json<Problema>().code).toBe('cuenta.no_encontrada');

      const sinPermiso = await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/plataforma/cuentas/${a.cuenta.id}/suspension`,
        headers: conUsuario(admin),
        payload: { motivo: MOTIVO },
      });
      // Un JWT de cuenta no sirve en las rutas de plataforma.
      expect(sinPermiso.statusCode).toBe(401);
      expect((await filaDe('cuentas', a.cuenta.id))?.estado).toBe('activo');
    });

    it('la ficha y el listado informan el estado de la cuenta', async () => {
      await cuentaCambia(a.cuenta.id, 'restriccion');
      const ficha = await prueba.app.inject({
        method: 'GET',
        url: `/api/v1/plataforma/cuentas/${a.cuenta.id}`,
        headers: conUsuario(plataforma),
      });
      expect(ficha.json<{ cuenta: Record<string, unknown> }>().cuenta).toMatchObject({
        activa: true,
        estado: 'restringido',
        estado_motivo: MOTIVO,
      });
      const lista = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/plataforma/cuentas',
        headers: conUsuario(plataforma),
      });
      const estados = new Map(
        lista
          .json<{ datos: { codigo: string; cuenta_estado: string }[] }>()
          .datos.map((c) => [c.codigo, c.cuenta_estado]),
      );
      expect(estados.get('AAA')).toBe('restringido');
      expect(estados.get('BBB')).toBe('activo');
    });
  });

  describe('equipo de plataforma (seguridad.equipo.desactivar)', () => {
    it('desactivar deja suspendido con quién, desde cuándo y por qué; reactivar lo limpia', async () => {
      const lucia = await superAdmin();
      const marco = await crearSuperAdmin(prueba.pool, 'marco.vaca');
      const sesion = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia);
      const editar = (cuerpo: object) =>
        prueba.app.inject({
          method: 'PATCH',
          url: `/api/v1/plataforma/equipo/${marco.id}`,
          headers: conUsuario(sesion),
          payload: cuerpo,
        });

      expect((await editar({ activo: false, motivo: 'salió de la empresa' })).statusCode).toBe(204);
      expect(await filaDe('usuarios', marco.id)).toMatchObject({
        estado: 'suspendido',
        estado_motivo: 'salió de la empresa',
      });
      expect(String((await filaDe('usuarios', marco.id))?.estado_impuesto_por)).not.toBe('null');

      expect((await editar({ activo: true })).statusCode).toBe(204);
      expect(await filaDe('usuarios', marco.id)).toMatchObject({
        estado: 'activo',
        estado_motivo: null,
        estado_desde: null,
        estado_impuesto_por: null,
      });
      // Sin motivo se guarda uno por defecto (la base exige uno).
      expect((await editar({ activo: false })).statusCode).toBe(204);
      expect((await filaDe('usuarios', marco.id))?.estado_motivo).toBe('equipo.desactivado');
    });
  });

  const CONTRASENA = 'contrasena-de-prueba-1';
  async function superAdmin(): Promise<string> {
    const [existente] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT id FROM usuarios WHERE username = 'lucia.paz'",
    );
    if (existente.length === 0)
      await crearSuperAdmin(prueba.pool, 'lucia.paz', { contrasena: CONTRASENA });
    return CONTRASENA;
  }
});
