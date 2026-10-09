import { ContextoCuenta } from '../contexto/contexto-cuenta.js';
import type { Transaccion } from '../db/transaccion.js';

export type AccionDeBitacora = 'creado' | 'actualizado' | 'eliminado' | 'restaurado';

export interface CambioRegistrado {
  /** `null` = tabla de plataforma. */
  readonly tenantId: string | null;
  readonly tabla: string;
  readonly registroId: string;
  readonly accion: AccionDeBitacora;
  readonly antes: Readonly<Record<string, unknown>> | null;
  readonly despues: Readonly<Record<string, unknown>> | null;
}

/**
 * Escribe una fila de `bitacoras` (ADR 0007) en la transacción del cambio: o quedan los dos o
 * ninguno. Solo la llama el repositorio base; una acción nunca la invoca. Quién, de dónde y
 * cuándo salen del contexto, no de quien llama. Los valores llegan ya sin columnas sensibles.
 */
export async function registrarCambio(tx: Transaccion, cambio: CambioRegistrado): Promise<void> {
  const contexto = ContextoCuenta.actual();
  await tx.query(
    `INSERT INTO bitacoras
       (tenant_id, usuario_id, dispositivo_id, tabla, registro_id, accion, origen, antes, despues)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cambio.tenantId,
      contexto?.usuarioId ?? null,
      contexto?.dispositivoId ?? null,
      cambio.tabla,
      cambio.registroId,
      cambio.accion,
      contexto?.origen ?? 'sistema',
      cambio.antes === null ? null : JSON.stringify(cambio.antes),
      cambio.despues === null ? null : JSON.stringify(cambio.despues),
    ],
  );
}
