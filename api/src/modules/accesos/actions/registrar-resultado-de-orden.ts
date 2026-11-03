import type { Pool } from 'mysql2/promise';
import { enTransaccionIdempotente } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalDispositivo } from '../../../platform/seguridad/principal.js';
import { estadoDeOrdenTras, type ResultadoDeOrden } from '../domain/apertura-manual.js';
import { RepositorioDeOrdenesDeApertura, type OrdenFila } from '../ordenes-repository.js';
import { RepositorioDeConfirmaciones } from '../repository.js';

export interface DatosDeResultado {
  readonly informe: ResultadoDeOrden;
  /** Hora del reloj de la placa; solo informativa. */
  readonly reportadoEn: Date | null;
}

/**
 * La placa que TOMÓ una orden cuenta cómo terminó (ADR 0035 §2). Es solo un informe sobre algo ya ocurrido: no abre
 * ni cierra nada. En UNA transacción pasa la orden de `entregada` a `ejecutada` o `fallida` (compare-and-set sobre el
 * estado y sobre ESA placa) y escribe la fila de `confirmaciones_apertura` (`origen = 'placa'`) colgada de la
 * lectura que originó la orden (`ordenes_apertura.lectura_id`): el mismo registro que deja hoy un QR, así la app y
 * el detector de aperturas fallidas lo ven igual. Una puerta sin sensor informa `sin_confirmacion`/`sin_sensor`: la
 * orden queda `ejecutada` (el relé se accionó) y la confirmación dice que no se sabe si la puerta abrió.
 *
 * Quién puede informar: solo la placa a la que se entregó. Una orden inexistente, de otra cuenta, de otra puerta,
 * todavía sin entregar o entregada a OTRA placa es `orden.no_encontrada` (404), sin revelar cuál. Una orden ya dada
 * por `vencida` es `orden.vencida` (409): la placa lo descarta y no reintenta.
 *
 * Idempotente: el reintento de la misma placa con el mismo resultado no cambia nada y responde igual (204); con un
 * resultado distinto del ya registrado, `orden.ya_resuelta` (409): el primer informe es el que vale.
 */
export async function ejecutar(
  pool: Pool,
  dispositivo: PrincipalDispositivo,
  ordenId: string,
  datos: DatosDeResultado,
  ahora: Date = new Date(),
  señal?: AbortSignal,
): Promise<void> {
  const ordenes = new RepositorioDeOrdenesDeApertura(pool);
  const confirmaciones = new RepositorioDeConfirmaciones(pool);
  const estadoEsperado = estadoDeOrdenTras(datos.informe);

  /**
   * Qué hacer con la orden según está: `resolver` si la placa debe cerrarla ahora, `hecho` si ya la cerró con este
   * mismo resultado (reintento idempotente) y un error en cualquier otro caso.
   */
  const juzgar = (orden: OrdenFila | null): { orden: OrdenFila; accion: 'resolver' | 'hecho' } => {
    // Inexistente, de otra cuenta (el repositorio ya filtra por cuenta), de otra puerta, sin entregar o de otra placa.
    if (
      orden?.puerta_id !== dispositivo.puertaId ||
      orden.dispositivo_id !== dispositivo.dispositivoId
    ) {
      throw new ErrorDeDominio('orden.no_encontrada', 404);
    }
    if (orden.estado === 'entregada') return { orden, accion: 'resolver' };
    if (orden.estado === 'vencida') throw new ErrorDeDominio('orden.vencida', 409);
    if (orden.estado === estadoEsperado) return { orden, accion: 'hecho' };
    throw new ErrorDeDominio('orden.ya_resuelta', 409);
  };

  const { orden, accion } = juzgar(await ordenes.buscarPorId(ordenId));
  if (accion === 'hecho') return;

  const tomada = await enTransaccionIdempotente(
    pool,
    async (tx) => {
      const resuelta = await ordenes.resolver(
        tx,
        orden.id,
        dispositivo.dispositivoId,
        estadoEsperado,
        ahora,
      );
      if (!resuelta) return false;
      await confirmaciones.registrar(tx, {
        eventoId: orden.lectura_id,
        dispositivoId: dispositivo.dispositivoId,
        puertaId: orden.puerta_id,
        origen: 'placa',
        resultado: datos.informe.resultado,
        causa: datos.informe.causa,
        reportadoEnDispositivoAt: datos.reportadoEn,
        registradaAt: ahora,
      });
      return true;
    },
    { ...(señal === undefined ? {} : { señal }) },
  );
  // Otro informe de esta misma placa (o el barrido que la venció) llegó entre la lectura y el compare-and-set.
  if (!tomada && juzgar(await ordenes.buscarPorId(ordenId)).accion === 'resolver') {
    // No debería pasar (la fila se bloquea al resolver); ante la duda, no se da por registrado lo que no lo está.
    throw new ErrorDeDominio('orden.ya_resuelta', 409);
  }
}
