import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearSuperAdmin,
  type Escenario,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  respaldoDePago,
  type Problema,
} from '../helpers/http.js';

const BASE = '/api/v1/plataforma';
const DIA = 86_400_000;

interface PlanDto {
  id: string;
  cupo_usuarios: number;
}

describe('plataforma: suscripción, pagos y cobranza (A05b, A06, A07, A08)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };
  let escenario: Escenario;
  let planes: Record<number, string>;
  let luciaId: string;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz', { nombre: 'Lucía Paz' });
    luciaId = lucia.id;
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    const lista = (
      await prueba.app.inject({ method: 'GET', url: `${BASE}/planes`, headers })
    ).json<{
      datos: PlanDto[];
    }>().datos;
    planes = Object.fromEntries(
      lista.filter((p) => p.cupo_usuarios).map((p) => [p.cupo_usuarios, p.id]),
    );
    escenario = await crearEscenario(prueba.pool, 'AAA');
    // La cuenta de prueba pasa al plan de 100 usuarios del catálogo y vence en 24 días.
    await prueba.pool.query(
      'UPDATE suscripciones SET plan_id = ?, desde = ?, hasta = ? WHERE tenant_id = ?',
      [
        planes[100],
        new Date(Date.now() - 341 * DIA),
        new Date(Date.now() + 24 * DIA),
        escenario.cuenta.id,
      ],
    );
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const url = (ruta: string) => `${BASE}/cuentas/${escenario.cuenta.id}${ruta}`;
  const pago = async (cuerpo: Record<string, unknown> = {}) =>
    prueba.app.inject({
      method: 'POST',
      url: url('/pagos'),
      headers,
      payload: {
        tipo: 'renovacion',
        monto: 12000,
        fecha_pago: '2026-10-12',
        medio: 'transferencia',
        referencia: 'TRF-912204',
        ...(cuerpo.medio === 'efectivo' ? {} : await respaldoDePago(prueba.app, headers)),
        ...cuerpo,
      },
    });
  const suscripcion = async () =>
    (await prueba.app.inject({ method: 'GET', url: url('/suscripcion'), headers })).json<{
      suscripcion: { hasta: string; estado: string; plan: { nombre: string } };
      proximo_pago: string | null;
      pagos: {
        tipo: string;
        monto: number;
        fecha_pago: string;
        referencia: string;
        registro: { nombre: string } | null;
        periodo_desde: string;
        periodo_hasta: string;
      }[];
    }>();

  async function hastaEnBase(): Promise<Date> {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT hasta FROM suscripciones WHERE tenant_id = ?',
      [escenario.cuenta.id],
    );
    return filas[0]?.hasta as Date;
  }

  describe('renovar y registrar pago', () => {
    it('extiende 12 meses desde el vencimiento actual y deja el pago en el historial', async () => {
      const antes = await hastaEnBase();
      const respuesta = await pago();
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const despues = await hastaEnBase();
      const esperado = new Date(antes.getTime());
      esperado.setUTCFullYear(esperado.getUTCFullYear() + 1);
      expect(despues.toISOString()).toBe(esperado.toISOString());
      expect(respuesta.json()).toMatchObject({
        tipo: 'renovacion',
        periodo_desde: antes.toISOString(),
        periodo_hasta: despues.toISOString(),
        vence_el: despues.toISOString(),
      });

      const vista = await suscripcion();
      expect(vista.pagos).toHaveLength(1);
      expect(vista.pagos[0]).toMatchObject({
        tipo: 'renovacion',
        monto: 12000,
        fecha_pago: '2026-10-12',
        referencia: 'TRF-912204',
        registro: { nombre: 'Lucía Paz' },
      });
    });

    it('firma con el super admin y deja la bitácora de la cuenta', async () => {
      await pago();
      const [pagos] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT created_by FROM pagos WHERE tenant_id = ?',
        [escenario.cuenta.id],
      );
      expect(String(pagos[0]?.created_by)).toBe(luciaId);
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT tabla, accion, usuario_id FROM bitacoras WHERE tenant_id = ? AND tabla IN ('pagos', 'suscripciones') ORDER BY id",
        [escenario.cuenta.id],
      );
      expect(bitacora.map((b: RowDataPacket) => [String(b.tabla), String(b.accion)])).toEqual([
        ['suscripciones', 'actualizado'],
        ['pagos', 'creado'],
      ]);
      expect(String(bitacora[0]?.usuario_id)).toBe(luciaId);
    });

    it('renovar una suscripción vencida suma 12 meses desde su vencimiento (README)', async () => {
      const vencio = new Date(Date.now() - 10 * DIA);
      await prueba.pool.query('UPDATE suscripciones SET hasta = ? WHERE tenant_id = ?', [
        vencio,
        escenario.cuenta.id,
      ]);
      expect((await suscripcion()).suscripcion.estado).toBe('vencida');
      await pago();
      const despues = await hastaEnBase();
      expect(despues.getTime() - vencio.getTime()).toBeGreaterThan(364 * DIA);
    });

    it('rechaza datos inválidos y no cambia nada', async () => {
      for (const cambio of [
        { monto: 0 },
        { monto: -5 },
        { monto: 10.123 },
        { medio: 'cheque' },
        { medio: 'deposito' },
        { fecha_pago: '12/10/2026' },
      ]) {
        expect((await pago(cambio)).statusCode).toBe(400);
      }
      expect(await contarFilas(prueba.pool, 'pagos')).toBe(0);
    });

    it('la referencia es opcional: sin ella el pago se registra con la referencia vacía', async () => {
      const respuesta = await pago({ referencia: undefined });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
    });

    it('una suscripción suspendida no se renueva hasta reactivarla', async () => {
      await prueba.app.inject({ method: 'POST', url: url('/suscripcion/suspension'), headers });
      const respuesta = await pago();
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('suscripcion.suspendida');
    });

    it('una cuenta inexistente da 404', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: `${BASE}/cuentas/999999/pagos`,
        headers,
        payload: {
          tipo: 'renovacion',
          monto: 1,
          fecha_pago: '2026-10-12',
          medio: 'efectivo',
          referencia: 'X',
        },
      });
      expect(respuesta.statusCode).toBe(404);
    });
  });

  describe('cambiar de plan (solo para mejorar)', () => {
    const cambiar = (plan_id: string | undefined) =>
      prueba.app.inject({
        method: 'PUT',
        url: url('/suscripcion/plan'),
        headers,
        payload: { plan_id },
      });

    it('sube a un plan mayor y devuelve la diferencia de precio a cobrar', async () => {
      const respuesta = await cambiar(planes[200]);
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json()).toMatchObject({
        plan: { nombre: '200 usuarios', cupo_usuarios: 200 },
        diferencia_precio: 9600,
      });
      expect((await suscripcion()).suscripcion.plan.nombre).toBe('200 usuarios');
    });

    it('nunca baja de plan, aunque la cuenta tenga pocos usuarios', async () => {
      await cambiar(planes[350]);
      const respuesta = await cambiar(planes[100]);
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('plan.solo_mejora');
      expect((await suscripcion()).suscripcion.plan.nombre).toBe('350 usuarios');
    });

    it('el mismo plan no es un cambio', async () => {
      expect((await cambiar(planes[100])).json<Problema>().code).toBe('plan.sin_cambio');
    });

    it('un plan inexistente da 404', async () => {
      expect((await cambiar('999999')).json<Problema>().code).toBe('plan.no_encontrado');
    });

    it('con la suscripción vencida o suspendida primero se renueva o se reactiva', async () => {
      await prueba.app.inject({ method: 'POST', url: url('/suscripcion/suspension'), headers });
      expect((await cambiar(planes[200])).json<Problema>().code).toBe('suscripcion.suspendida');
      await prueba.app.inject({ method: 'POST', url: url('/suscripcion/reactivacion'), headers });
      await prueba.pool.query('UPDATE suscripciones SET hasta = ? WHERE tenant_id = ?', [
        new Date(Date.now() - DIA),
        escenario.cuenta.id,
      ]);
      expect((await cambiar(planes[200])).json<Problema>().code).toBe('suscripcion.vencida');
    });

    it('la diferencia se cobra registrando un pago de mejora, que no cambia la vigencia', async () => {
      await cambiar(planes[200]);
      const antes = await hastaEnBase();
      const respuesta = await pago({ tipo: 'mejora_de_plan', monto: 9600 });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      expect((await hastaEnBase()).toISOString()).toBe(antes.toISOString());
      const vista = await suscripcion();
      expect(vista.pagos[0]).toMatchObject({ tipo: 'mejora_de_plan', monto: 9600 });
    });

    it('al subir de plan la cuenta puede crear más usuarios que el cupo anterior', async () => {
      const sesion = await iniciarSesion(prueba.app, escenario.administrador.pin);
      await prueba.pool.query('UPDATE planes SET max_usuarios = 2 WHERE id = ?', [planes[100]]);
      const crear = () =>
        prueba.app.inject({
          method: 'POST',
          url: '/api/v1/usuarios',
          headers: conUsuario(sesion),
          payload: {
            etiqueta: 'Nuevo',
            rol_ids: [escenario.rolTitularId],
            unidad: { sitio_id: escenario.sitioId, nombre: 'Casa 1' },
          },
        });
      expect((await crear()).json<Problema>().code).toBe('plan.limite_usuarios');
      await cambiar(planes[200]);
      expect((await crear()).statusCode).toBe(201);
    });
  });

  describe('suspender y reactivar', () => {
    it('suspendida, la cuenta no genera QR; reactivada, vuelve a generar', async () => {
      const sesion = await iniciarSesion(prueba.app, escenario.usuario.pin);
      const generar = () =>
        prueba.app.inject({
          method: 'POST',
          url: '/api/v1/qr-accesos',
          headers: conUsuario(sesion),
          payload: { puerta_ids: [escenario.puertaPrincipal.id] },
        });
      expect((await generar()).statusCode).toBe(201);
      const suspension = await prueba.app.inject({
        method: 'POST',
        url: url('/suscripcion/suspension'),
        headers,
      });
      expect(suspension.statusCode).toBe(204);
      const rechazado = await generar();
      expect(rechazado.statusCode).toBe(403);
      expect(rechazado.json<Problema>().code).toBe('suscripcion.vencida');
      expect((await suscripcion()).suscripcion.estado).toBe('suspendida');
      expect((await suscripcion()).proximo_pago).toBeNull();

      await prueba.app.inject({ method: 'POST', url: url('/suscripcion/reactivacion'), headers });
      expect((await generar()).statusCode).toBe(201);
    });

    it('es idempotente', async () => {
      for (let i = 0; i < 2; i += 1) {
        const respuesta = await prueba.app.inject({
          method: 'POST',
          url: url('/suscripcion/suspension'),
          headers,
        });
        expect(respuesta.statusCode).toBe(204);
      }
    });
  });

  describe('cobranza', () => {
    const cobranza = async (query: Record<string, string> = {}) =>
      (await prueba.app.inject({ method: 'GET', url: `${BASE}/cobranza`, headers, query })).json<{
        totales: {
          por_cobrar_30: { monto: number; cuentas: number };
          por_cobrar_90: { monto: number; cuentas: number };
          vencido_sin_pagar: { monto: number; cuentas: number };
          cobrado_anio: { monto: number; pagos: number };
        };
        conteos: { d30: number; d60: number; d90: number; vencidas: number; pendientes: number };
        datos: {
          cuenta: { codigo: string };
          monto: number;
          pago: string;
          dias_restantes: number;
        }[];
      }>();

    async function conVencimiento(codigo: string, dias: number, plan = planes[100]) {
      const otra = await crearEscenario(prueba.pool, codigo);
      await prueba.pool.query(
        'UPDATE suscripciones SET plan_id = ?, hasta = ? WHERE tenant_id = ?',
        [plan, new Date(Date.now() + dias * DIA), otra.cuenta.id],
      );
    }

    it('agrupa por ventana acumulativa, suma lo que se cobra y separa lo vencido', async () => {
      await conVencimiento('BBB', 45, planes[200]);
      await conVencimiento('CCC', 80, planes[350]);
      await conVencimiento('DDD', 200);
      await conVencimiento('EEE', -5);
      const resultado = await cobranza();
      expect(resultado.conteos).toEqual({ d30: 1, d60: 2, d90: 3, vencidas: 1, pendientes: 0 });
      expect(resultado.totales.por_cobrar_30).toEqual({ monto: 12000, cuentas: 1 });
      expect(resultado.totales.por_cobrar_90).toEqual({ monto: 12000 + 21600 + 33600, cuentas: 3 });
      expect(resultado.totales.vencido_sin_pagar).toEqual({ monto: 12000, cuentas: 1 });
      expect(resultado.datos.map((f) => [f.cuenta.codigo, f.pago])).toEqual([['AAA', 'pendiente']]);
    });

    it('la ventana elegida lista sus cuentas por vencimiento y las vencidas salen "sin pagar"', async () => {
      await conVencimiento('BBB', 45, planes[200]);
      await conVencimiento('EEE', -5);
      expect((await cobranza({ ventana: 'd60' })).datos.map((f) => f.cuenta.codigo)).toEqual([
        'AAA',
        'BBB',
      ]);
      const vencidas = await cobranza({ ventana: 'vencidas' });
      expect(vencidas.datos.map((f) => [f.cuenta.codigo, f.pago])).toEqual([['EEE', 'sin_pagar']]);
    });

    it('las suspendidas no se cobran', async () => {
      await prueba.app.inject({ method: 'POST', url: url('/suscripcion/suspension'), headers });
      const resultado = await cobranza();
      expect(resultado.conteos.d30).toBe(0);
      expect(resultado.totales.por_cobrar_30.cuentas).toBe(0);
    });

    it('busca por nombre o código', async () => {
      await conVencimiento('BBB', 10);
      expect((await cobranza({ busqueda: 'bbb' })).datos.map((f) => f.cuenta.codigo)).toEqual([
        'BBB',
      ]);
      expect((await cobranza({ busqueda: 'no existe' })).datos).toHaveLength(0);
    });

    it('lo cobrado en el año cuenta los pagos registrados', async () => {
      await pago({ monto: 12000, fecha_pago: `${String(new Date().getUTCFullYear())}-03-01` });
      await pago({
        monto: 500,
        tipo: 'mejora_de_plan',
        fecha_pago: `${String(new Date().getUTCFullYear())}-04-01`,
      });
      await pago({ monto: 999, tipo: 'mejora_de_plan', fecha_pago: '2001-01-01' });
      expect((await cobranza()).totales.cobrado_anio).toMatchObject({ monto: 12500, pagos: 2 });
    });
  });

  describe('aislamiento y permisos', () => {
    it('un usuario de una cuenta no ve ni toca la suscripción, los pagos ni la cobranza', async () => {
      const sesion = await iniciarSesion(prueba.app, escenario.administrador.pin);
      const peticiones = [
        { method: 'GET', url: url('/suscripcion') },
        { method: 'POST', url: url('/pagos') },
        { method: 'PUT', url: url('/suscripcion/plan') },
        { method: 'POST', url: url('/suscripcion/suspension') },
        { method: 'GET', url: `${BASE}/cobranza` },
      ] as const;
      for (const peticion of peticiones) {
        const respuesta = await prueba.app.inject({
          ...peticion,
          headers: conUsuario(sesion),
          payload: {},
        });
        expect(respuesta.statusCode, `${peticion.method} ${peticion.url}`).toBe(401);
      }
    });

    it('sin el permiso de plataforma correspondiente, 403', async () => {
      await prueba.pool.query(
        "DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo IN ('suscripciones.pago.registrar', 'suscripciones.cobranza.ver')",
      );
      const sesion = conUsuario(
        await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', 'contrasena-de-prueba-1'),
      );
      const registrar = await prueba.app.inject({
        method: 'POST',
        url: url('/pagos'),
        headers: sesion,
        payload: {
          tipo: 'renovacion',
          monto: 1,
          fecha_pago: '2026-10-12',
          medio: 'efectivo',
          referencia: 'X',
        },
      });
      expect(registrar.statusCode).toBe(403);
      const ver = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/cobranza`,
        headers: sesion,
      });
      expect(ver.statusCode).toBe(403);
    });
  });
});
