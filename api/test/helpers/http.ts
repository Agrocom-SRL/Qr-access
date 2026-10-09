import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';

export interface Sesion {
  acceso: string;
  refresco: string;
  rol_activo_id: string | null;
}

/** Inicia sesión con un PIN y devuelve los tokens; falla si no entra. */
export async function iniciarSesion(app: FastifyInstance, pin: string): Promise<Sesion> {
  const respuesta = await app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { pin } });
  expect(respuesta.statusCode, respuesta.body).toBe(200);
  return respuesta.json<Sesion>();
}

export function conUsuario(sesion: Pick<Sesion, 'acceso'>): { authorization: string } {
  return { authorization: `Bearer ${sesion.acceso}` };
}

export interface Problema {
  code: string;
  status: number;
}
