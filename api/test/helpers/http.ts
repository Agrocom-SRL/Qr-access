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

export interface SesionDePlataforma {
  acceso: string;
  refresco: string;
  debe_cambiar_contrasena: boolean;
  permisos: string[];
}

/** Ingresa como super admin (usuario + contraseña); falla si no entra. */
export async function iniciarSesionDePlataforma(
  app: FastifyInstance,
  usuario: string,
  contrasena: string,
): Promise<SesionDePlataforma> {
  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/v1/plataforma/sesiones',
    payload: { usuario, contrasena },
  });
  expect(respuesta.statusCode, respuesta.body).toBe(200);
  return respuesta.json<SesionDePlataforma>();
}

/** Los primeros bytes de un PNG: alcanza para que el servidor lo reconozca por su contenido. */
export const PNG_DE_PRUEBA = Buffer.from('89504e470d0a1a0a0000000d4948445200000001', 'hex');

/** Sube un comprobante y devuelve lo que un pago por transferencia o QR necesita (ADR 0024). */
export async function respaldoDePago(
  app: FastifyInstance,
  headers: { authorization: string },
): Promise<{ comprobante_id: string }> {
  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/v1/plataforma/comprobantes',
    headers: { ...headers, 'content-type': 'image/png' },
    payload: PNG_DE_PRUEBA,
  });
  expect(respuesta.statusCode, respuesta.body).toBe(201);
  return { comprobante_id: respuesta.json<{ id: string }>().id };
}
