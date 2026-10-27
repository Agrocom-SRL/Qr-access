import type { Pool } from 'mysql2/promise';
import type { Transaccion } from '../../../platform/db/transaccion.js';
import type { AvisoAgrupado } from '../domain/aviso.js';
import { RepositorioDeCola } from '../repository.js';

/**
 * Los canales por los que hoy se entrega un aviso. Solo `app` (la bandeja propia): `push` y `correo` están
 * previstos en la tabla pero sin proveedor integrado (ADR 0030 §6, pasos 2 y 3).
 */
export const CANALES_ACTIVOS = ['app'] as const;

/**
 * Deja un aviso agrupado en la cola (outbox) DENTRO de la transacción de quien lo detectó, con la cuenta del
 * contexto: o se guarda el cambio de estado y su aviso, o ninguno. No entrega nada. Encolar de nuevo la misma
 * evaluación (`ahora` igual) no duplica el mensaje.
 */
export async function ejecutar(
  pool: Pool,
  tx: Transaccion,
  aviso: AvisoAgrupado,
  ahora: Date,
): Promise<void> {
  const cola = new RepositorioDeCola(pool);
  for (const canal of CANALES_ACTIVOS) {
    await cola.encolar(tx, {
      audiencia: aviso.audiencia,
      canal,
      agrupacionClave: aviso.agrupacion,
      carga: aviso,
      proximoIntentoAt: ahora,
      claveUnica: `${aviso.agrupacion}:${aviso.audiencia}:${canal}:${ahora.toISOString()}`,
    });
  }
}
