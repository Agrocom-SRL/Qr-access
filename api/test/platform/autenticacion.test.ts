import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';

describe('plugin de autenticación: se falla cerrado', () => {
  let prueba: AppDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
    // Una ruta que olvida declarar su acceso exige un usuario, no queda abierta.
    prueba.app.get('/prueba/sin-declarar', () => ({ secreto: 'datos de una cuenta' }));
    await prueba.app.ready();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it('una ruta sin config.acceso responde 401 sin credenciales', async () => {
    const respuesta = await prueba.app.inject({ method: 'GET', url: '/prueba/sin-declarar' });
    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.body).not.toContain('datos de una cuenta');
  });

  it('una ruta inexistente sigue siendo 404 (RFC 9457)', async () => {
    const respuesta = await prueba.app.inject({ method: 'GET', url: '/api/v1/no-existe' });
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toMatchObject({ code: 'recurso.no_encontrado' });
  });

  it('el OpenAPI publica todos los endpoints del contrato V1', async () => {
    const documento = (
      await prueba.app.inject({ method: 'GET', url: '/api/v1/openapi.json' })
    ).json<{ paths: Record<string, Record<string, unknown>> }>();
    const rutas = Object.keys(documento.paths);
    for (const esperada of [
      '/api/v1/sesiones',
      '/api/v1/sesiones/refresco',
      '/api/v1/sesiones/rol-activo',
      '/api/v1/sesiones/actual',
      '/api/v1/puertas',
      '/api/v1/qr-accesos',
      '/api/v1/qr-accesos/{id}/anulacion',
      '/api/v1/eventos-acceso',
      '/api/v1/dispositivos/validaciones',
      '/api/v1/dispositivos/latidos',
      '/api/v1/dispositivos/configuracion',
    ]) {
      expect(rutas).toContain(esperada);
    }
  });
});
