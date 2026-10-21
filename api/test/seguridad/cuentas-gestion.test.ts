import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  respaldoDePago,
  type Problema,
} from '../helpers/http.js';

const BASE = '/api/v1/plataforma';

interface CuentaCreadaDto {
  cuenta: { id: string; codigo: string };
  administrador: { pin: string };
  suscripcion: { estado: string };
}

describe('plataforma: cuentas nuevas pendientes de pago, edición y baja', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };
  let planId: string;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT id FROM planes WHERE nombre LIKE '% usuarios' ORDER BY max_usuarios LIMIT 1",
    );
    planId = String(filas[0]?.id);
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const sinPago = (cambios: Record<string, unknown> = {}) => ({
    razon_social: 'Granja Los Pinos S.R.L.',
    codigo: 'GLP',
    nit: '1029384756',
    ciudad: 'Warnes',
    contacto_nombre: 'Ana Rojas',
    contacto_apellido: 'Pérez',
    contacto_telefono: '7 700 1122',
    contacto_correo: 'ana@granjalospinos.bo',
    plan_id: planId,
    inicio: '2026-10-12',
    administrador_nombre: 'Ana Rojas',
    ...cambios,
  });
  const crear = (cuerpo: Record<string, unknown>) =>
    prueba.app.inject({ method: 'POST', url: `${BASE}/cuentas`, headers, payload: cuerpo });
  const pagar = async (cuentaId: string, cuerpo: Record<string, unknown> = {}) =>
    prueba.app.inject({
      method: 'POST',
      url: `${BASE}/cuentas/${cuentaId}/pagos`,
      headers,
      payload: {
        tipo: 'alta',
        monto: 12_000,
        fecha_pago: '2026-10-14',
        medio: 'transferencia',
        referencia: 'TRF-1',
        ...(cuerpo.medio === 'efectivo' ? {} : await respaldoDePago(prueba.app, headers)),
        ...cuerpo,
      },
    });
  const cobranza = async (ventana: string) =>
    (
      await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/cobranza`,
        headers,
        query: { ventana },
      })
    ).json<{
      totales: { por_activar: { cuentas: number; monto: number } };
      conteos: { pendientes: number };
      datos: { cuenta: { codigo: string }; pago: string; estado: string }[];
    }>();

  describe('cuenta nueva sin pago', () => {
    it('nace pendiente de pago, aparece en cobranza "por activar" y no genera QR', async () => {
      const respuesta = await crear(sinPago());
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const creada = respuesta.json<CuentaCreadaDto>();
      expect(creada.suscripcion.estado).toBe('pendiente_pago');

      const pendientes = await cobranza('pendientes');
      expect(pendientes.conteos.pendientes).toBe(1);
      expect(pendientes.totales.por_activar.cuentas).toBe(1);
      expect(pendientes.datos.map((f) => [f.cuenta.codigo, f.pago, f.estado])).toEqual([
        ['GLP', 'por_activar', 'pendiente_pago'],
      ]);
      expect((await cobranza('d30')).datos).toEqual([]);

      const sesion = await iniciarSesion(prueba.app, creada.administrador.pin);
      const puertas = await prueba.app.inject({
        method: 'POST',
        url: `${BASE}/cuentas/${creada.cuenta.id}/sitios`,
        headers,
        payload: { nombre: 'Granja' },
      });
      expect(puertas.statusCode).toBe(201);
      const generar = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos',
        headers: conUsuario(sesion),
        payload: { puerta_ids: ['1'] },
      });
      expect([403, 404]).toContain(generar.statusCode);
    });

    it('con el pago de alta se activa y el año corre desde la fecha del pago', async () => {
      const creada = (await crear(sinPago())).json<CuentaCreadaDto>();

      const respuesta = await pagar(creada.cuenta.id);
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      expect(respuesta.json<{ tipo: string; vence_el: string }>()).toMatchObject({
        tipo: 'alta',
        vence_el: '2027-10-14T04:00:00.000Z',
      });

      const detalle = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/cuentas/${creada.cuenta.id}`,
        headers,
      });
      expect(detalle.json<{ suscripcion: { estado: string } }>().suscripcion.estado).toBe('activa');
      expect((await cobranza('pendientes')).datos).toEqual([]);
    });

    it('solo una cuenta pendiente acepta el pago de alta, y solo ese pago', async () => {
      const creada = (await crear(sinPago())).json<CuentaCreadaDto>();

      const renovacion = await pagar(creada.cuenta.id, { tipo: 'renovacion' });
      expect(renovacion.statusCode).toBe(422);
      expect(renovacion.json<Problema>().code).toBe('suscripcion.pendiente_de_pago');

      await pagar(creada.cuenta.id);
      const otraVez = await pagar(creada.cuenta.id);
      expect(otraVez.statusCode).toBe(422);
      expect(otraVez.json<Problema>().code).toBe('suscripcion.ya_activa');
    });

    it('una cuenta pendiente no se suspende ni cambia de plan hasta pagar', async () => {
      const creada = (await crear(sinPago())).json<CuentaCreadaDto>();
      const suspender = await prueba.app.inject({
        method: 'POST',
        url: `${BASE}/cuentas/${creada.cuenta.id}/suscripcion/suspension`,
        headers,
      });
      expect(suspender.statusCode).toBe(422);
      expect(suspender.json<Problema>().code).toBe('suscripcion.pendiente_de_pago');
    });

    it('con el pago incluido en el alta, nace activa y registra el pago', async () => {
      const respuesta = await crear(
        sinPago({
          pago: { monto: 12_000, fecha_pago: '2026-10-12', medio: 'efectivo', referencia: 'R-9' },
        }),
      );
      const creada = respuesta.json<CuentaCreadaDto>();
      expect(creada.suscripcion.estado).toBe('activa');
      const [pagos] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT tipo, medio FROM pagos WHERE tenant_id = ?',
        [creada.cuenta.id],
      );
      expect(pagos.map((p: RowDataPacket) => [String(p.tipo), String(p.medio)])).toEqual([
        ['alta', 'efectivo'],
      ]);
    });
  });

  describe('editar', () => {
    it('corrige la razón social, la empresa y la persona responsable, sin tocar el código', async () => {
      const creada = (await crear(sinPago())).json<CuentaCreadaDto>();
      const respuesta = await prueba.app.inject({
        method: 'PATCH',
        url: `${BASE}/cuentas/${creada.cuenta.id}`,
        headers,
        payload: {
          razon_social: 'Granja Los Pinos S.A.',
          nit: '1029384757',
          ciudad: 'Montero',
          contacto_nombre: 'Luis Soria',
          contacto_apellido: 'Pérez',
          contacto_telefono: '3 922 0011',
          contacto_correo: 'luis@granjalospinos.bo',
        },
      });
      expect(respuesta.statusCode, respuesta.body).toBe(204);

      const detalle = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/cuentas/${creada.cuenta.id}`,
        headers,
      });
      expect(detalle.json()).toMatchObject({
        cuenta: { codigo: 'GLP', nombre: 'Granja Los Pinos S.A.' },
        empresa: {
          nit: '1029384757',
          ciudad: 'Montero',
          contacto: 'Luis Soria Pérez',
          contacto_nombre: 'Luis Soria',
          contacto_apellido: 'Pérez',
          telefono: '3 922 0011',
          correo: 'luis@granjalospinos.bo',
        },
      });
    });

    it('acepta una cuenta sin NIT ni teléfono (quedan en null) y exige el apellido', async () => {
      const creada = (await crear(sinPago())).json<CuentaCreadaDto>();
      const url = `${BASE}/cuentas/${creada.cuenta.id}`;
      const base = {
        razon_social: 'Sin Datos S.A.',
        ciudad: 'Montero',
        contacto_nombre: 'Luis',
        contacto_apellido: 'Soria',
      };
      const sinOpcionales = await prueba.app.inject({
        method: 'PATCH',
        url,
        headers,
        payload: { ...base, nit: '', contacto_telefono: '' },
      });
      expect(sinOpcionales.statusCode, sinOpcionales.body).toBe(204);
      const detalle = await prueba.app.inject({ method: 'GET', url, headers });
      expect(detalle.json()).toMatchObject({
        empresa: { nit: null, telefono: null, contacto: 'Luis Soria' },
      });
      const ausentes = await prueba.app.inject({ method: 'PATCH', url, headers, payload: base });
      expect(ausentes.statusCode).toBe(204);
      const sinApellido = { ...base, contacto_apellido: undefined };
      const rechazada = await prueba.app.inject({
        method: 'PATCH',
        url,
        headers,
        payload: sinApellido,
      });
      expect(rechazada.statusCode).toBe(400);
    });

    it('rechaza datos inválidos y una cuenta que no existe', async () => {
      const creada = (await crear(sinPago())).json<CuentaCreadaDto>();
      const cuerpo = {
        razon_social: 'X S.A.',
        nit: '12',
        ciudad: 'Montero',
        contacto_nombre: 'Luis',
        contacto_apellido: 'Pérez',
        contacto_telefono: '3 922 0011',
      };
      const invalido = await prueba.app.inject({
        method: 'PATCH',
        url: `${BASE}/cuentas/${creada.cuenta.id}`,
        headers,
        payload: cuerpo,
      });
      expect(invalido.statusCode).toBe(400);
      const inexistente = await prueba.app.inject({
        method: 'PATCH',
        url: `${BASE}/cuentas/999999`,
        headers,
        payload: { ...cuerpo, nit: '1234567' },
      });
      expect(inexistente.statusCode).toBe(404);
      expect(inexistente.json<Problema>().code).toBe('cuenta.no_encontrada');
    });
  });

  describe('eliminar', () => {
    it('pide repetir el código; con él, da de baja la cuenta y nadie de ella vuelve a entrar', async () => {
      const creada = (await crear(sinPago())).json<CuentaCreadaDto>();
      const url = `${BASE}/cuentas/${creada.cuenta.id}`;

      const equivocado = await prueba.app.inject({
        method: 'DELETE',
        url,
        headers,
        payload: { codigo: 'XXX' },
      });
      expect(equivocado.statusCode).toBe(422);
      expect(equivocado.json<Problema>().code).toBe('cuenta.confirmacion_invalida');

      const baja = await prueba.app.inject({
        method: 'DELETE',
        url,
        headers,
        payload: { codigo: 'glp' },
      });
      expect(baja.statusCode, baja.body).toBe(204);
      expect((await prueba.app.inject({ method: 'GET', url, headers })).statusCode).toBe(404);
      const ingreso = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones',
        payload: { pin: creada.administrador.pin },
      });
      expect(ingreso.statusCode).toBe(401);

      // El soft delete conserva la fila y libera el código.
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT deleted_at FROM cuentas WHERE id = ?',
        [creada.cuenta.id],
      );
      expect(filas[0]?.deleted_at).not.toBeNull();
      expect((await crear(sinPago())).statusCode).toBe(201);
    });

    it('no toca a las demás cuentas', async () => {
      const otra = await crearEscenario(prueba.pool, 'ZZZ');
      const creada = (await crear(sinPago())).json<CuentaCreadaDto>();
      await prueba.app.inject({
        method: 'DELETE',
        url: `${BASE}/cuentas/${creada.cuenta.id}`,
        headers,
        payload: { codigo: 'GLP' },
      });
      const sesion = await iniciarSesion(prueba.app, otra.administrador.pin);
      expect(sesion.acceso).toBeTruthy();
    });
  });
});
