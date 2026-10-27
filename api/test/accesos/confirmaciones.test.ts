import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
  crearSuperAdmin,
  type DispositivoDePrueba,
  type Escenario,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

interface Validacion {
  abrir: boolean;
  evento_id: string;
  motivo_code: string;
}
interface EventoListado {
  id: string;
  resultado: string;
  ejecucion: string | null;
}
interface EventoDetallado extends EventoListado {
  confirmaciones: { origen: string; resultado: string; causa: string; registrada_at: string }[];
}
interface FilaDeConfirmacion extends RowDataPacket {
  evento_acceso_id: string;
  dispositivo_id: string;
  puerta_id: string;
  origen: string;
  resultado: string;
  causa: string;
}

describe('POST /api/v1/dispositivos/confirmaciones (ADR 0031 §18)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let adminA: string;
  let adminB: string;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    adminA = (await iniciarSesion(prueba.app, a.administrador.pin)).acceso;
    adminB = (await iniciarSesion(prueba.app, b.administrador.pin)).acceso;
  });

  const validar = async (
    escenario: Escenario,
    dispositivo: DispositivoDePrueba,
    puertaId: string,
  ) => {
    const qr = await crearQr(prueba.pool, escenario.cuenta, escenario.usuario.id, [puertaId]);
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: dispositivo.encabezado },
      payload: { token: qr.texto },
    });
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json<Validacion>();
    expect(cuerpo.abrir).toBe(true);
    return { eventoId: cuerpo.evento_id, qr };
  };
  const confirmar = (dispositivo: DispositivoDePrueba | null, payload: unknown) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/confirmaciones',
      headers: dispositivo === null ? {} : { authorization: dispositivo.encabezado },
      payload: payload as object,
    });
  const filas = async () =>
    (
      await prueba.pool.query<FilaDeConfirmacion[]>(
        'SELECT * FROM confirmaciones_apertura ORDER BY id',
      )
    )[0];
  const get = (url: string, acceso: string) =>
    prueba.app.inject({ method: 'GET', url: `/api/v1${url}`, headers: conUsuario({ acceso }) });

  describe('registro del informe', () => {
    it('una apertura ejecutada queda enlazada al evento que ordenó abrir', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const respuesta = await confirmar(a.dispositivoPrincipal, {
        evento_id: eventoId,
        resultado: 'ejecutada',
        leido_en: new Date().toISOString(),
      });
      expect(respuesta.statusCode).toBe(204);
      expect(respuesta.body).toBe('');
      expect(await filas()).toMatchObject([
        {
          evento_acceso_id: eventoId,
          dispositivo_id: a.dispositivoPrincipal.id,
          puerta_id: a.puertaPrincipal.id,
          origen: 'placa',
          resultado: 'ejecutada',
          causa: 'puerta_abrio',
        },
      ]);
    });

    it('una falla lleva su causa; sin causa se asume que la puerta no abrió', async () => {
      const primera = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const segunda = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      expect(
        (
          await confirmar(a.dispositivoPrincipal, {
            evento_id: primera.eventoId,
            resultado: 'fallida',
            causa: 'rele_no_accionado',
          })
        ).statusCode,
      ).toBe(204);
      expect(
        (
          await confirmar(a.dispositivoPrincipal, {
            evento_id: segunda.eventoId,
            resultado: 'fallida',
          })
        ).statusCode,
      ).toBe(204);
      expect((await filas()).map((f) => [f.resultado, f.causa])).toEqual([
        ['fallida', 'rele_no_accionado'],
        ['fallida', 'puerta_no_abrio'],
      ]);
    });

    it('sin sensor queda sin_confirmacion: no se inventa un éxito', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      await confirmar(a.dispositivoPrincipal, { evento_id: eventoId, resultado: 'sin_sensor' });
      expect(await filas()).toMatchObject([{ resultado: 'sin_confirmacion', causa: 'sin_sensor' }]);
    });

    it('rechaza cuerpos que no cumplen el esquema estricto (400) y no escribe nada', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const invalidos: unknown[] = [
        { evento_id: eventoId },
        { evento_id: eventoId, resultado: 'confirmada' },
        { evento_id: eventoId, resultado: 'ejecutada', causa: 'puerta_abrio' },
        { evento_id: eventoId, resultado: 'sin_sensor', causa: 'sin_sensor' },
        { evento_id: eventoId, resultado: 'fallida', causa: 'sin_respuesta' },
        { evento_id: eventoId, resultado: 'ejecutada', extra: 1 },
        { evento_id: 'abc', resultado: 'ejecutada' },
        { evento_id: eventoId, resultado: 'ejecutada', cuenta_id: b.cuenta.id },
        { resultado: 'ejecutada' },
      ];
      for (const cuerpo of invalidos) {
        expect(
          (await confirmar(a.dispositivoPrincipal, cuerpo)).statusCode,
          JSON.stringify(cuerpo),
        ).toBe(400);
      }
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });

    it('exige la credencial de un dispositivo: sin ella o con la de un usuario, 401', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const cuerpo = { evento_id: eventoId, resultado: 'ejecutada' };
      expect((await confirmar(null, cuerpo)).statusCode).toBe(401);
      const comoUsuario = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/confirmaciones',
        headers: conUsuario({ acceso: adminA }),
        payload: cuerpo,
      });
      expect(comoUsuario.statusCode).toBe(401);
      const revocado = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/confirmaciones',
        headers: { authorization: `Dispositivo ${a.dispositivoPrincipal.id}.clave-equivocada` },
        payload: cuerpo,
      });
      expect(revocado.statusCode).toBe(401);
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });
  });

  describe('aislamiento: cada placa solo informa de sus propias aperturas', () => {
    it('el dispositivo de A no confirma un evento de B (404, indistinguible de uno inexistente)', async () => {
      const deB = await validar(b, b.dispositivoPrincipal, b.puertaPrincipal.id);
      const cuerpo = { evento_id: deB.eventoId, resultado: 'ejecutada' };
      const ajeno = await confirmar(a.dispositivoPrincipal, cuerpo);
      expect(ajeno.statusCode).toBe(404);
      expect(ajeno.json<Problema>().code).toBe('evento.no_encontrado');
      const inexistente = await confirmar(a.dispositivoPrincipal, {
        evento_id: '999999999',
        resultado: 'ejecutada',
      });
      expect(inexistente.statusCode).toBe(404);
      expect(inexistente.json<Problema>().code).toBe('evento.no_encontrado');
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });

    it('un evento permitido de otro método (pulsador, forzada) no se confirma: 404', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      await prueba.pool.query("UPDATE eventos_acceso SET metodo = 'pulsador' WHERE id = ?", [
        eventoId,
      ]);
      const respuesta = await confirmar(a.dispositivoPrincipal, {
        evento_id: eventoId,
        resultado: 'ejecutada',
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('evento.no_encontrado');
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });

    it('otra placa de la MISMA cuenta tampoco confirma por la puerta de al lado', async () => {
      const principal = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const respuesta = await confirmar(a.dispositivoTrasero, {
        evento_id: principal.eventoId,
        resultado: 'ejecutada',
      });
      expect(respuesta.statusCode).toBe(404);
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });

    it('un intento rechazado no es una apertura: no se confirma', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaTrasera.id]);
      const rechazo = (
        await prueba.app.inject({
          method: 'POST',
          url: '/api/v1/dispositivos/validaciones',
          headers: { authorization: a.dispositivoPrincipal.encabezado },
          payload: { token: qr.texto },
        })
      ).json<Validacion>();
      expect(rechazo.abrir).toBe(false);
      const respuesta = await confirmar(a.dispositivoPrincipal, {
        evento_id: rechazo.evento_id,
        resultado: 'ejecutada',
      });
      expect(respuesta.statusCode).toBe(404);
    });
  });

  describe('idempotencia y tardanza', () => {
    it('repetir el informe (reintento por mala red) responde 204 y no crea otra fila', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const cuerpo = { evento_id: eventoId, resultado: 'ejecutada' };
      expect((await confirmar(a.dispositivoPrincipal, cuerpo)).statusCode).toBe(204);
      expect((await confirmar(a.dispositivoPrincipal, cuerpo)).statusCode).toBe(204);
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(1);
    });

    it('un segundo informe distinto no reescribe el primero', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      await confirmar(a.dispositivoPrincipal, { evento_id: eventoId, resultado: 'ejecutada' });
      const otra = await confirmar(a.dispositivoPrincipal, {
        evento_id: eventoId,
        resultado: 'fallida',
      });
      expect(otra.statusCode).toBe(204);
      expect(await filas()).toMatchObject([{ resultado: 'ejecutada' }]);
    });

    it('dos informes simultáneos del mismo evento dejan una sola fila', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const cuerpo = { evento_id: eventoId, resultado: 'ejecutada' };
      const respuestas = await Promise.all([
        confirmar(a.dispositivoPrincipal, cuerpo),
        confirmar(a.dispositivoPrincipal, cuerpo),
        confirmar(a.dispositivoPrincipal, cuerpo),
      ]);
      expect(respuestas.map((r) => r.statusCode)).toEqual([204, 204, 204]);
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(1);
    });

    it('una confirmación tardía (pasado el plazo del servidor) se acepta y manda sobre la constancia', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      // El detector ya había dejado la constancia sin_respuesta.
      await prueba.pool.query(
        "INSERT INTO confirmaciones_apertura (tenant_id, evento_acceso_id, dispositivo_id, puerta_id, origen, resultado, causa, registrada_at) VALUES (?, ?, ?, ?, 'servidor', 'sin_confirmacion', 'sin_respuesta', NOW(3))",
        [a.cuenta.id, eventoId, a.dispositivoPrincipal.id, a.puertaPrincipal.id],
      );
      expect(
        (await confirmar(a.dispositivoPrincipal, { evento_id: eventoId, resultado: 'ejecutada' }))
          .statusCode,
      ).toBe(204);
      expect((await filas()).map((f) => f.origen)).toEqual(['servidor', 'placa']);

      const listado = (await get('/eventos-acceso', adminA)).json<{ datos: EventoListado[] }>();
      expect(listado.datos.find((e) => e.id === eventoId)?.ejecucion).toBe('ejecutada');
      const detalle = (await get(`/eventos-acceso/${eventoId}`, adminA)).json<EventoDetallado>();
      expect(detalle.confirmaciones.map((c) => [c.origen, c.resultado])).toEqual([
        ['servidor', 'sin_confirmacion'],
        ['placa', 'ejecutada'],
      ]);
    });

    it('pasados 10 minutos de la orden ya no se acepta (409) y la placa no debe reintentar', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      await prueba.pool.query(
        'UPDATE eventos_acceso SET ocurrido_at = DATE_SUB(NOW(3), INTERVAL 11 MINUTE) WHERE id = ?',
        [eventoId],
      );
      const respuesta = await confirmar(a.dispositivoPrincipal, {
        evento_id: eventoId,
        resultado: 'ejecutada',
      });
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('confirmacion.fuera_de_plazo');
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });

    it('repetir un informe ya guardado sigue siendo 204 aunque haya pasado el plazo', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const cuerpo = { evento_id: eventoId, resultado: 'ejecutada' };
      await confirmar(a.dispositivoPrincipal, cuerpo);
      await prueba.pool.query(
        'UPDATE eventos_acceso SET ocurrido_at = DATE_SUB(NOW(3), INTERVAL 30 MINUTE) WHERE id = ?',
        [eventoId],
      );
      expect((await confirmar(a.dispositivoPrincipal, cuerpo)).statusCode).toBe(204);
    });
  });

  describe('la confirmación nunca abre nada (falla segura)', () => {
    it('no cambia el evento ni libera el QR: un QR ya usado sigue rechazándose', async () => {
      // El QR sirve en las dos puertas: la relectura del OTRO lector prueba que el QR sigue consumido (la del mismo
      // lector, dentro de la ventana, sería una repetición que vuelve a abrir, ADR 0032 §3).
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [
        a.puertaPrincipal.id,
        a.puertaTrasera.id,
      ]);
      const primera = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token: qr.texto },
      });
      const eventoId = primera.json<Validacion>().evento_id;
      const antes = await contarFilas(prueba.pool, 'eventos_acceso');
      await confirmar(a.dispositivoPrincipal, {
        evento_id: eventoId,
        resultado: 'fallida',
        causa: 'puerta_no_abrio',
      });
      expect(await contarFilas(prueba.pool, 'eventos_acceso')).toBe(antes);
      const [eventos] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT resultado, motivo_code FROM eventos_acceso WHERE id = ?',
        [eventoId],
      );
      expect(eventos[0]).toMatchObject({ resultado: 'permitido', motivo_code: 'acceso.permitido' });

      const otraVez = (
        await prueba.app.inject({
          method: 'POST',
          url: '/api/v1/dispositivos/validaciones',
          headers: { authorization: a.dispositivoTrasero.encabezado },
          payload: { token: qr.texto },
        })
      ).json<Validacion>();
      expect(otraVez).toMatchObject({ abrir: false, motivo_code: 'qr.usado' });
    });

    it('la respuesta nunca trae un abrir: es 204 sin cuerpo', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const respuesta = await confirmar(a.dispositivoPrincipal, {
        evento_id: eventoId,
        resultado: 'ejecutada',
      });
      expect(respuesta.body).toBe('');
      expect(respuesta.headers['cache-control']).toBe('no-store');
    });
  });

  describe('listados y detalle de eventos con la ejecución', () => {
    it('el listado de la cuenta trae `ejecucion` (null en rechazos y sin informe) y filtra por ella', async () => {
      const buena = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const mala = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const pendiente = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      await confirmar(a.dispositivoPrincipal, {
        evento_id: buena.eventoId,
        resultado: 'ejecutada',
      });
      await confirmar(a.dispositivoPrincipal, { evento_id: mala.eventoId, resultado: 'fallida' });
      await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token: 'no-es-un-qr' },
      });

      const todos = (await get('/eventos-acceso', adminA)).json<{ datos: EventoListado[] }>().datos;
      const porId = new Map(todos.map((e) => [e.id, e]));
      expect(porId.get(buena.eventoId)?.ejecucion).toBe('ejecutada');
      expect(porId.get(mala.eventoId)?.ejecucion).toBe('fallida');
      expect(porId.get(pendiente.eventoId)?.ejecucion).toBeNull();
      expect(
        todos.filter((e) => e.resultado === 'rechazado').every((e) => e.ejecucion === null),
      ).toBe(true);

      const fallidas = (await get('/eventos-acceso?ejecucion=fallida', adminA)).json<{
        datos: EventoListado[];
        meta: { total: number };
      }>();
      expect(fallidas.datos.map((e) => e.id)).toEqual([mala.eventoId]);
      expect(fallidas.meta.total).toBe(1);
      expect((await get('/eventos-acceso?ejecucion=inventada', adminA)).statusCode).toBe(400);
    });

    it('A no ve las ejecuciones de B ni el detalle de un evento de B (404)', async () => {
      const deB = await validar(b, b.dispositivoPrincipal, b.puertaPrincipal.id);
      await confirmar(b.dispositivoPrincipal, { evento_id: deB.eventoId, resultado: 'fallida' });

      const listadoA = (await get('/eventos-acceso?ejecucion=fallida', adminA)).json<{
        datos: EventoListado[];
      }>();
      expect(listadoA.datos).toEqual([]);
      const ajeno = await get(`/eventos-acceso/${deB.eventoId}`, adminA);
      expect(ajeno.statusCode).toBe(404);
      expect(ajeno.json<Problema>().code).toBe('evento.no_encontrado');
      expect((await get(`/eventos-acceso/${deB.eventoId}`, adminB)).statusCode).toBe(200);
    });

    it('el detalle muestra la cadena de lo que se supo y no lleva datos sensibles', async () => {
      const { eventoId } = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      await confirmar(a.dispositivoPrincipal, {
        evento_id: eventoId,
        resultado: 'fallida',
        causa: 'puerta_no_cerro',
      });
      const respuesta = await get(`/eventos-acceso/${eventoId}`, adminA);
      expect(respuesta.statusCode).toBe(200);
      const detalle = respuesta.json<EventoDetallado>();
      expect(detalle).toMatchObject({
        id: eventoId,
        resultado: 'permitido',
        ejecucion: 'fallida',
        confirmaciones: [{ origen: 'placa', resultado: 'fallida', causa: 'puerta_no_cerro' }],
      });
      expect(respuesta.body).not.toMatch(/token|clave|hash/i);
    });

    it('el detalle respeta el alcance del rol: un Miembro solo ve los eventos de sus QR', async () => {
      const propio = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const qrAjeno = await crearQr(prueba.pool, a.cuenta, a.administrador.id, [
        a.puertaPrincipal.id,
      ]);
      const ajeno = (
        await prueba.app.inject({
          method: 'POST',
          url: '/api/v1/dispositivos/validaciones',
          headers: { authorization: a.dispositivoPrincipal.encabezado },
          payload: { token: qrAjeno.texto },
        })
      ).json<Validacion>();
      const miembro = (await iniciarSesion(prueba.app, a.usuario.pin)).acceso;
      expect((await get(`/eventos-acceso/${propio.eventoId}`, miembro)).statusCode).toBe(200);
      expect((await get(`/eventos-acceso/${ajeno.evento_id}`, miembro)).statusCode).toBe(404);
    });

    it('el panel de plataforma ve la ejecución y su causa, y filtra las que fallan', async () => {
      const sa = await crearSuperAdmin(prueba.pool, 'lucia.paz');
      const { acceso } = await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena);
      const deA = await validar(a, a.dispositivoPrincipal, a.puertaPrincipal.id);
      const deB = await validar(b, b.dispositivoPrincipal, b.puertaPrincipal.id);
      await confirmar(a.dispositivoPrincipal, { evento_id: deA.eventoId, resultado: 'ejecutada' });
      await confirmar(b.dispositivoPrincipal, {
        evento_id: deB.eventoId,
        resultado: 'fallida',
        causa: 'rele_no_accionado',
      });

      interface Fila {
        id: string;
        ejecucion: string | null;
        ejecucion_causa: string | null;
        cuenta: { id: string };
      }
      const todos = (await get('/plataforma/eventos-acceso', acceso)).json<{ datos: Fila[] }>()
        .datos;
      expect(todos.find((e) => e.id === deA.eventoId)).toMatchObject({
        ejecucion: 'ejecutada',
        ejecucion_causa: 'puerta_abrio',
      });
      const fallidas = (await get('/plataforma/eventos-acceso?ejecucion=fallida', acceso)).json<{
        datos: Fila[];
      }>().datos;
      expect(fallidas).toHaveLength(1);
      expect(fallidas[0]).toMatchObject({
        id: deB.eventoId,
        ejecucion: 'fallida',
        ejecucion_causa: 'rele_no_accionado',
        cuenta: { id: b.cuenta.id },
      });
      // Un token de cuenta no entra al panel de plataforma.
      expect((await get('/plataforma/eventos-acceso', adminA)).statusCode).toBe(401);
    });
  });
});
