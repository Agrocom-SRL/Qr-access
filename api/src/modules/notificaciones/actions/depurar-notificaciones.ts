import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import {
  RepositorioDeCola,
  RepositorioDeColaDeTodas,
  RepositorioDeNotificaciones,
  RepositorioDeNotificacionesDePlataforma,
  RepositorioDeNotificacionesDeTodas,
} from '../repository.js';

/** Cuánto vive una notificación ya cerrada antes de salir de la base (supuesto de la ola W9). */
export const DIAS_DE_RETENCION_DE_NOTIFICACIONES = 90;
/** Cuánto vive un mensaje de la cola ya resuelto (entregado, omitido o fallido). */
export const DIAS_DE_RETENCION_DE_COLA = 30;
const LOTE = 500;

/**
 * Retención: da de baja (soft delete, invariante 8) las notificaciones cerradas con más de 90 días y los mensajes
 * de la cola ya resueltos con más de 30. Un incidente abierto nunca se depura. Devuelve cuántas filas retiró.
 */
export async function ejecutar(pool: Pool, ahora: Date = new Date()): Promise<number> {
  let retiradas = 0;
  const notificaciones = await new RepositorioDeNotificacionesDeTodas(pool).viejas(
    sumarDias(ahora, -DIAS_DE_RETENCION_DE_NOTIFICACIONES),
    LOTE,
  );
  for (const fila of notificaciones) {
    if (fila.tenant_id === null) {
      const repositorio = new RepositorioDeNotificacionesDePlataforma(pool);
      await enTransaccion(pool, async (tx) => {
        await repositorio.depurar(tx, fila.id);
      });
    } else {
      await ContextoCuenta.ejecutarEn(fila.tenant_id, () =>
        enTransaccion(pool, async (tx) => {
          await new RepositorioDeNotificaciones(pool).depurar(tx, fila.id);
        }),
      );
    }
    retiradas += 1;
  }
  const mensajes = await new RepositorioDeColaDeTodas(pool).viejos(
    sumarDias(ahora, -DIAS_DE_RETENCION_DE_COLA),
    LOTE,
  );
  for (const fila of mensajes) {
    await ContextoCuenta.ejecutarEn(fila.tenant_id, () =>
      enTransaccion(pool, async (tx) => {
        await new RepositorioDeCola(pool).depurar(tx, fila.id);
      }),
    );
    retiradas += 1;
  }
  return retiradas;
}
