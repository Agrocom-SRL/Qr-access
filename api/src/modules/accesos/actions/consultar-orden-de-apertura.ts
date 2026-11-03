import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import { filaEfectiva } from '../domain/confirmacion.js';
import { estadoVisible, type EstadoDeOrden } from '../domain/apertura-manual.js';
import { RepositorioDeOrdenesDeApertura } from '../ordenes-repository.js';
import { RepositorioDeConfirmaciones } from '../repository.js';

export interface EstadoDeOrdenDeApertura {
  readonly orden_id: string;
  readonly puerta_id: string;
  readonly estado: EstadoDeOrden;
  readonly vence_at: string;
  /** Lo que informó la placa (o la constancia del servidor) sobre si la puerta se abrió; `null` si aún no hay nada. */
  readonly resultado: {
    readonly resultado: 'ejecutada' | 'fallida' | 'sin_confirmacion';
    readonly causa: string;
  } | null;
}

/**
 * Cómo va una orden de abrir, para que la app muestre «abierta» o «falló» consultando cada segundo (ADR 0035 §6).
 * Solo las órdenes del propio usuario: la de otro usuario o la de otra cuenta es 404 `orden.no_encontrada`, sin
 * revelar si existe (invariante 1). Es solo lectura: nunca cambia nada ni abre nada.
 *
 * `estado` es el visible (`estadoVisible`): una orden cuyo plazo corrió sin que la placa la resolviera se ve
 * `vencida` aunque el proceso periódico no la haya marcado todavía. `resultado` sale de `confirmaciones_apertura`
 * colgada de la lectura de la orden: manda la fila de la placa; si no hay, la constancia del servidor.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  ordenId: string,
  ahora: Date = new Date(),
): Promise<EstadoDeOrdenDeApertura> {
  const orden = await new RepositorioDeOrdenesDeApertura(pool).buscarDelUsuario(
    ordenId,
    principal.usuarioId,
  );
  if (orden === null) throw new ErrorDeDominio('orden.no_encontrada', 404);

  const confirmaciones = await new RepositorioDeConfirmaciones(pool).deEventos([orden.lectura_id]);
  const efectiva = filaEfectiva(confirmaciones);
  return {
    orden_id: orden.id,
    puerta_id: orden.puerta_id,
    estado: estadoVisible(orden.estado, orden.vence_at, ahora),
    vence_at: aIso(orden.vence_at),
    resultado: efectiva === null ? null : { resultado: efectiva.resultado, causa: efectiva.causa },
  };
}
