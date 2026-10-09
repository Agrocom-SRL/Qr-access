import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearQr,
  crearUsuarioConPin,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Sesion } from '../helpers/http.js';
import { fechaIsoUtc } from '../helpers/esperados.js';

interface QrEmitido {
  id: string;
  texto: string;
  vence_at: string;
  etiqueta: string | null;
  puertas: { id: string; nombre: string }[];
}

interface QrListado {
  id: string;
  etiqueta: string | null;
  estado: string;
  vence_at: string;
  usado_at: string | null;
  anulado_at: string | null;
  created_at: string;
  puertas: { id: string; nombre: string }[];
}

describe('QR de acceso: emitir, listar y anular', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesionAdminA: Sesion;
  let sesionUsuarioA: Sesion;
  let sesionAdminB: Sesion;

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
    sesionAdminA = await iniciarSesion(prueba.app, a.administrador.pin);
    sesionUsuarioA = await iniciarSesion(prueba.app, a.usuario.pin);
    sesionAdminB = await iniciarSesion(prueba.app, b.administrador.pin);
  });

  const emitir = (sesion: Sesion, payload: object) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos',
      headers: conUsuario(sesion),
      payload,
    });
  const listar = (sesion: Sesion, consulta = '') =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/qr-accesos${consulta}`,
      headers: conUsuario(sesion),
    });
  const anular = (sesion: Sesion, id: string) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/qr-accesos/${id}/anulacion`,
      headers: conUsuario(sesion),
    });

  describe('POST /api/v1/qr-accesos', () => {
    it('emite un QR con el texto AQ1.<token> y guarda solo el hash', async () => {
      const respuesta = await emitir(sesionUsuarioA, {
        puerta_ids: [a.puertaPrincipal.id, a.puertaTrasera.id],
        etiqueta: '  Proveedor de gas ',
      });
      expect(respuesta.statusCode).toBe(201);
      const qr = respuesta.json<QrEmitido>();
      expect(qr.texto).toMatch(/^AQ1\.[A-Za-z0-9_-]{22}$/);
      expect(qr.etiqueta).toBe('Proveedor de gas');
      expect(qr.puertas).toEqual([
        { id: a.puertaPrincipal.id, nombre: 'Principal AAA' },
        { id: a.puertaTrasera.id, nombre: 'Trasera AAA' },
      ]);
      expect(new Date(qr.vence_at).getTime()).toBeGreaterThan(Date.now());
      expect(qr.vence_at).toMatch(/Z$/);

      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT * FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      const token = qr.texto.slice(4);
      expect(JSON.stringify(filas)).not.toContain(token);
      expect(filas[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(String(filas[0]?.emitido_por)).toBe(a.usuario.id);
      expect(String(filas[0]?.created_by)).toBe(a.usuario.id);
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT * FROM bitacoras WHERE tabla = 'qr_accesos' AND registro_id = ?",
        [qr.id],
      );
      expect(bitacora).toHaveLength(1);
      expect(JSON.stringify(bitacora)).not.toContain(token);
      expect(JSON.stringify(bitacora)).not.toContain(filas[0]?.token_hash);
    });

    it('el texto solo aparece en la emisión: el listado nunca lo devuelve', async () => {
      const emitido = (
        await emitir(sesionUsuarioA, { puerta_ids: [a.puertaPrincipal.id] })
      ).json<QrEmitido>();
      const lista = await listar(sesionUsuarioA);
      expect(lista.body).not.toContain(emitido.texto);
      expect(lista.body).not.toContain('texto');
    });

    it('por defecto vence al fin del día local del sitio (America/La_Paz), sin pasar el plan', async () => {
      const qr = (
        await emitir(sesionUsuarioA, { puerta_ids: [a.puertaPrincipal.id] })
      ).json<QrEmitido>();
      const vence = new Date(qr.vence_at);
      // La Paz es UTC-4 todo el año: el día local termina a las 04:00 UTC
      expect(vence.getUTCHours()).toBe(4);
      expect(vence.getUTCMinutes() + vence.getUTCSeconds() + vence.getUTCMilliseconds()).toBe(0);
      expect(vence.getTime() - Date.now()).toBeLessThanOrEqual(24 * 3_600_000);
    });

    it('el límite del plan recorta la vigencia máxima', async () => {
      await prueba.pool.query('UPDATE planes SET max_vigencia_qr_horas = 1');
      const qr = (
        await emitir(sesionUsuarioA, { puerta_ids: [a.puertaPrincipal.id] })
      ).json<QrEmitido>();
      expect(new Date(qr.vence_at).getTime() - Date.now()).toBeLessThanOrEqual(3_600_000);
    });

    it('acepta una vigencia menor y rechaza una mayor al máximo o ya vencida', async () => {
      const enUnaHora = new Date(Date.now() + 3_600_000).toISOString();
      const ok = await emitir(sesionUsuarioA, {
        puerta_ids: [a.puertaPrincipal.id],
        vence_at: enUnaHora,
      });
      expect(ok.statusCode).toBe(201);
      expect(ok.json<QrEmitido>().vence_at).toBe(enUnaHora);

      await prueba.pool.query('UPDATE planes SET max_vigencia_qr_horas = 1');
      const enDosDias = new Date(Date.now() + 48 * 3_600_000).toISOString();
      const excedida = await emitir(sesionUsuarioA, {
        puerta_ids: [a.puertaPrincipal.id],
        vence_at: enDosDias,
      });
      expect(excedida.statusCode).toBe(422);
      expect(excedida.json()).toMatchObject({ code: 'qr.vigencia_excedida' });

      const pasada = await emitir(sesionUsuarioA, {
        puerta_ids: [a.puertaPrincipal.id],
        vence_at: new Date(Date.now() - 1000).toISOString(),
      });
      expect(pasada.statusCode).toBe(422);
      expect(pasada.json()).toMatchObject({ code: 'qr.vigencia_invalida' });
    });

    it('aislamiento: una puerta de otra cuenta es un 404 y no emite nada', async () => {
      const respuesta = await emitir(sesionUsuarioA, {
        puerta_ids: [a.puertaPrincipal.id, b.puertaPrincipal.id],
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json()).toMatchObject({ code: 'puerta.no_encontrada' });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM qr_accesos',
      );
      expect(Number(filas[0]?.total)).toBe(0);
    });

    it('con la suscripción vencida no emite (403 suscripcion.vencida)', async () => {
      await prueba.pool.query(
        'UPDATE suscripciones SET hasta = NOW(3) - INTERVAL 1 DAY WHERE tenant_id = ?',
        [a.cuenta.id],
      );
      const respuesta = await emitir(sesionUsuarioA, { puerta_ids: [a.puertaPrincipal.id] });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json()).toMatchObject({ code: 'suscripcion.vencida' });
    });

    it('una cuenta sin suscripción tampoco emite, aunque otra sí tenga', async () => {
      await prueba.pool.query('DELETE FROM suscripciones WHERE tenant_id = ?', [a.cuenta.id]);
      expect(
        (await emitir(sesionUsuarioA, { puerta_ids: [a.puertaPrincipal.id] })).statusCode,
      ).toBe(403);
      expect((await emitir(sesionAdminB, { puerta_ids: [b.puertaPrincipal.id] })).statusCode).toBe(
        201,
      );
    });

    it('valida el cuerpo: sin puertas, etiqueta larga o ids inválidos', async () => {
      for (const payload of [
        {},
        { puerta_ids: [] },
        { puerta_ids: ['abc'] },
        { puerta_ids: [a.puertaPrincipal.id], etiqueta: 'x'.repeat(61) },
        { puerta_ids: [a.puertaPrincipal.id], vence_at: 'mañana' },
      ]) {
        const respuesta = await emitir(sesionUsuarioA, payload);
        expect(respuesta.statusCode, JSON.stringify(payload)).toBe(400);
        expect(respuesta.json()).toMatchObject({ code: 'validacion.invalida' });
      }
    });

    it('exige el permiso accesos.qr.emitir en el rol activo', async () => {
      await prueba.pool.query(
        'DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo = ? AND rp.rol_id = ?',
        ['accesos.qr.emitir', a.rolUsuarioId],
      );
      const respuesta = await emitir(sesionUsuarioA, { puerta_ids: [a.puertaPrincipal.id] });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json()).toMatchObject({ code: 'permiso.denegado' });
      expect(
        (await prueba.app.inject({ method: 'POST', url: '/api/v1/qr-accesos', payload: {} }))
          .statusCode,
      ).toBe(401);
    });
  });

  describe('GET /api/v1/qr-accesos', () => {
    it('lista con el estado derivado y filtra por estado', async () => {
      const { pool } = prueba;
      const ahora = Date.now();
      const vigente = await crearQr(pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const usado = await crearQr(pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
        usadoAt: new Date(ahora - 1000),
      });
      const vencido = await crearQr(pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
        venceAt: new Date(ahora - 1000),
      });
      const anulado = await crearQr(pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
        anuladoAt: new Date(ahora - 1000),
      });

      const todos = (await listar(sesionUsuarioA)).json<{
        datos: QrListado[];
        meta: { total: number };
      }>();
      expect(todos.meta.total).toBe(4);
      const estadoDe = (id: string) => todos.datos.find((qr) => qr.id === id)?.estado;
      expect(estadoDe(vigente.id)).toBe('vigente');
      expect(estadoDe(usado.id)).toBe('usado');
      expect(estadoDe(vencido.id)).toBe('vencido');
      expect(estadoDe(anulado.id)).toBe('anulado');

      for (const [estado, esperado] of [
        ['vigente', vigente.id],
        ['usado', usado.id],
        ['vencido', vencido.id],
        ['anulado', anulado.id],
      ] as const) {
        const filtrado = (await listar(sesionUsuarioA, `?estado=${estado}`)).json<{
          datos: QrListado[];
          meta: { total: number };
        }>();
        expect(
          filtrado.datos.map((qr) => qr.id),
          estado,
        ).toEqual([esperado]);
        expect(filtrado.meta.total).toBe(1);
      }
      expect((await listar(sesionUsuarioA, '?estado=otro')).statusCode).toBe(400);
    });

    it('trae sus campos del contrato y sus puertas', async () => {
      const emitido = (
        await emitir(sesionUsuarioA, { puerta_ids: [a.puertaPrincipal.id], etiqueta: 'Visita' })
      ).json<QrEmitido>();
      const [qr] = (await listar(sesionUsuarioA)).json<{ datos: QrListado[] }>().datos;
      expect(qr).toEqual({
        id: emitido.id,
        etiqueta: 'Visita',
        estado: 'vigente',
        vence_at: emitido.vence_at,
        usado_at: null,
        anulado_at: null,
        created_at: fechaIsoUtc(),
        puertas: [{ id: a.puertaPrincipal.id, nombre: 'Principal AAA' }],
      });
    });

    it('un usuario ve solo los suyos; con accesos.qr.ver_todos, todos los de la cuenta', async () => {
      await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      await crearQr(prueba.pool, a.cuenta, a.administrador.id, [a.puertaPrincipal.id]);
      expect((await listar(sesionUsuarioA)).json<{ meta: { total: number } }>().meta.total).toBe(1);
      expect((await listar(sesionAdminA)).json<{ meta: { total: number } }>().meta.total).toBe(2);
    });

    it('aislamiento: nunca aparecen los QR de otra cuenta', async () => {
      const deB = await crearQr(prueba.pool, b.cuenta, b.administrador.id, [b.puertaPrincipal.id]);
      await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const lista = (await listar(sesionAdminA)).json<{
        datos: QrListado[];
        meta: { total: number };
      }>();
      expect(lista.meta.total).toBe(1);
      expect(lista.datos.map((qr) => qr.id)).not.toContain(deB.id);
    });

    it('pagina por fecha de emisión, del más reciente al más antiguo', async () => {
      for (let i = 0; i < 3; i += 1)
        await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const pagina = (await listar(sesionUsuarioA, '?por_pagina=2&pagina=2')).json<{
        datos: QrListado[];
        meta: object;
      }>();
      expect(pagina.datos).toHaveLength(1);
      expect(pagina.meta).toEqual({ pagina: 2, por_pagina: 2, total: 3 });
    });
  });

  describe('POST /api/v1/qr-accesos/{id}/anulacion', () => {
    it('anula un QR vigente propio y lo devuelve anulado', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const respuesta = await anular(sesionUsuarioA, qr.id);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toMatchObject({
        id: qr.id,
        estado: 'anulado',
        anulado_at: fechaIsoUtc(),
      });
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT accion FROM bitacoras WHERE tabla = 'qr_accesos' AND registro_id = ?",
        [qr.id],
      );
      expect(bitacora.map((fila) => String(fila.accion))).toEqual(['actualizado']);
    });

    it('anular dos veces es inofensivo', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      expect((await anular(sesionUsuarioA, qr.id)).statusCode).toBe(200);
      expect((await anular(sesionUsuarioA, qr.id)).statusCode).toBe(200);
    });

    it('un QR ya usado no se anula: 409 qr.ya_usado', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
        usadoAt: new Date(),
      });
      const respuesta = await anular(sesionUsuarioA, qr.id);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toMatchObject({ code: 'qr.ya_usado' });
    });

    it('aislamiento: anular el QR de otra cuenta es un 404 y no lo toca', async () => {
      const deB = await crearQr(prueba.pool, b.cuenta, b.administrador.id, [b.puertaPrincipal.id]);
      const respuesta = await anular(sesionAdminA, deB.id);
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json()).toMatchObject({ code: 'qr.no_encontrado' });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT anulado_at FROM qr_accesos WHERE id = ?',
        [deB.id],
      );
      expect(filas[0]?.anulado_at).toBeNull();
      expect((await anular(sesionAdminA, '99999999')).statusCode).toBe(404);
    });

    it('un usuario no anula el QR de otro; un administrador (anular_todos) sí', async () => {
      const delAdmin = await crearQr(prueba.pool, a.cuenta, a.administrador.id, [
        a.puertaPrincipal.id,
      ]);
      const otro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'OT01', [a.rolUsuarioId]);
      const delOtro = await crearQr(prueba.pool, a.cuenta, otro.id, [a.puertaPrincipal.id]);

      expect((await anular(sesionUsuarioA, delAdmin.id)).statusCode).toBe(404);
      expect((await anular(sesionUsuarioA, delOtro.id)).statusCode).toBe(404);
      expect((await anular(sesionAdminA, delOtro.id)).statusCode).toBe(200);
    });

    it('un id mal formado es una validación inválida', async () => {
      expect((await anular(sesionUsuarioA, 'abc')).statusCode).toBe(400);
    });
  });

  it('la suscripción de la cuenta B no afecta a la A (cada cuenta la suya)', async () => {
    await prueba.pool.query(
      'UPDATE suscripciones SET hasta = NOW(3) - INTERVAL 1 DAY WHERE tenant_id = ?',
      [b.cuenta.id],
    );
    expect((await emitir(sesionUsuarioA, { puerta_ids: [a.puertaPrincipal.id] })).statusCode).toBe(
      201,
    );
    expect((await emitir(sesionAdminB, { puerta_ids: [b.puertaPrincipal.id] })).statusCode).toBe(
      403,
    );
  });
});
