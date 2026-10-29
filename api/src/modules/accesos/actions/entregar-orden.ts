import type { Pool } from 'mysql2/promise';
import { enTransaccionIdempotente } from '../../../platform/db/transaccion.js';
import type { NotificadorPorClave } from '../../../platform/espera/notificador-por-clave.js';
import type { PrincipalDispositivo } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { RepositorioDeOrdenesDeApertura } from '../ordenes-repository.js';

export interface OrdenEntregada {
  readonly orden_id: string;
  /** Plazo RESTANTE para ejecutar, en ms (relativo: la placa no depende de su reloj). */
  readonly valida_por_ms: number;
  readonly segundos_apertura: number;
}

export interface OpcionesDeEntrega {
  /** Cuánto retiene la petición (ADR 0035 §2: ~20 s). */
  readonly esperaMs: number;
  /** Cada cuánto consulta la base aunque no llegue una señal (respaldo si se pierde, p. ej. otra instancia). */
  readonly sondeoMs: number;
  readonly notificador: NotificadorPorClave;
  /** Plazo propio de la petición o desconexión real de la placa (`presupuestoDePeticion`, nunca `request.signal`). */
  readonly señal: AbortSignal;
}

/** La clave con que `abrir-puerta-manual` despierta a las placas de una puerta (la puerta es de una sola cuenta). */
export const claveDeEsperaDeOrdenes = (cuentaId: string, puertaId: string): string =>
  `${cuentaId}:${puertaId}`;

/**
 * La placa pregunta si hay una orden de apertura para su puerta (ADR 0035 §2): petición larga. Devuelve la orden que
 * ESTA placa ganó, o `null` si pasó la espera sin orden (la ruta responde `204` y la placa vuelve a preguntar).
 *
 * - Interruptor apagado (`puertas.apertura_manual = 0`) o puerta inactiva: `null` AL INSTANTE, sin retener la
 *   petición ni consultar en bucle. La seguridad no depende de esto: la API ya rechaza crear órdenes con el modo apagado.
 * - La espera NO ocupa una conexión del pool (ADR 0032 §1): se espera en memoria con una suscripción por puerta y se
 *   consulta la base solo al llegar, al despertar por una señal, cada `sondeoMs` y al vencer la espera. Cada consulta
 *   toma y devuelve su conexión.
 * - La orden es de la PUERTA, no de la placa: con dos placas gana la primera que la reclama. La entrega es un
 *   compare-and-set (`pendiente` y vigente a `entregada`): solo una placa la gana y una orden vencida no se entrega
 *   (invariante 2: la puerta solo abre con una orden positiva y vigente del servidor).
 * - Si la placa corta la conexión (`señal` abortada) la espera se cierra y NO se toma ninguna orden: una orden
 *   entregada a una placa que ya no escucha solo se perdería.
 */
export async function ejecutar(
  pool: Pool,
  dispositivo: PrincipalDispositivo,
  opciones: OpcionesDeEntrega,
): Promise<OrdenEntregada | null> {
  const [puerta] = await crearServicioDeOrganizacion(pool).buscarPuertas([dispositivo.puertaId]);
  if (puerta?.activa !== true || !puerta.aperturaManual) return null;

  const ordenes = new RepositorioDeOrdenesDeApertura(pool);
  const limite = Date.now() + opciones.esperaMs;
  // Suscrita ANTES de la primera consulta: una orden creada entre la consulta y la espera no se pierde.
  const suscripcion = opciones.notificador.suscribir(
    claveDeEsperaDeOrdenes(dispositivo.cuentaId, dispositivo.puertaId),
    opciones.señal,
  );
  try {
    for (;;) {
      if (opciones.señal.aborted) return null;
      const entregada = await intentarTomar(
        pool,
        ordenes,
        dispositivo,
        puerta.segundosApertura,
        opciones.señal,
      );
      if (entregada !== null) return entregada;

      const restante = limite - Date.now();
      if (restante <= 0) return null;
      await suscripcion.esperar(Math.min(opciones.sondeoMs, restante));
    }
  } finally {
    suscripcion.cerrar();
  }
}

/** Mira si hay una orden entregable y trata de ganarla; `null` si no hay o si otra placa llegó primero. */
async function intentarTomar(
  pool: Pool,
  ordenes: RepositorioDeOrdenesDeApertura,
  dispositivo: PrincipalDispositivo,
  segundosApertura: number,
  señal: AbortSignal,
): Promise<OrdenEntregada | null> {
  const candidata = await ordenes.buscarEntregableDeLaPuerta(dispositivo.puertaId, new Date());
  if (candidata === null) return null;
  try {
    const ahora = new Date();
    const ganada = await enTransaccionIdempotente(
      pool,
      (tx) =>
        ordenes.entregar(tx, candidata.id, dispositivo.puertaId, dispositivo.dispositivoId, ahora),
      { señal },
    );
    if (!ganada) return null;
    // El plazo que la placa recibe se cuenta desde AHORA (tras el COMMIT): lo que tardó la entrega ya corrió.
    const validaPorMs = candidata.vence_at.getTime() - Date.now();
    if (validaPorMs <= 0) return null;
    return {
      orden_id: candidata.id,
      valida_por_ms: validaPorMs,
      segundos_apertura: segundosApertura,
    };
  } catch (error) {
    // La placa cortó o se agotó el plazo de la petición: la transacción se deshizo (ROLLBACK) y no hay a quién responder.
    if (señal.aborted) return null;
    throw error;
  }
}
