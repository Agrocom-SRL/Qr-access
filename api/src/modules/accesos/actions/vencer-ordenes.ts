import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { conBloqueoDeTarea } from '../../../platform/db/bloqueo-de-tarea.js';
import { enTransaccionSobre } from '../../../platform/db/transaccion.js';
import { GRACIA_DE_RESULTADO_MS } from '../domain/apertura-manual.js';
import { SIN_RESPUESTA } from '../domain/confirmacion.js';
import {
  RepositorioDeOrdenesDeApertura,
  RepositorioDeOrdenesDeTodas,
} from '../ordenes-repository.js';
import { RepositorioDeConfirmaciones } from '../repository.js';

export interface ResultadoDeVencimiento {
  /** Cuentas con órdenes por vencer que se revisaron. */
  readonly cuentas: number;
  /** Órdenes que pasaron a `vencida`. */
  readonly vencidas: number;
  /** De ellas, las que ya habían sido entregadas a una placa: quedó la constancia `sin_respuesta`. */
  readonly constancias: number;
  /** Cuentas que fallaron (siguen las demás; se reintenta en la próxima pasada). */
  readonly errores: number;
  /** Cuentas que otra pasada estaba procesando: se saltan y se reintentan en la próxima. */
  readonly ocupadas: number;
}

/** Tope de órdenes que se vencen por cuenta y por pasada (el resto, en la siguiente). */
export const TOPE_DE_ORDENES_POR_PASADA = 200;

/**
 * Vence las órdenes de apertura que nadie resolvió, de TODAS las cuentas (ADR 0035 §3, proceso periódico). El
 * recorrido de cuentas es un barrido de plataforma (salto explícito del aislamiento, una sola lectura de qué
 * cuentas tienen algo por vencer); cada cuenta se procesa dentro de SU contexto con el repositorio de cuenta.
 *
 * - `pendiente` con `vence_at` pasado: nadie la tomó. Pasa a `vencida` sin constancia (no hay placa que no contestó).
 * - `entregada` con `vence_at` + gracia pasado: una placa la tomó y no informó. Pasa a `vencida` y queda la
 *   constancia `sin_confirmacion` / `sin_respuesta` (`origen = 'servidor'`) colgada de la lectura de la orden,
 *   sellada con el instante en que se agotó el plazo (no con la hora de la pasada): alimenta el aviso
 *   `apertura.fallida` igual que una apertura por QR sin respuesta. Si la placa informa después, su fila manda.
 *
 * Idempotente y seguro con varias instancias: cada transición es un compare-and-set (si la placa informó entre la
 * lectura y el cambio, la orden ya no está viva y no se toca) y la constancia es única por (lectura, origen). Un
 * `GET_LOCK` por cuenta serializa las pasadas sin bloquear filas de negocio (ADR 0032 §1).
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
): Promise<ResultadoDeVencimiento> {
  const cuentas = await new RepositorioDeOrdenesDeTodas(pool).cuentasConOrdenesPorVencer(
    ahora,
    GRACIA_DE_RESULTADO_MS,
  );
  let vencidas = 0;
  let constancias = 0;
  let errores = 0;
  let ocupadas = 0;
  for (const cuentaId of cuentas) {
    try {
      const resultado = await ContextoCuenta.ejecutarEn(cuentaId, () =>
        vencerDeLaCuenta(pool, cuentaId, ahora),
      );
      if (resultado === null) ocupadas += 1;
      else {
        vencidas += resultado.vencidas;
        constancias += resultado.constancias;
      }
    } catch (error) {
      errores += 1;
      registrarError(error);
    }
  }
  return { cuentas: cuentas.length, vencidas, constancias, errores, ocupadas };
}

/** Las órdenes de UNA cuenta (el contexto ya está puesto). `null` si otra pasada la tiene. */
async function vencerDeLaCuenta(
  pool: Pool,
  cuentaId: string,
  ahora: Date,
): Promise<{ vencidas: number; constancias: number } | null> {
  const ordenes = new RepositorioDeOrdenesDeApertura(pool);
  const confirmaciones = new RepositorioDeConfirmaciones(pool);
  const porVencer = await ordenes.listarParaVencer(
    ahora,
    GRACIA_DE_RESULTADO_MS,
    TOPE_DE_ORDENES_POR_PASADA,
  );
  if (porVencer.length === 0) return { vencidas: 0, constancias: 0 };

  const resultado = await conBloqueoDeTarea(pool, `ordenes:${cuentaId}`, (conexion) =>
    enTransaccionSobre(conexion, async (tx) => {
      let vencidas = 0;
      let constancias = 0;
      for (const candidata of porVencer) {
        if (!(await ordenes.vencer(tx, candidata.id, ahora, GRACIA_DE_RESULTADO_MS))) continue;
        vencidas += 1;
        // Se relee tras el cambio (la fila ya es nuestra): si una placa la había tomado, lo dice `dispositivo_id`.
        const orden = await ordenes.buscarPorId(candidata.id, tx);
        if (orden?.dispositivo_id == null) continue;
        const registrada = await confirmaciones.registrar(tx, {
          eventoId: orden.lectura_id,
          dispositivoId: orden.dispositivo_id,
          puertaId: orden.puerta_id,
          origen: 'servidor',
          ...SIN_RESPUESTA,
          reportadoEnDispositivoAt: null,
          registradaAt: new Date(orden.vence_at.getTime() + GRACIA_DE_RESULTADO_MS),
        });
        if (registrada !== null) constancias += 1;
      }
      return { vencidas, constancias };
    }),
  );
  return resultado.obtenido ? resultado.valor : null;
}
