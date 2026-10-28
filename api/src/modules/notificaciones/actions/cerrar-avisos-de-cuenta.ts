import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import type { Transaccion } from '../../../platform/db/transaccion.js';
import {
  RepositorioDeCola,
  RepositorioDeNotificaciones,
  RepositorioDeNotificacionesDePlataforma,
} from '../repository.js';

/**
 * Al dar de baja una cuenta, cierra sus incidentes abiertos (en la bandeja del propietario y en la de AGROCOM,
 * que habla de ella) y retira de la cola lo que aún esperaba entrega: una cuenta eliminada no debe dejar avisos
 * abiertos para siempre ni seguir generando entregas. Va en la MISMA transacción que la baja (`tx`).
 *
 * Quien lo llama es un super admin de plataforma ya autorizado, sin cuenta en su contexto: se abre el contexto
 * de la cuenta dada (`comoPlataformaEn`, salto explícito del aislamiento) para escribir sus filas con la
 * autoría del actor.
 */
export async function ejecutar(
  pool: Pool,
  tx: Transaccion,
  cuentaId: string,
  ahora: Date,
): Promise<void> {
  const usuarioId = ContextoCuenta.actual()?.usuarioId ?? null;
  const dentroDeLaCuenta = <T>(fn: () => T): T =>
    usuarioId === null
      ? ContextoCuenta.ejecutarEn(cuentaId, fn)
      : ContextoCuenta.comoPlataformaEn(cuentaId, usuarioId, fn);

  await dentroDeLaCuenta(async () => {
    const propia = new RepositorioDeNotificaciones(pool).bandeja;
    for (const id of await propia.idsAbiertosDeLaCuenta(tx, cuentaId)) {
      await propia.cerrarIncidente(tx, id, ahora);
    }
    const cola = new RepositorioDeCola(pool);
    for (const id of await cola.idsPendientes(tx)) {
      await cola.marcarOmitida(tx, id, 'cuenta.eliminada');
    }
  });

  const deAgrocom = new RepositorioDeNotificacionesDePlataforma(pool).bandeja;
  for (const id of await deAgrocom.idsAbiertosDeLaCuenta(tx, cuentaId)) {
    await deAgrocom.cerrarIncidente(tx, id, ahora);
  }
}
