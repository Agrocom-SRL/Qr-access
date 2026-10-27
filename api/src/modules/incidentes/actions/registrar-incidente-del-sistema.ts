import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { crearServicioDeUsuarios } from '../../seguridad/contracts.js';
import {
  normalizarEvidencia,
  type EvidenciaParcial,
  type Gravedad,
  type TipoDeIncidente,
} from '../domain/incidente.js';
import { RepositorioDeIncidentes } from '../repository.js';

export interface IncidenteDelSistema {
  readonly usuarioId: string;
  readonly tipo: TipoDeIncidente;
  readonly gravedad: Gravedad;
  /** Solo ids (QR, intentos de acceso, rechazos de generación); nunca un token. */
  readonly evidencia?: EvidenciaParcial;
  readonly descripcion?: string | null;
  /**
   * Clave de idempotencia dentro de la cuenta: repetir la detección con la misma clave no crea otro incidente. Es
   * obligatoria para el sistema (una señal que se evalúa cada pocos minutos no debe llenar la lista).
   */
  readonly claveUnica: string;
  readonly ocurridoAt: Date;
}

/**
 * El CONTRATO para que el sistema (los detectores de señales, ola W12) abra un incidente de uso (ADR 0033 §4.1).
 * Corre con la cuenta del contexto. Nace `origen = sistema`, sin autor y sin resolución: solo cuenta para la
 * reincidencia si una persona lo confirma. Devuelve el id, o `null` si esa `claveUnica` ya estaba. Quien llama es
 * código de confianza: la evidencia no se valida contra la base (sí se normaliza y acota por la tabla). El USUARIO sí
 * se comprueba: tiene que ser de la cuenta del contexto (404 `usuario.no_encontrado`), para que un detector que se
 * equivoque de cuenta no deje un incidente de A colgando de un usuario de B (invariante 1).
 */
export async function ejecutar(pool: Pool, incidente: IncidenteDelSistema): Promise<string | null> {
  const delaCuenta = await crearServicioDeUsuarios(pool).etiquetasDe([incidente.usuarioId]);
  if (!delaCuenta.has(incidente.usuarioId)) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  return enTransaccion(pool, (tx) =>
    new RepositorioDeIncidentes(pool).crear(tx, {
      usuarioId: incidente.usuarioId,
      tipo: incidente.tipo,
      gravedad: incidente.gravedad,
      origen: 'sistema',
      registradoPor: null,
      descripcion: incidente.descripcion ?? null,
      evidencia: normalizarEvidencia(incidente.evidencia),
      claveUnica: incidente.claveUnica,
      ocurridoAt: incidente.ocurridoAt,
    }),
  );
}
