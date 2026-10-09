import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { ErrorDeDominio } from '../errores/error-de-dominio.js';

const respuestaSalud = z.object({ estado: z.literal('ok'), base: z.literal('ok') });

/** `GET /salud`: la usan Docker (healthcheck) y el monitoreo. No expone versiones ni datos. */
export function rutasSalud(pool: Pool): FastifyPluginCallbackZod {
  return (app, _opciones, listo) => {
    app.get(
      '/salud',
      { schema: { tags: ['plataforma'], response: { 200: respuestaSalud } } },
      async () => {
        try {
          await pool.query('SELECT 1');
        } catch {
          throw new ErrorDeDominio('salud.base_no_disponible', 503);
        }
        return { estado: 'ok', base: 'ok' } as const;
      },
    );
    listo();
  };
}
