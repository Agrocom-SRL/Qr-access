import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ErrorDeDominio } from '../../src/platform/errores/error-de-dominio.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';

describe('errores RFC 9457', () => {
  let prueba: AppDePrueba;
  let app: FastifyInstance;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
    app = prueba.app;
    const conZod = app.withTypeProvider<ZodTypeProvider>();
    conZod.get('/prueba/dominio', () => {
      throw new ErrorDeDominio('qr.vencido', 422);
    });
    conZod.post(
      '/prueba/validacion',
      { schema: { body: z.object({ nombre: z.string().min(1) }) } },
      () => ({ ok: true }),
    );
    conZod.get('/prueba/inesperado', () => {
      throw new Error('detalle interno con un secreto');
    });
    await app.ready();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it('un ErrorDeDominio sale con su code y su status', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/prueba/dominio' });
    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.headers['content-type']).toContain('application/problem+json');
    expect(respuesta.json()).toEqual({
      type: 'https://acceso.agrocom.com.bo/errores/qr.vencido',
      title: 'qr.vencido',
      status: 422,
      code: 'qr.vencido',
    });
  });

  it('un body inválido sale como validacion.invalida con los campos', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/prueba/validacion',
      payload: { nombre: '' },
    });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toMatchObject({
      code: 'validacion.invalida',
      errores: [{ campo: '/nombre' }],
    });
  });

  it('una ruta inexistente sale como recurso.no_encontrado', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/v1/no-existe' });
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toMatchObject({ code: 'recurso.no_encontrado' });
  });

  it('un error inesperado sale como interno, sin filtrar su mensaje', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/prueba/inesperado' });
    expect(respuesta.statusCode).toBe(500);
    expect(respuesta.json()).toMatchObject({ code: 'interno' });
    expect(respuesta.body).not.toContain('secreto');
  });
});
