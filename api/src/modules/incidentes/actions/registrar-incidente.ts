import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeEvidencia } from '../../accesos/contracts.js';
import { sumarDias, sumarMinutos } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeArbol } from '../../seguridad/contracts.js';
import { alcanceDeIncidentes, puedeVer } from '../alcance.js';
import {
  normalizarEvidencia,
  MAX_IDS_DE_EVIDENCIA,
  MAX_INCIDENTES_REGISTRADOS_POR_USUARIO_Y_DIA,
  MAX_ANTIGUEDAD_DE_INCIDENTE_DIAS,
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
 * - **Quién y sobre quién:** nunca sobre uno mismo (403 `incidente.propio`); el Administrador y el Titular, sobre
 *   su rama (el Administrador no llega a la de otro Administrador, ADR 0028 §4). Otro Titular, un superior, la rama
 *   de otro Administrador o un usuario de otra cuenta no existen: 404 `usuario.no_encontrado`.
 * - **Evidencia:** solo ids de QR y de intentos del usuario o de su rama (422 `incidente.evidencia_invalida`, igual
 *   de opaco exista o no en otra parte); nunca un token. Hasta 50 de cada clase.
 * - **Fecha:** `ocurrido_at` no puede ser futuro (422 `incidente.fecha_futura`) ni de hace más de un año (422
 *   `incidente.fecha_antigua`).
 * - **Tope:** a lo sumo 20 incidentes registrados a mano por usuario en 24 horas (429 `incidente.tope_diario`).
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
  if (!puedeVer(alcance, datos.usuarioId)) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  if (datos.usuarioId === principal.usuarioId) throw new ErrorDeDominio('incidente.propio', 403);

  const ocurridoAt = datos.ocurridoAt ?? ahora;
  if (ocurridoAt.getTime() > ahora.getTime())
    throw new ErrorDeDominio('incidente.fecha_futura', 422);
  // Una cota inferior: un incidente de hace años no tiene sentido y un `ocurrido_at` remoto saldría de la ventana.
  if (ocurridoAt.getTime() < sumarDias(ahora, -MAX_ANTIGUEDAD_DE_INCIDENTE_DIAS).getTime())
    throw new ErrorDeDominio('incidente.fecha_antigua', 422);

  const evidencia = normalizarEvidencia(datos.evidencia);
  if (
    evidencia.qr_ids.length > MAX_IDS_DE_EVIDENCIA ||
    evidencia.evento_acceso_ids.length > MAX_IDS_DE_EVIDENCIA
  ) {
    throw new ErrorDeDominio('incidente.evidencia_invalida', 422);
  }
  // La evidencia es del usuario del incidente o de su rama: no se «prueba» con la actividad de quien no tiene que ver.
  const existentes = await crearServicioDeEvidencia(pool).existentes({
    qrIds: evidencia.qr_ids,
    eventoAccesoIds: evidencia.evento_acceso_ids,
    generadores: await crearServicioDeArbol(pool).ramaDe(datos.usuarioId),
  });
  if (
    evidencia.qr_ids.some((id) => !existentes.qrIds.has(id)) ||
    evidencia.evento_acceso_ids.some((id) => !existentes.eventoAccesoIds.has(id))
  ) {
    throw new ErrorDeDominio('incidente.evidencia_invalida', 422);
  }

  const incidentes = new RepositorioDeIncidentes(pool);
  const id = await enTransaccion(pool, async (tx) => {
    // Con los incidentes del usuario bloqueados, dos registros a la vez no se pasan del tope diario.
    await incidentes.bloquearDelUsuario(tx, datos.usuarioId);
    const hoy = await incidentes.contarRegistradosPorPersonasDesde(
      datos.usuarioId,
      sumarMinutos(ahora, -24 * 60),
      tx,
    );
    if (hoy >= MAX_INCIDENTES_REGISTRADOS_POR_USUARIO_Y_DIA) {
      throw new ErrorDeDominio('incidente.tope_diario', 429);
    }
    return incidentes.crear(tx, {
      usuarioId: datos.usuarioId,
      tipo: datos.tipo,
      gravedad: datos.gravedad,
      origen: 'persona',
      registradoPor: principal.usuarioId,
      descripcion: datos.descripcion,
      evidencia,
      claveUnica: null,
      ocurridoAt,
    });
  });
  if (id === null) throw new ErrorDeDominio('incidente.no_encontrado', 404);
  return detallar(pool, id);
}
