import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeEvidencia } from '../../accesos/contracts.js';
import { alcanceDeIncidentes, existeEnLaCuenta, puedeVer } from '../alcance.js';
import {
  normalizarEvidencia,
  MAX_IDS_DE_EVIDENCIA,
  type EvidenciaParcial,
  type Gravedad,
  type TipoDeIncidente,
} from '../domain/incidente.js';
import { RepositorioDeIncidentes } from '../repository.js';
import { detallar, type IncidenteDetallado } from './ver-incidente.js';

export interface DatosDeIncidente {
  readonly usuarioId: string;
  readonly tipo: TipoDeIncidente;
  readonly gravedad: Gravedad;
  readonly descripcion: string | null;
  /** Solo ids de QR y de intentos de acceso; cada uno debe existir en la cuenta. */
  readonly evidencia: EvidenciaParcial | undefined;
  /** Cuándo pasó; por omisión, ahora. No puede ser futuro. */
  readonly ocurridoAt: Date | null;
}

/**
 * Una persona que administra la rama registra a mano un incidente de uso de alguien de su alcance (ADR 0033 §4.1).
 *
 * - **Quién y sobre quién:** nunca sobre uno mismo (403 `incidente.propio`); el Administrador, sobre cualquier otro
 *   usuario de la cuenta; el Titular, sobre su rama. Otro Titular, un superior o un usuario de otra cuenta no existen:
 *   404 `usuario.no_encontrado`.
 * - **Evidencia:** solo ids de QR y de intentos, que tienen que existir en la cuenta (422 `incidente.evidencia_invalida`);
 *   nunca un token. Hasta 50 de cada clase.
 * - **Fecha:** `ocurrido_at` no puede ser futuro (422 `incidente.fecha_futura`).
 * Nace sin resolución: confirmarlo o descartarlo es otro paso (`resolver-incidente`). Un incidente aislado no limita nada.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  datos: DatosDeIncidente,
  ahora: Date = new Date(),
): Promise<IncidenteDetallado> {
  const alcance = await alcanceDeIncidentes(pool, principal);
  // Lo que no se ve no existe; lo que se ve pero es propio se rechaza con su propio código.
  const existe = alcance.todaLaCuenta
    ? await existeEnLaCuenta(pool, datos.usuarioId)
    : puedeVer(alcance, datos.usuarioId);
  if (!existe) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  if (datos.usuarioId === principal.usuarioId) throw new ErrorDeDominio('incidente.propio', 403);

  const ocurridoAt = datos.ocurridoAt ?? ahora;
  if (ocurridoAt.getTime() > ahora.getTime())
    throw new ErrorDeDominio('incidente.fecha_futura', 422);

  const evidencia = normalizarEvidencia(datos.evidencia);
  if (
    evidencia.qr_ids.length > MAX_IDS_DE_EVIDENCIA ||
    evidencia.evento_acceso_ids.length > MAX_IDS_DE_EVIDENCIA
  ) {
    throw new ErrorDeDominio('incidente.evidencia_invalida', 422);
  }
  const existentes = await crearServicioDeEvidencia(pool).existentes({
    qrIds: evidencia.qr_ids,
    eventoAccesoIds: evidencia.evento_acceso_ids,
  });
  if (
    evidencia.qr_ids.some((id) => !existentes.qrIds.has(id)) ||
    evidencia.evento_acceso_ids.some((id) => !existentes.eventoAccesoIds.has(id))
  ) {
    throw new ErrorDeDominio('incidente.evidencia_invalida', 422);
  }

  const id = await enTransaccion(pool, (tx) =>
    new RepositorioDeIncidentes(pool).crear(tx, {
      usuarioId: datos.usuarioId,
      tipo: datos.tipo,
      gravedad: datos.gravedad,
      origen: 'persona',
      registradoPor: principal.usuarioId,
      descripcion: datos.descripcion,
      evidencia,
      claveUnica: null,
      ocurridoAt,
    }),
  );
  if (id === null) throw new ErrorDeDominio('incidente.no_encontrado', 404);
  return detallar(pool, id);
}
