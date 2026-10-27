import type { Pool } from 'mysql2/promise';
import { enTransaccionIdempotente } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalDispositivo } from '../../../platform/seguridad/principal.js';
import {
  CONFIRMACION_TARDIA_MAXIMA_MINUTOS,
  resultadoDelInforme,
  type InformeDeLaPlaca,
} from '../domain/confirmacion.js';
import { RepositorioDeConfirmaciones, RepositorioDeEventos } from '../repository.js';

export interface DatosDeConfirmacion {
  /** El `evento_id` que devolvió la validación que ordenó abrir. */
  readonly eventoId: string;
  readonly informe: InformeDeLaPlaca;
  /** Hora del reloj de la placa; solo informativa. */
  readonly reportadoEn: Date | null;
}

/**
 * La placa cuenta qué pasó con una apertura que el servidor ordenó (ADR 0031 §18). Es solo un INFORME: no abre ni
 * cierra nada, no cambia el evento (solo inserción, invariante 4) y no retrasa ninguna validación.
 *
 * - Solo vale para un evento permitido DE ESTE dispositivo y de su cuenta: cualquier otro (de otra puerta, de otra
 *   cuenta, rechazado o inexistente) es `evento.no_encontrado` (404), sin revelar si existe.
 * - Idempotente: si la placa ya informó sobre ese evento (reintento por mala red), no se crea otra fila y la
 *   respuesta es la misma; el primer informe es el que vale.
 * - Tardía: se acepta hasta `CONFIRMACION_TARDIA_MAXIMA_MINUTOS` después de la orden, aun si el servidor ya dejó
 *   la constancia `sin_respuesta` (la fila de la placa manda). Pasado el plazo, `confirmacion.fuera_de_plazo` (409):
 *   la placa lo descarta y no reintenta.
 */
export async function ejecutar(
  pool: Pool,
  dispositivo: PrincipalDispositivo,
  datos: DatosDeConfirmacion,
  ahora: Date = new Date(),
  señal?: AbortSignal,
): Promise<void> {
  const eventos = new RepositorioDeEventos(pool);
  const confirmaciones = new RepositorioDeConfirmaciones(pool);

  const apertura = await eventos.buscarAperturaDelDispositivo(
    datos.eventoId,
    dispositivo.dispositivoId,
  );
  if (apertura === null) throw new ErrorDeDominio('evento.no_encontrado', 404);
  if (await confirmaciones.yaInformo(apertura.id)) return;

  const antiguedadMs = ahora.getTime() - apertura.ocurrido_at.getTime();
  if (antiguedadMs > CONFIRMACION_TARDIA_MAXIMA_MINUTOS * 60_000) {
    throw new ErrorDeDominio('confirmacion.fuera_de_plazo', 409);
  }

  const { resultado, causa } = resultadoDelInforme(datos.informe);
  await enTransaccionIdempotente(
    pool,
    (tx) =>
      confirmaciones.registrar(tx, {
        eventoId: apertura.id,
        dispositivoId: dispositivo.dispositivoId,
        puertaId: apertura.puerta_id,
        origen: 'placa',
        resultado,
        causa,
        reportadoEnDispositivoAt: datos.reportadoEn,
        registradaAt: ahora,
      }),
    { ...(señal === undefined ? {} : { señal }) },
  );
}
