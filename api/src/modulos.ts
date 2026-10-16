import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { rutas as rutasDeAccesos } from './modules/accesos/routes.js';
import { rutas as rutasDeBitacora } from './modules/bitacora/routes.js';
import { crearAutenticadorDeDispositivo } from './modules/dispositivos/contracts.js';
import { rutas as rutasDeDispositivos } from './modules/dispositivos/routes.js';
import { rutas as rutasDeOrganizacion } from './modules/organizacion/routes.js';
import {
  crearAutenticadorDePlataforma,
  crearAutenticadorDeUsuario,
} from './modules/seguridad/contracts.js';
import { rutas as rutasDeResumen } from './modules/resumen/routes.js';
import { rutas as rutasDeSeguridad } from './modules/seguridad/routes.js';
import { rutas as rutasDeSuscripciones } from './modules/suscripciones/routes.js';
import type { DependenciasDeModulo } from './platform/http/dependencias.js';
import type { Autenticadores } from './platform/seguridad/principal.js';

export interface ModuloRegistrado {
  readonly nombre: string;
  readonly rutas: (dependencias: DependenciasDeModulo) => FastifyPluginCallbackZod;
}

/**
 * El único registro de módulos (ADR 0019): agregar uno es su carpeta más una línea acá.
 */
export const MODULOS: readonly ModuloRegistrado[] = [
  { nombre: 'seguridad', rutas: rutasDeSeguridad },
  { nombre: 'organizacion', rutas: rutasDeOrganizacion },
  { nombre: 'accesos', rutas: rutasDeAccesos },
  { nombre: 'dispositivos', rutas: rutasDeDispositivos },
  { nombre: 'suscripciones', rutas: rutasDeSuscripciones },
  { nombre: 'bitacora', rutas: rutasDeBitacora },
  { nombre: 'resumen', rutas: rutasDeResumen },
];

/** Cómo se autentica un usuario, un super admin y un dispositivo: lo aportan sus módulos, el plugin solo los usa. */
export function crearAutenticadores(dependencias: DependenciasDeModulo): Autenticadores {
  const autenticarUsuario = crearAutenticadorDeUsuario(dependencias);
  const autenticarDispositivo = crearAutenticadorDeDispositivo(dependencias);
  const autenticarPlataforma = crearAutenticadorDePlataforma(dependencias);
  return {
    autenticarUsuario: (jwt) => autenticarUsuario(jwt),
    autenticarDispositivo: (id, clave) => autenticarDispositivo(id, clave),
    autenticarPlataforma: (jwt) => autenticarPlataforma(jwt),
  };
}
