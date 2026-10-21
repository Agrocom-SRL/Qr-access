import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearSuperAdmin,
  type SuperAdminDePrueba,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

const BASE = '/api/v1/plataforma/cuentas';

interface CuentaCreadaDto {
  cuenta: { id: string; codigo: string; nombre: string };
  administrador: { id: string; etiqueta: string; pin: string };
  suscripcion: { desde: string; hasta: string; estado: string };
}

describe('plataforma: cuentas (A03, A04, A05)', () => {
  let prueba: AppDePrueba;
  let lucia: SuperAdminDePrueba;
  let headers: { authorization: string };
  let planIds: string[];

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT id FROM planes WHERE nombre LIKE '% usuarios' ORDER BY max_usuarios",
    );
    planIds = filas.map((fila) => String(fila.id));
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const nueva = (cambios: Record<string, unknown> = {}) => ({
    razon_social: 'Agrícola Guarayos S.A.',
    codigo: 'agu',
    nit: '2876501019',
    ciudad: 'Ascensión de Guarayos',
    contacto_nombre: 'Rodrigo Añez',
    contacto_apellido: 'Pérez',
    contacto_telefono: '7 712 4405',
    contacto_correo: 'rodrigo@guarayos.bo',
    plan_id: planIds[1],
    inicio: '2026-10-12',
    administrador_nombre: 'Rodrigo Añez',
    // Con el primer pago registrado, la cuenta nace activa; sin él, pendiente de pago.
    pago: { monto: 21_600, fecha_pago: '2026-10-12', medio: 'efectivo', referencia: 'R-1' },
    ...cambios,
  });

  const crear = (cuerpo: Record<string, unknown>) =>
    prueba.app.inject({ method: 'POST', url: BASE, headers, payload: cuerpo });

  describe('alta', () => {
    it('crea la cuenta completa y entrega el PIN del administrador una sola vez', async () => {
      const respuesta = await crear(nueva());
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const creada = respuesta.json<CuentaCreadaDto>();
      expect(creada.cuenta).toMatchObject({ codigo: 'AGU', nombre: 'Agrícola Guarayos S.A.' });
      expect(creada.administrador.pin).toMatch(/^AGU[A-Z0-9]{4}$/);
      expect(creada.suscripcion).toEqual({
        desde: '2026-10-12T04:00:00.000Z',
        hasta: '2027-10-12T04:00:00.000Z',
        estado: 'activa',
      });
      expect(respuesta.headers.location).toBe(`/api/v1/plataforma/cuentas/${creada.cuenta.id}`);
    });

    it('el administrador entra con su PIN y tiene todos los permisos de cuenta', async () => {
      const creada = (await crear(nueva())).json<CuentaCreadaDto>();
      const sesion = await iniciarSesion(prueba.app, creada.administrador.pin);
      const actual = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesion),
      });
      const cuerpo = actual.json<{
        roles: { nombre: string }[];
        permisos: string[];
        suscripcion: { plan: string } | null;
      }>();
      expect(cuerpo.roles.map((r) => r.nombre)).toEqual(['Administrador']);
      expect(cuerpo.permisos).toContain('seguridad.usuario.crear');
      expect(cuerpo.permisos).toContain('accesos.qr.emitir');
      expect(cuerpo.permisos.some((p) => p.startsWith('seguridad.cuenta'))).toBe(false);
      expect(cuerpo.suscripcion?.plan).toBe('200 usuarios');
    });

    it('trae los tres roles base y guarda los datos de la empresa', async () => {
      const creada = (await crear(nueva())).json<CuentaCreadaDto>();
      const [roles] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT nombre, protegido FROM roles WHERE tenant_id = ? ORDER BY nombre',
        [creada.cuenta.id],
      );
      expect(roles.map((r: RowDataPacket) => [String(r.nombre), Number(r.protegido)])).toEqual([
        ['Administrador', 1],
        ['Guardia', 0],
        ['Usuario', 0],
      ]);
      const [empresa] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT nit, ciudad, contacto_nombre, contacto_telefono FROM cuenta_datos_empresa WHERE tenant_id = ?',
        [creada.cuenta.id],
      );
      expect(empresa[0]).toMatchObject({ nit: '2876501019', ciudad: 'Ascensión de Guarayos' });
    });

    it('guarda el PIN hasheado, firma con el super admin y deja la bitácora sin secretos', async () => {
      const creada = (await crear(nueva())).json<CuentaCreadaDto>();
      const [usuarios] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT pin_hash, created_by FROM usuarios WHERE id = ?',
        [creada.administrador.id],
      );
      expect(String(usuarios[0]?.pin_hash)).toMatch(/^\$argon2id\$/);
      expect(String(usuarios[0]?.created_by)).toBe(lucia.id);
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT usuario_id, despues FROM bitacoras WHERE tenant_id = ? AND tabla = ?',
        [creada.cuenta.id, 'usuarios'],
      );
      expect(String(bitacora[0]?.usuario_id)).toBe(lucia.id);
      expect(JSON.stringify(bitacora[0]?.despues)).not.toContain(creada.administrador.pin);
      expect(JSON.stringify(bitacora[0]?.despues)).not.toContain('pin_hash');
    });

    it('rechaza un código repetido diciendo de quién es', async () => {
      await crear(nueva());
      const repetido = await crear(nueva({ razon_social: 'Otra S.R.L.' }));
      expect(repetido.statusCode).toBe(409);
      expect(repetido.json()).toMatchObject({
        code: 'cuenta.codigo_existente',
        cuenta: 'Agrícola Guarayos S.A.',
      });
    });

    it('rechaza un código inválido, un plan inexistente y un inicio mal escrito, sin crear nada', async () => {
      expect((await crear(nueva({ codigo: 'AG1' }))).json<Problema>().code).toBe(
        'cuenta.codigo_invalido',
      );
      expect((await crear(nueva({ plan_id: '999999' }))).json<Problema>().code).toBe(
        'plan.no_encontrado',
      );
      expect((await crear(nueva({ inicio: '12/10/2026' }))).statusCode).toBe(400);
      expect(await contarFilas(prueba.pool, 'cuentas')).toBe(0);
    });

    it('un usuario de otra cuenta no puede crear cuentas', async () => {
      const escenario = await crearEscenario(prueba.pool, 'ZZZ');
      const sesion = await iniciarSesion(prueba.app, escenario.administrador.pin);
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: BASE,
        headers: conUsuario(sesion),
        payload: nueva(),
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('código disponible', () => {
    const consultar = async (codigo: string, razon_social = '') =>
      (
        await prueba.app.inject({
          method: 'GET',
          url: `${BASE}/codigo-disponible`,
          headers,
          query: { codigo, razon_social },
        })
      ).json<{
        formato_valido: boolean;
        disponible: boolean;
        usado_por: string | null;
        sugerencias: string[];
      }>();

    it('libre: disponible y sin sugerencias', async () => {
      expect(await consultar('xyz')).toEqual({
        formato_valido: true,
        disponible: true,
        usado_por: null,
        sugerencias: [],
      });
    });

    it('ocupado: dice de quién es y sugiere códigos libres', async () => {
      await crear(nueva({ codigo: 'AGR', razon_social: 'Agroindustrial Norte' }));
      const respuesta = await consultar('agr', 'Agroindustrial Norte');
      expect(respuesta).toMatchObject({ disponible: false, usado_por: 'Agroindustrial Norte' });
      expect(respuesta.sugerencias.length).toBeGreaterThan(0);
      expect(respuesta.sugerencias).not.toContain('AGR');
    });

    it('formato inválido', async () => {
      expect(await consultar('A1')).toMatchObject({ formato_valido: false, disponible: false });
    });
  });

  describe('listado y detalle', () => {
    it('lista las cuentas con plan, usuarios, vencimiento y estado, y cuenta por estado', async () => {
      await crearEscenario(prueba.pool, 'AAA');
      await crear(nueva());
      const respuesta = await prueba.app.inject({ method: 'GET', url: BASE, headers });
      expect(respuesta.statusCode).toBe(200);
      const cuerpo = respuesta.json<{
        datos: {
          codigo: string;
          estado: string;
          usuarios_activos: number;
          plan: { nombre: string } | null;
        }[];
        meta: { total: number };
        conteos: { todas: number; activa: number; por_vencer: number };
      }>();
      expect(cuerpo.meta.total).toBe(2);
      const agu = cuerpo.datos.find((c) => c.codigo === 'AGU');
      expect(agu).toMatchObject({
        estado: 'activa',
        usuarios_activos: 1,
        plan: { nombre: '200 usuarios' },
      });
      expect(cuerpo.conteos.todas).toBe(2);
      expect(cuerpo.conteos.activa + cuerpo.conteos.por_vencer).toBe(2);
    });

    it('filtra por estado, busca sin tildes y pagina', async () => {
      await crearEscenario(prueba.pool, 'AAA');
      await crear(nueva());
      await crear(nueva({ codigo: 'FRO', razon_social: 'Frigorífico Oriente' }));
      const consulta = async (query: Record<string, string>) =>
        (await prueba.app.inject({ method: 'GET', url: BASE, headers, query })).json<{
          datos: { codigo: string }[];
          meta: { total: number; pagina: number };
        }>();
      expect((await consulta({ busqueda: 'frigorifico' })).datos.map((c) => c.codigo)).toEqual([
        'FRO',
      ]);
      expect((await consulta({ estado: 'activa' })).meta.total).toBe(2);
      const pagina2 = await consulta({ por_pagina: '2', pagina: '2' });
      expect(pagina2.datos).toHaveLength(1);
      expect(pagina2.meta).toMatchObject({ total: 3, pagina: 2 });
    });

    it('una cuenta con la suscripción vencida o suspendida se ve así en el listado', async () => {
      const a = await crearEscenario(prueba.pool, 'AAA');
      const b = await crearEscenario(prueba.pool, 'BBB');
      await prueba.pool.query(
        'UPDATE suscripciones SET hasta = DATE_SUB(NOW(), INTERVAL 2 DAY) WHERE tenant_id = ?',
        [a.cuenta.id],
      );
      await prueba.pool.query(
        "UPDATE suscripciones SET estado = 'suspendida' WHERE tenant_id = ?",
        [b.cuenta.id],
      );
      const cuerpo = (await prueba.app.inject({ method: 'GET', url: BASE, headers })).json<{
        datos: { codigo: string; estado: string }[];
        conteos: Record<string, number>;
      }>();
      expect(cuerpo.datos.find((c) => c.codigo === 'AAA')?.estado).toBe('vencida');
      expect(cuerpo.datos.find((c) => c.codigo === 'BBB')?.estado).toBe('suspendida');
      expect(cuerpo.conteos).toMatchObject({ vencida: 1, suspendida: 1 });
    });

    it('el detalle trae la empresa, el plan, el vencimiento y el uso', async () => {
      const creada = (await crear(nueva())).json<CuentaCreadaDto>();
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/${creada.cuenta.id}`,
        headers,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json()).toMatchObject({
        cuenta: { codigo: 'AGU', nombre: 'Agrícola Guarayos S.A.', activa: true },
        empresa: {
          nit: '2876501019',
          ciudad: 'Ascensión de Guarayos',
          contacto: 'Rodrigo Añez Pérez',
        },
        suscripcion: {
          plan: { nombre: '200 usuarios', cupo_usuarios: 200, precio_anual: 21600 },
          estado: 'activa',
        },
        uso: {
          usuarios_activos: 1,
          sitios: 0,
          puertas: 0,
          dispositivos_sin_conexion: 0,
          administradores: 1,
        },
      });
    });

    it('el detalle cuenta sitios, puertas y lectores sin conexión de ESA cuenta', async () => {
      const a = await crearEscenario(prueba.pool, 'AAA');
      await crearEscenario(prueba.pool, 'BBB');
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/${a.cuenta.id}`,
        headers,
      });
      expect(respuesta.json()).toMatchObject({
        uso: { sitios: 1, puertas: 2, dispositivos_sin_conexion: 2, administradores: 1 },
      });
    });

    it('sitios y puertas: agrupa por sitio con el estado de cada lector y nunca mezcla cuentas', async () => {
      const a = await crearEscenario(prueba.pool, 'AAA');
      await crearEscenario(prueba.pool, 'BBB');
      await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = NOW(3) WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/${a.cuenta.id}/sitios`,
        headers,
      });
      const { datos } = respuesta.json<{
        datos: {
          nombre: string;
          puertas: { nombre: string; dispositivo: { en_linea: boolean } | null }[];
        }[];
      }>();
      expect(datos.map((s) => s.nombre)).toEqual(['Sitio AAA']);
      expect(datos[0]?.puertas.map((p) => [p.nombre, p.dispositivo?.en_linea])).toEqual([
        ['Principal AAA', true],
        ['Trasera AAA', false],
      ]);
    });

    it('una cuenta inexistente da 404', async () => {
      for (const sufijo of ['', '/sitios']) {
        const respuesta = await prueba.app.inject({
          method: 'GET',
          url: `${BASE}/999999${sufijo}`,
          headers,
        });
        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('cuenta.no_encontrada');
      }
    });

    it('las rutas de cuentas piden un super admin autenticado', async () => {
      const respuesta = await prueba.app.inject({ method: 'GET', url: BASE });
      expect(respuesta.statusCode).toBe(401);
    });
  });
});
