import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import type { PrincipalDispositivo } from '../../../platform/seguridad/principal.js';
import { LATIDO_MAXIMO_SEGUNDOS } from '../domain/en-linea.js';
import { RepositorioDeDispositivos } from '../repository.js';

export interface DatosDeLatido {
  readonly firmware: string;
  readonly rssi: number;
  readonly puertaAbierta: boolean;
  /** Si el lector QR responde por UART; `undefined` si el firmware no lo informa (ADR 0031 §18). */
  readonly lectorResponde?: boolean;
}

/**
 * Anota que el dispositivo sigue vivo y con qué firmware, señal y estado de la puerta (HU-09). Además guarda lo
 * que el detector de estados necesita para no parpadear: desde cuándo la racha de latidos es continua y, si el
 * firmware lo informa, desde cuándo el lector responde (o no). Es diagnóstico: no decide nada de la puerta.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalDispositivo,
  datos: DatosDeLatido,
  ahora: Date = new Date(),
): Promise<void> {
  const dispositivos = new RepositorioDeDispositivos(pool);
  await enTransaccion(pool, async (tx) => {
    const previo = await dispositivos.leerEstadoDeLatido(tx, principal.dispositivoId);
    // La racha sigue si el latido anterior es reciente; si hubo un hueco, empieza una nueva.
    const racha =
      previo?.ultimo_latido_at != null &&
      previo.en_linea_desde !== null &&
      ahora.getTime() - previo.ultimo_latido_at.getTime() <= LATIDO_MAXIMO_SEGUNDOS * 1000
        ? previo.en_linea_desde
        : ahora;
    // Siempre que lo informa se anota cuándo (`informadoAt`); `cambioAt` solo si el valor cambió.
    const lector =
      datos.lectorResponde === undefined
        ? undefined
        : {
            responde: datos.lectorResponde,
            informadoAt: ahora,
            ...((previo?.lector_responde ?? null) === (datos.lectorResponde ? 1 : 0)
              ? {}
              : { cambioAt: ahora }),
          };
    await dispositivos.registrarLatido(tx, principal.dispositivoId, {
      firmware: datos.firmware,
      rssi: datos.rssi,
      puertaAbierta: datos.puertaAbierta,
      en: ahora,
      enLineaDesde: racha,
      ...(lector === undefined ? {} : { lector }),
    });
  });
}
