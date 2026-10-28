import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { rutasDeBandeja } from './rutas-de-bandeja.js';

/** Bandeja de notificaciones (ADR 0030 §6): la de la cuenta y la de AGROCOM. */
export function rutas({ pool }: DependenciasDeModulo): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.register(rutasDeBandeja(pool));
    listo();
  };
}
