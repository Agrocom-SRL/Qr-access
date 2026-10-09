import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { rutas as rutasDeAccesos } from './modules/accesos/routes.js';
import { crearAutenticadorDeDispositivo } from './modules/dispositivos/contracts.js';
import { rutas as rutasDeDispositivos } from './modules/dispositivos/routes.js';
import { rutas as rutasDeOrganizacion } from './modules/organizacion/routes.js';
import { crearAutenticadorDeUsuario } from './modules/seguridad/contracts.js';
import { rutas as rutasDeSeguridad } from './modules/seguridad/routes.js';
import type { DependenciasDeModulo } from './platform/http/dependencias.js';
import type { Autenticadores } from './platform/seguridad/principal.js';

export interface ModuloRegistrado {
  readonly nombre: string;
  readonly rutas: (dependencias: DependenciasDeModulo) => FastifyPluginCallbackZod;
}

/**
 * El único registro de módulos (ADR 0019): agregar uno es su carpeta más una línea acá.
 * `suscripciones` no figura porque solo expone `contracts.ts`: no tiene rutas.
 */
export const MODULOS: readonly ModuloRegistrado[] = [
  { nombre: 'seguridad', rutas: rutasDeSeguridad },
  { nombre: 'organizacion', rutas: rutasDeOrganizacion },
  { nombre: 'accesos', rutas: rutasDeAccesos },
  { nombre: 'dispositivos', rutas: rutasDeDispositivos },
];

/** Cómo se autentica un usuario y un dispositivo: lo aportan sus módulos, el plugin solo los usa. */
export function crearAutenticadores(dependencias: DependenciasDeModulo): Autenticadores {
  const autenticarUsuario = crearAutenticadorDeUsuario(dependencias);
  const autenticarDispositivo = crearAutenticadorDeDispositivo(dependencias);
  return {
    autenticarUsuario: (jwt) => autenticarUsuario(jwt),
    autenticarDispositivo: (id, clave) => autenticarDispositivo(id, clave),
  };
}
