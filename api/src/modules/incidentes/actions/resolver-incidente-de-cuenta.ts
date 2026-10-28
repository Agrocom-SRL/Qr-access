import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeCuentas } from '../../seguridad/contracts.js';
import {
  resolverIncidente,
  type DecisionSobreIncidente,
  type ResultadoDeResolucionDeIncidente,
} from './resolver-incidente.js';

/**
 * AGROCOM descarta, confirma o deja pendiente un incidente de uso de UNA cuenta (ADR 0033 §4.3: la propuesta de
 * reincidencia le llega a AGROCOM, que decide sobre una cuenta). Mismas reglas que la resolución de la cuenta
 * (`resolver-incidente.ts`): confirmar exige motivo, el historial se conserva, repetir el resultado es inofensivo y
 * al confirmar se evalúa la reincidencia (propone, y solo aplica la restricción automática si la cuenta la encendió).
 *
 * - **Aislamiento:** opera DENTRO de la cuenta del path (`comoPlataformaEn`, salto explícito ya autorizado por el
 *   permiso de plataforma de la ruta). Cuenta inexistente: 404 `cuenta.no_encontrada`; un incidente que no es de
 *   ESA cuenta no existe para el repositorio: 404 `incidente.no_encontrado`.
 * - **Alcance:** AGROCOM no tiene árbol: llega a los incidentes de cualquier usuario de la cuenta. No existe «el
 *   incidente propio» (el super admin no es un usuario de la cuenta).
 * - **Autoría:** `resuelto_por` y la bitácora llevan el id del super admin (fila de `usuarios` con `tenant_id NULL`:
 *   la FK se cumple y la cuenta ve que resolvió AGROCOM).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  incidenteId: string,
  decision: DecisionSobreIncidente,
  ahora: Date = new Date(),
): Promise<ResultadoDeResolucionDeIncidente> {
  if (!(await crearServicioDeCuentas(pool).existe(cuentaId))) {
    throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  }
  return ContextoCuenta.comoPlataformaEn(cuentaId, principal.usuarioId, () =>
    resolverIncidente(
      pool,
      { usuarioId: principal.usuarioId, puede: () => true },
      incidenteId,
      decision,
      ahora,
    ),
  );
}
