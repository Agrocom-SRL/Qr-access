import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion, ESPERA_DE_BLOQUEO_DE_TAREA_S } from '../../../platform/db/transaccion.js';
import type { Transaccion } from '../../../platform/db/transaccion.js';
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
/** Filas que lee cada vuelta, y vueltas como máximo por pasada (lo que sobre se retira en la siguiente). */
const LOTE = 1000;
const VUELTAS_MAXIMAS = 10;

interface Fila {
  readonly id: string;
  readonly tenant_id: string | null;
}

/** Agrupa las filas por cuenta (`null` = la bandeja de AGROCOM), conservando el orden. */
function porCuenta(filas: readonly Fila[]): Map<string | null, string[]> {
  const grupos = new Map<string | null, string[]>();
  for (const fila of filas)
    grupos.set(fila.tenant_id, [...(grupos.get(fila.tenant_id) ?? []), fila.id]);
  return grupos;
}

/**
 * Procesa por lotes lo que devuelve `leerLote`: una transacción POR CUENTA con todas sus filas del lote (no una
 * por fila), de espera corta ante bloqueos. Si la de una cuenta falla (p. ej. cede ante una validación), se
 * registra y siguen las demás; esas filas se reintentan en la próxima pasada. Devuelve cuántas retiró.
 */
async function retirarPorLotes(
  pool: Pool,
  leerLote: () => Promise<Fila[]>,
  retirar: (tx: Transaccion, tenantId: string | null, ids: readonly string[]) => Promise<number>,
  registrarError: (error: unknown) => void,
): Promise<number> {
  let retiradas = 0;
  for (let vuelta = 0; vuelta < VUELTAS_MAXIMAS; vuelta += 1) {
    const lote = await leerLote();
    let retiradasEnLaVuelta = 0;
    for (const [tenantId, ids] of porCuenta(lote)) {
      try {
        const n = await (tenantId === null
          ? enTransaccion(pool, (tx) => retirar(tx, null, ids), {
              esperaDeBloqueoS: ESPERA_DE_BLOQUEO_DE_TAREA_S,
            })
          : ContextoCuenta.ejecutarEn(tenantId, () =>
              enTransaccion(pool, (tx) => retirar(tx, tenantId, ids), {
                esperaDeBloqueoS: ESPERA_DE_BLOQUEO_DE_TAREA_S,
              }),
            ));
        retiradasEnLaVuelta += n;
      } catch (error) {
        registrarError(error);
      }
    }
    retiradas += retiradasEnLaVuelta;
    // Lote incompleto = no queda más; sin avances = lo que queda no se puede retirar ahora (no insistir).
    if (lote.length < LOTE || retiradasEnLaVuelta === 0) break;
  }
  return retiradas;
}

async function retirarCada(
  ids: readonly string[],
  retirar: (id: string) => Promise<boolean>,
): Promise<number> {
  let n = 0;
  for (const id of ids) if (await retirar(id)) n += 1;
  return n;
}

/**
 * Retención: da de baja (soft delete, invariante 8; ver las migraciones de las dos tablas) las notificaciones
 * cerradas con más de 90 días y los mensajes de la cola ya resueltos con más de 30. Un incidente abierto nunca
 * se depura. Las consultas usan los índices `idx_*_retencion`. Devuelve cuántas filas retiró.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
): Promise<number> {
  const notificaciones = await retirarPorLotes(
    pool,
    () =>
      new RepositorioDeNotificacionesDeTodas(pool).viejas(
        sumarDias(ahora, -DIAS_DE_RETENCION_DE_NOTIFICACIONES),
        LOTE,
      ),
    (tx, tenantId, ids) => {
      const repositorio =
        tenantId === null
          ? new RepositorioDeNotificacionesDePlataforma(pool)
          : new RepositorioDeNotificaciones(pool);
      return retirarCada(ids, (id) => repositorio.depurar(tx, id));
    },
    registrarError,
  );
  const mensajes = await retirarPorLotes(
    pool,
    () =>
      new RepositorioDeColaDeTodas(pool).viejos(sumarDias(ahora, -DIAS_DE_RETENCION_DE_COLA), LOTE),
    (tx, _tenantId, ids) => {
      const cola = new RepositorioDeCola(pool);
      return retirarCada(ids, (id) => cola.depurar(tx, id));
    },
    registrarError,
  );
  return notificaciones + mensajes;
}
