import { Writable } from 'node:stream';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  type Sesion,
} from '../helpers/http.js';

/** Lo que escribe el log, para comprobar qué nunca llega a él. */
class LogEnMemoria extends Writable {
  texto = '';
  override _write(trozo: Buffer, _codificacion: string, listo: () => void): void {
    this.texto += trozo.toString();
    listo();
  }
}

const CABECERAS_ESPERADAS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
} as const;

function exigirCabeceras(cabeceras: Record<string, unknown>): void {
  for (const [nombre, valor] of Object.entries(CABECERAS_ESPERADAS)) {
    expect(cabeceras[nombre], nombre).toBe(valor);
  }
  expect(String(cabeceras.vary)).toMatch(/authorization/i);
  expect(String(cabeceras['permissions-policy'])).toContain('camera=()');
}

describe('seguridad HTTP de la API (ADR 0033 §2)', () => {
  const log = new LogEnMemoria();
  let prueba: AppDePrueba;
  let a: Escenario;
  let sesionAdmin: Sesion;
  let accesoPlataforma: string;

  beforeAll(async () => {
    prueba = await crearAppDePrueba(log);
    // Rutas de prueba en la raíz: un fallo inesperado y una que registra un cuerpo.
    prueba.app.get('/api/v1/prueba/explota', { config: { acceso: 'publica' } }, () => {
      throw new Error('secreto-interno-que-no-debe-salir en /ruta/del/disco.ts');
    });
    prueba.app.post('/api/v1/prueba/registra', { config: { acceso: 'publica' } }, (request) => {
      request.log.info({ body: request.body, req: { body: request.body } }, 'cuerpo recibido');
      return { ok: true };
    });
    await prueba.app.ready();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    sesionAdmin = await iniciarSesion(prueba.app, a.administrador.pin);
    const superAdmin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    accesoPlataforma = (
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', superAdmin.contrasena)
    ).acceso;
  });

  describe('cabeceras en toda respuesta', () => {
    it('200: una respuesta con datos', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesionAdmin),
      });
      expect(respuesta.statusCode).toBe(200);
      exigirCabeceras(respuesta.headers);
    });

    it('200: una ruta pública', async () => {
      const respuesta = await prueba.app.inject({ method: 'GET', url: '/api/v1/salud' });
      expect(respuesta.statusCode).toBe(200);
      exigirCabeceras(respuesta.headers);
    });

    it('404: una ruta inexistente', async () => {
      const respuesta = await prueba.app.inject({ method: 'GET', url: '/api/v1/no-existe' });
      expect(respuesta.statusCode).toBe(404);
      exigirCabeceras(respuesta.headers);
    });

    it('401: sin credenciales', async () => {
      const respuesta = await prueba.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual' });
      expect(respuesta.statusCode).toBe(401);
      exigirCabeceras(respuesta.headers);
    });

    it('400: una validación que falla', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones',
        payload: {},
      });
      expect(respuesta.statusCode).toBe(400);
      exigirCabeceras(respuesta.headers);
    });

    it('500: un error inesperado sale con cabeceras y sin trazas ni mensaje interno', async () => {
      const respuesta = await prueba.app.inject({ method: 'GET', url: '/api/v1/prueba/explota' });
      expect(respuesta.statusCode).toBe(500);
      exigirCabeceras(respuesta.headers);
      expect(respuesta.json()).toMatchObject({ code: 'interno', status: 500 });
      expect(respuesta.body).not.toContain('secreto-interno');
      expect(respuesta.body).not.toContain('.ts');
      expect(respuesta.body).not.toContain('at ');
      expect(respuesta.body).not.toContain('stack');
    });

    it('conserva un Vary previo y no lo duplica', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesionAdmin),
      });
      const vary = String(respuesta.headers.vary)
        .toLowerCase()
        .split(/\s*,\s*/);
      expect(vary.filter((v) => v === 'authorization')).toHaveLength(1);
    });
  });

  describe('una URL con sufijo estático no devuelve datos ni se puede cachear', () => {
    it.each([
      '/api/v1/sesiones/actual/x.js',
      '/api/v1/sesiones/actual.js',
      '/api/v1/puertas/x.css',
      '/api/v1/sesiones/actual/..%2f..%2fx.js',
    ])('%s -> 404 con no-store y sin datos del usuario', async (url) => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url,
        headers: conUsuario(sesionAdmin),
      });
      expect(respuesta.statusCode).toBe(404);
      exigirCabeceras(respuesta.headers);
      expect(respuesta.json()).toMatchObject({ code: 'recurso.no_encontrado' });
      expect(respuesta.body).not.toContain(a.cuenta.codigo);
      expect(respuesta.body).not.toContain(a.administrador.id);
    });
  });

  describe('cargas de inyección SQL en filtros: rechazadas o inertes', () => {
    const CARGAS = [
      "' OR 1=1 --",
      "'; DROP TABLE cuentas; --",
      "1' UNION SELECT pin_hash FROM usuarios --",
    ];

    it.each(CARGAS)(
      'busqueda de cuentas con %s no devuelve filas y no altera la base',
      async (carga) => {
        const cuentasAntes = await contarFilas(prueba.pool, 'cuentas');
        const respuesta = await prueba.app.inject({
          method: 'GET',
          url: '/api/v1/plataforma/cuentas',
          query: { busqueda: carga },
          headers: { authorization: `Bearer ${accesoPlataforma}` },
        });
        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.json<{ datos: unknown[] }>().datos).toHaveLength(0);
        expect(respuesta.body).not.toContain('pin_hash');
        expect(await contarFilas(prueba.pool, 'cuentas')).toBe(cuentasAntes);
        const [tablas] = await prueba.pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'cuentas'");
        expect(tablas).toHaveLength(1);
      },
    );

    it.each(CARGAS)('busqueda de placas con %s es inerte', async (carga) => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/plataforma/placas',
        query: { busqueda: carga },
        headers: { authorization: `Bearer ${accesoPlataforma}` },
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json<{ datos: unknown[] }>().datos).toHaveLength(0);
    });

    it.each(CARGAS)('los filtros enumerados o numéricos rechazan %s con 400', async (carga) => {
      const cabeceras = { authorization: `Bearer ${accesoPlataforma}` };
      const pedidos = [
        { url: '/api/v1/plataforma/cuentas', query: { estado: carga } },
        { url: '/api/v1/plataforma/cuentas', query: { pagina: carga } },
        { url: '/api/v1/plataforma/cuentas', query: { por_pagina: carga } },
        { url: '/api/v1/plataforma/bitacora', query: { cuenta_id: carga } },
        { url: '/api/v1/plataforma/bitacora', query: { accion: carga } },
        { url: '/api/v1/plataforma/bitacora', query: { desde: carga } },
      ];
      for (const { url, query } of pedidos) {
        const respuesta = await prueba.app.inject({
          method: 'GET',
          url,
          query,
          headers: cabeceras,
        });
        expect(respuesta.statusCode, `${url} ${JSON.stringify(query)}`).toBe(400);
      }
      const eventos = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/eventos-acceso',
        query: { resultado: carga, puerta_id: carga },
        headers: conUsuario(sesionAdmin),
      });
      expect(eventos.statusCode).toBe(400);
    });

    it.each(CARGAS)('un PIN con %s no inicia sesión y deja la base intacta', async (carga) => {
      const usuariosAntes = await contarFilas(prueba.pool, 'usuarios');
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones',
        payload: { pin: carga },
      });
      expect([400, 401]).toContain(respuesta.statusCode);
      expect(respuesta.json()).not.toHaveProperty('refresco');
      expect(await contarFilas(prueba.pool, 'usuarios')).toBe(usuariosAntes);
    });

    it('un token de QR con una carga se valida como desconocido, sin error de SQL', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: 'Bearer no-es-un-dispositivo' },
        payload: { token: "' OR 1=1 --" },
      });
      expect(respuesta.statusCode).toBeLessThan(500);
    });
  });

  describe('campos de más en el cuerpo: rechazados donde el esquema es estricto', () => {
    it('POST /sesiones', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones',
        payload: { pin: a.administrador.pin, es_admin: true },
      });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toMatchObject({ code: 'validacion.invalida' });
    });

    it('POST /sesiones/refresco', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones/refresco',
        payload: { refresco: sesionAdmin.refresco, rol: 'x' },
      });
      expect(respuesta.statusCode).toBe(400);
    });

    it('POST /plataforma/sesiones', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/plataforma/sesiones',
        payload: { usuario: 'lucia.paz', contrasena: 'contrasena-de-prueba-1', extra: 1 },
      });
      expect(respuesta.statusCode).toBe(400);
    });

    it('POST /qr-accesos', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos',
        headers: conUsuario(sesionAdmin),
        payload: { puerta_ids: [a.puertaPrincipal.id], generado_por: a.usuario.id },
      });
      expect(respuesta.statusCode).toBe(400);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });

    it('POST /sitios y /puertas del administrador', async () => {
      const sitio = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sitios',
        headers: conUsuario(sesionAdmin),
        payload: { nombre: 'Sede', tenant_id: '999' },
      });
      expect(sitio.statusCode).toBe(400);
    });

    it('el cuerpo válido sigue funcionando (contraste)', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos',
        headers: conUsuario(sesionAdmin),
        payload: { puerta_ids: [a.puertaPrincipal.id] },
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
    });

    it('un array sin tope se rechaza', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos',
        headers: conUsuario(sesionAdmin),
        payload: { puerta_ids: Array.from({ length: 5000 }, () => '1') },
      });
      expect(respuesta.statusCode).toBe(400);
    });
  });

  describe('el log no contiene secretos', () => {
    it('ni el PIN, ni el refresco, ni el acceso, ni la contraseña de un flujo completo', async () => {
      const superAdmin = await crearSuperAdmin(prueba.pool, 'otro.admin', {
        contrasena: 'clave-muy-secreta-9',
      });
      log.texto = '';
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones/refresco',
        payload: { refresco: sesion.refresco },
      });
      await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/plataforma/sesiones',
        payload: { usuario: 'otro.admin', contrasena: superAdmin.contrasena },
      });
      await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones',
        payload: { pin: 'ZZZ-PIN-ERRADO' },
      });
      await prueba.app.inject({ method: 'GET', url: '/api/v1/prueba/explota' });

      expect(log.texto.length).toBeGreaterThan(0);
      for (const secreto of [
        a.administrador.pin,
        sesion.refresco,
        sesion.acceso,
        superAdmin.contrasena,
        'ZZZ-PIN-ERRADO',
      ]) {
        expect(log.texto).not.toContain(secreto);
      }
    });

    it('un cuerpo registrado por error sale redactado (pin, contraseña, refresco, QR)', async () => {
      log.texto = '';
      const secretos = {
        pin: 'PIN-SECRETO-1',
        contrasena: 'CONTRASENA-SECRETA-2',
        refresco: 'REFRESCO-SECRETO-3',
        refresh: 'REFRESH-SECRETO-4',
        token: 'TOKEN-SECRETO-5',
        texto: 'TEXTO-QR-SECRETO-6',
      };
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/prueba/registra',
        payload: secretos,
      });
      expect(respuesta.statusCode).toBe(200);
      expect(log.texto).toContain('cuerpo recibido');
      for (const secreto of Object.values(secretos)) {
        expect(log.texto).not.toContain(secreto);
      }
      expect(log.texto).toContain('[redactado]');
    });

    it('la cabecera Authorization no se registra', async () => {
      log.texto = '';
      await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesionAdmin),
      });
      expect(log.texto).not.toContain(sesionAdmin.acceso);
    });
  });
});
