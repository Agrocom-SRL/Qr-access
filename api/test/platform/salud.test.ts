import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';

describe('GET /api/v1/salud', () => {
  let prueba: AppDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  it('corre sobre la base de tests, nunca la de desarrollo', async () => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>('SELECT DATABASE() AS base');
    expect(String(filas[0]?.base)).toMatch(/_testing(_\d+)?$/);
  });

  it('responde ok cuando la base está disponible', async () => {
    const respuesta = await prueba.app.inject({ method: 'GET', url: '/api/v1/salud' });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: 'ok', base: 'ok' });
  });

  it('publica el OpenAPI 3.1 generado desde los esquemas', async () => {
    const respuesta = await prueba.app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(respuesta.statusCode).toBe(200);
    const documento = respuesta.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(documento.openapi).toBe('3.1.0');
    expect(documento.paths).toHaveProperty('/api/v1/salud');
  });
});
