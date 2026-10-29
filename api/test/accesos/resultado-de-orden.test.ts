import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearDispositivo,
  crearEscenario,
  marcarEnLinea,
  type DispositivoDePrueba,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';
import {
  confirmacionesDe,
  crearOrdenDePrueba,
  ENTORNO_DE_ORDENES,
  ordenDe,
} from '../helpers/ordenes.js';

/** `POST /dispositivos/ordenes/{id}/resultado` y el recorrido completo de una apertura manual (ADR 0035 §2 y §6). */
describe('POST /api/v1/dispositivos/ordenes/{id}/resultado: la placa informa cómo terminó (ADR 0035)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesion: Sesion;
  let segundaPlaca: DispositivoDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba(undefined, ENTORNO_DE_ORDENES);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    await prueba.pool.query("UPDATE dispositivos SET sentido = 'salida' WHERE id = ?", [
      a.dispositivoPrincipal.id,
    ]);
    segundaPlaca = await crearDispositivo(prueba.pool, a.cuenta, a.puertaPrincipal.id, {
      sentido: 'entrada',
    });
    for (const id of [a.dispositivoPrincipal.id, segundaPlaca.id, b.dispositivoPrincipal.id]) {
      await marcarEnLinea(prueba.pool, id);
    }
    sesion = await iniciarSesion(prueba.app, a.usuario.pin);
  });

  const informar = (placa: DispositivoDePrueba, ordenId: string, cuerpo: object) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/dispositivos/ordenes/${ordenId}/resultado`,
      headers: { authorization: placa.encabezado },
      payload: cuerpo,
    });

  /** Una orden que `dispositivoPrincipal` ya tomó (entregada). */
  const ordenTomada = (placa: DispositivoDePrueba = a.dispositivoPrincipal) =>
    crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
      estado: 'entregada',
      dispositivoId: placa.id,
    });

  describe('el informe de la placa que tomó la orden', () => {
    it('ejecutada: 204, la orden queda ejecutada y la confirmación cuelga de la lectura de la orden', async () => {
      const orden = await ordenTomada();

      const respuesta = await informar(a.dispositivoPrincipal, orden.id, {
        resultado: 'ejecutada',
        causa: 'puerta_abrio',
        reportado_en_dispositivo_at: '2026-11-10T15:00:00.000Z',
      });

      expect(respuesta.statusCode).toBe(204);
      expect(respuesta.body).toBe('');
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'ejecutada' });
      expect((await ordenDe(prueba.pool, orden.id))?.resuelta_at).toBeInstanceOf(Date);
      const filas = await confirmacionesDe(prueba.pool, orden.lecturaId);
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        evento_acceso_id: orden.lecturaId,
        tenant_id: a.cuenta.id,
        dispositivo_id: a.dispositivoPrincipal.id,
        puerta_id: a.puertaPrincipal.id,
        origen: 'placa',
        resultado: 'ejecutada',
        causa: 'puerta_abrio',
      });
      expect(filas[0]?.reportado_en_dispositivo_at).toEqual(new Date('2026-11-10T15:00:00.000Z'));
    });

    it('la causa es opcional: `ejecutada` solo ya vale', async () => {
      const orden = await ordenTomada();
      expect(
        (await informar(a.dispositivoPrincipal, orden.id, { resultado: 'ejecutada' })).statusCode,
      ).toBe(204);
      expect((await confirmacionesDe(prueba.pool, orden.lecturaId))[0]).toMatchObject({
        causa: 'puerta_abrio',
      });
    });

    for (const causa of ['puerta_no_abrio', 'puerta_no_cerro', 'rele_no_accionado'] as const) {
      it(`fallida (${causa}): la orden queda fallida y la confirmación guarda la causa`, async () => {
        const orden = await ordenTomada();

        const respuesta = await informar(a.dispositivoPrincipal, orden.id, {
          resultado: 'fallida',
          causa,
        });

        expect(respuesta.statusCode).toBe(204);
        expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'fallida' });
        expect((await confirmacionesDe(prueba.pool, orden.lecturaId))[0]).toMatchObject({
          resultado: 'fallida',
          causa,
          origen: 'placa',
        });
      });
    }

    it('fallida sin causa asume `puerta_no_abrio`, como la confirmación de un QR', async () => {
      const orden = await ordenTomada();
      await informar(a.dispositivoPrincipal, orden.id, { resultado: 'fallida' });
      expect((await confirmacionesDe(prueba.pool, orden.lecturaId))[0]).toMatchObject({
        causa: 'puerta_no_abrio',
      });
    });

    it('sin sensor: la orden queda EJECUTADA (el relé se accionó) y la confirmación dice sin_confirmacion/sin_sensor', async () => {
      const orden = await ordenTomada();

      const respuesta = await informar(a.dispositivoPrincipal, orden.id, {
        resultado: 'sin_confirmacion',
        causa: 'sin_sensor',
      });

      expect(respuesta.statusCode).toBe(204);
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'ejecutada' });
      expect((await confirmacionesDe(prueba.pool, orden.lecturaId))[0]).toMatchObject({
        resultado: 'sin_confirmacion',
        causa: 'sin_sensor',
        origen: 'placa',
      });
    });

    it('se acepta aunque el plazo de la orden ya corrió, mientras la placa la tenga tomada (el sensor tarda en ver)', async () => {
      const ahora = Date.now();
      const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
        estado: 'entregada',
        dispositivoId: a.dispositivoPrincipal.id,
        creadaAt: new Date(ahora - 20_000),
        venceAt: new Date(ahora - 5_000),
      });
      expect(
        (await informar(a.dispositivoPrincipal, orden.id, { resultado: 'ejecutada' })).statusCode,
      ).toBe(204);
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'ejecutada' });
    });
  });

  describe('idempotencia', () => {
    it('repetir el mismo informe responde 204 y no cambia nada ni duplica la confirmación', async () => {
      const orden = await ordenTomada();
      await informar(a.dispositivoPrincipal, orden.id, { resultado: 'ejecutada' });
      const resuelta = (await ordenDe(prueba.pool, orden.id))?.resuelta_at as Date;

      const otra = await informar(a.dispositivoPrincipal, orden.id, { resultado: 'ejecutada' });

      expect(otra.statusCode).toBe(204);
      expect(await confirmacionesDe(prueba.pool, orden.lecturaId)).toHaveLength(1);
      expect((await ordenDe(prueba.pool, orden.id))?.resuelta_at).toEqual(resuelta);
    });

    it('dos informes iguales a la vez: uno registra y el otro responde igual', async () => {
      const orden = await ordenTomada();
      const respuestas = await Promise.all([
        informar(a.dispositivoPrincipal, orden.id, { resultado: 'ejecutada' }),
        informar(a.dispositivoPrincipal, orden.id, { resultado: 'ejecutada' }),
      ]);
      expect(respuestas.map((r) => r.statusCode)).toEqual([204, 204]);
      expect(await confirmacionesDe(prueba.pool, orden.lecturaId)).toHaveLength(1);
    });

    it('un resultado DISTINTO sobre una orden ya resuelta es 409 orden.ya_resuelta: el primer informe es el que vale', async () => {
      const orden = await ordenTomada();
      await informar(a.dispositivoPrincipal, orden.id, { resultado: 'ejecutada' });

      const respuesta = await informar(a.dispositivoPrincipal, orden.id, {
        resultado: 'fallida',
        causa: 'puerta_no_abrio',
      });

      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('orden.ya_resuelta');
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'ejecutada' });
      expect(await confirmacionesDe(prueba.pool, orden.lecturaId)).toHaveLength(1);
    });
  });

  describe('quién puede informar', () => {
    it('otra placa de la misma puerta no puede resolver una orden que tomó la primera', async () => {
      const orden = await ordenTomada(a.dispositivoPrincipal);

      const respuesta = await informar(segundaPlaca, orden.id, { resultado: 'ejecutada' });

      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('orden.no_encontrada');
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'entregada' });
      expect(await confirmacionesDe(prueba.pool, orden.lecturaId)).toHaveLength(0);
    });

    it('una orden que nadie tomó todavía (pendiente) no se puede resolver', async () => {
      const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id);
      const respuesta = await informar(a.dispositivoPrincipal, orden.id, {
        resultado: 'ejecutada',
      });
      expect(respuesta.statusCode).toBe(404);
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'pendiente' });
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });

    it('la placa de otra puerta de la misma cuenta es 404', async () => {
      const orden = await ordenTomada();
      const respuesta = await informar(a.dispositivoTrasero, orden.id, { resultado: 'ejecutada' });
      expect(respuesta.statusCode).toBe(404);
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'entregada' });
    });

    it('la placa de OTRA cuenta pidiendo una orden de A es 404 (aislamiento)', async () => {
      const orden = await ordenTomada();
      const respuesta = await informar(b.dispositivoPrincipal, orden.id, {
        resultado: 'ejecutada',
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('orden.no_encontrada');
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'entregada' });
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });

    it('una orden inexistente es 404', async () => {
      const respuesta = await informar(a.dispositivoPrincipal, '999999', {
        resultado: 'ejecutada',
      });
      expect(respuesta.statusCode).toBe(404);
    });

    it('una orden vencida es 409 orden.vencida y no cambia', async () => {
      const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
        estado: 'vencida',
        dispositivoId: a.dispositivoPrincipal.id,
      });
      const respuesta = await informar(a.dispositivoPrincipal, orden.id, {
        resultado: 'ejecutada',
      });
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('orden.vencida');
      expect(await confirmacionesDe(prueba.pool, orden.lecturaId)).toHaveLength(0);
    });

    it('sin credencial, o con la sesión de un usuario, es 401', async () => {
      const orden = await ordenTomada();
      const url = `/api/v1/dispositivos/ordenes/${orden.id}/resultado`;
      const payload = { resultado: 'ejecutada' };
      expect((await prueba.app.inject({ method: 'POST', url, payload })).statusCode).toBe(401);
      expect(
        (await prueba.app.inject({ method: 'POST', url, payload, headers: conUsuario(sesion) }))
          .statusCode,
      ).toBe(401);
    });
  });

  describe('cuerpo estricto', () => {
    it('rechaza un campo que no existe, un par resultado/causa inválido y un resultado desconocido (400)', async () => {
      const orden = await ordenTomada();
      for (const cuerpo of [
        { resultado: 'ejecutada', sentido: 'entrada' },
        { resultado: 'ejecutada', causa: 'puerta_no_abrio' },
        { resultado: 'fallida', causa: 'puerta_abrio' },
        { resultado: 'fallida', causa: 'sin_respuesta' },
        { resultado: 'sin_confirmacion', causa: 'puerta_abrio' },
        { resultado: 'exito' },
        {},
      ]) {
        const respuesta = await informar(a.dispositivoPrincipal, orden.id, cuerpo);
        expect(respuesta.statusCode, JSON.stringify(cuerpo)).toBe(400);
      }
      expect(await ordenDe(prueba.pool, orden.id)).toMatchObject({ estado: 'entregada' });
    });

    it('un id que no es numérico es 400', async () => {
      expect(
        (await informar(a.dispositivoPrincipal, 'abc', { resultado: 'ejecutada' })).statusCode,
      ).toBe(400);
    });

    it('una hora del dispositivo absurda se ignora (sin NTP) y el informe igual se registra', async () => {
      const orden = await ordenTomada();
      await informar(a.dispositivoPrincipal, orden.id, {
        resultado: 'ejecutada',
        reportado_en_dispositivo_at: '1970-01-01T00:00:00Z',
      });
      expect(
        (await confirmacionesDe(prueba.pool, orden.lecturaId))[0]?.reportado_en_dispositivo_at,
      ).toBeNull();
    });
  });

  describe('recorrido completo: abrir, la placa recibe, informa y la app lo ve', () => {
    const abrir = () =>
      prueba.app.inject({
        method: 'POST',
        url: `/api/v1/puertas/${a.puertaPrincipal.id}/abrir`,
        headers: { ...conUsuario(sesion), 'idempotency-key': randomUUID() },
      });
    const estadoEnLaApp = (id: string, con: Sesion = sesion) =>
      prueba.app.inject({
        method: 'GET',
        url: `/api/v1/ordenes-apertura/${id}`,
        headers: conUsuario(con),
      });

    it('abrir (202) -> la placa recibe (200) -> resultado ejecutada (204) -> la app ve ejecutada y la confirmación', async () => {
      const creada = await abrir();
      expect(creada.statusCode).toBe(202);
      const { orden_id: ordenId } = creada.json<{ orden_id: string }>();
      expect((await estadoEnLaApp(ordenId)).json()).toMatchObject({
        estado: 'pendiente',
        resultado: null,
      });

      const recibida = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/dispositivos/ordenes',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
      });
      expect(recibida.statusCode).toBe(200);
      expect(recibida.json<{ orden_id: string }>().orden_id).toBe(ordenId);
      expect((await estadoEnLaApp(ordenId)).json()).toMatchObject({ estado: 'entregada' });

      const informe = await informar(a.dispositivoPrincipal, ordenId, {
        resultado: 'ejecutada',
        causa: 'puerta_abrio',
      });
      expect(informe.statusCode).toBe(204);

      const final = await estadoEnLaApp(ordenId);
      expect(final.statusCode).toBe(200);
      expect(final.json()).toMatchObject({
        orden_id: ordenId,
        puerta_id: a.puertaPrincipal.id,
        estado: 'ejecutada',
        resultado: { resultado: 'ejecutada', causa: 'puerta_abrio' },
      });

      // La lectura de la petición ahora muestra su ejecución,.
      const lecturas = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/lecturas',
        headers: conUsuario(sesion),
      });
      expect(
        lecturas.json<{ datos: { metodo: string; ejecucion: string | null }[] }>().datos[0],
      ).toMatchObject({
        metodo: 'manual',
        ejecucion: 'ejecutada',
      });
    });

    it('si la placa informa una falla, la app ve fallida con su causa', async () => {
      const { orden_id: ordenId } = (await abrir()).json<{ orden_id: string }>();
      await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/dispositivos/ordenes',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
      });
      await informar(a.dispositivoPrincipal, ordenId, {
        resultado: 'fallida',
        causa: 'rele_no_accionado',
      });
      expect((await estadoEnLaApp(ordenId)).json()).toMatchObject({
        estado: 'fallida',
        resultado: { resultado: 'fallida', causa: 'rele_no_accionado' },
      });
    });

    it('otro usuario de la cuenta y la cuenta B no ven la orden (404)', async () => {
      const { orden_id: ordenId } = (await abrir()).json<{ orden_id: string }>();
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      const deB = await iniciarSesion(prueba.app, b.usuario.pin);
      expect((await estadoEnLaApp(ordenId, admin)).statusCode).toBe(404);
      expect((await estadoEnLaApp(ordenId, deB)).statusCode).toBe(404);
    });
  });
});
