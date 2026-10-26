import type { Transaccion } from '../../platform/db/transaccion.js';
import { sesionesQueSobran, type SesionViva, type TopesDeSesiones } from './domain/sesion.js';
import type { CierreSolicitado } from './repository.js';

/** Lo que `apertura-de-sesion` necesita de un repositorio de sesiones: el de una cuenta y el de plataforma lo cumplen. */
export interface AlmacenDeSesiones {
  vivasDe(usuarioId: string, ahora: Date, tx: Transaccion): Promise<SesionViva[]>;
  vivasDeInstalacion(instalacionId: string, ahora: Date, tx: Transaccion): Promise<SesionViva[]>;
  cerrar(tx: Transaccion, id: string, ahora: Date, cierre: CierreSolicitado): Promise<boolean>;
}

/**
 * Cierra, DENTRO de la transacción que abre la sesión nueva, las que sobran según los topes (ADR 0030 §4.1):
 * la de la misma instalación, la más antigua del usuario si ya tiene `maxPorUsuario` y la más antigua de la
 * instalación si ya tiene `maxPorInstalacion`. Nunca rechaza el ingreso. Cada cierre deja motivo, autor y fila en
 * la bitácora. Las filas se leen bloqueadas (`FOR UPDATE`), así dos ingresos simultáneos del mismo usuario se
 * esperan y ven el conteo uno del otro.
 *
 * El tope NO es una vía para esquivar el rate limit: el limitador de la API cuenta por usuario, nunca por sesión
 * ni por instalación, así que abrir muchas sesiones no multiplica el cupo de peticiones (ADR 0030 §3.2).
 */
export async function cerrarLasQueSobran(
  almacen: AlmacenDeSesiones,
  tx: Transaccion,
  quien: { readonly usuarioId: string; readonly instalacionId: string | null },
  topes: TopesDeSesiones,
  ahora: Date,
): Promise<void> {
  const delUsuario = await almacen.vivasDe(quien.usuarioId, ahora, tx);
  const deLaInstalacion =
    quien.instalacionId === null
      ? []
      : await almacen.vivasDeInstalacion(quien.instalacionId, ahora, tx);
  const cierres = sesionesQueSobran(delUsuario, deLaInstalacion, quien, topes);
  for (const cierre of cierres) {
    await almacen.cerrar(tx, cierre.id, ahora, {
      motivo: cierre.motivo,
      porUsuarioId: quien.usuarioId,
    });
  }
}
