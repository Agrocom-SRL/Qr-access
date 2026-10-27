import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { tienePermiso } from '../../../plugins/permisos.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeUsuarios } from '../../seguridad/contracts.js';
import type { Ejecucion } from '../domain/confirmacion.js';
import { ejecucionesPorEvento, puertasPorId } from '../presentacion.js';
import { RepositorioDeEventos, type EventoFila, type FiltroDeEventos } from '../repository.js';

export interface EventoListado {
  id: string;
  ocurrido_at: string;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  puerta: { id: string; nombre: string; sitio: { id: string; nombre: string } };
  qr_id: string | null;
  /**
   * Qué pasó con la orden de abrir (ADR 0031 §18): `ejecutada`, `fallida` o `sin_confirmacion`. `null` en un
   * rechazo (no hubo orden) y mientras la placa aún no informa (o si su puerta no tiene sensor y no informa).
   */
  ejecucion: Ejecucion | null;
  /** El QR leído, con quién lo generó; `null` si el código no era un QR de la cuenta. */
  qr: {
    id: string;
    etiqueta: string | null;
    generador: { id: string; etiqueta: string | null };
  } | null;
}

export interface FiltrosDeEventos {
  readonly resultado: 'permitido' | 'rechazado' | null;
  /** Solo los eventos cuya ejecución efectiva es esta; `null` o ausente = todos. */
  readonly ejecucion?: Ejecucion | null;
  readonly puertaId: string | null;
  readonly desde: Date | null;
  readonly hasta: Date | null;
}

/**
 * Lo que el usuario puede ver: todos los de la cuenta con `accesos.evento.ver_todos` (administrador),
 * los de las puertas que tiene asignadas con `accesos.evento.ver_asignadas` (guardia) o, si no, solo
 * los de los QR que generó. Sin puertas asignadas, un guardia no ve ninguno.
 */
export async function alcanceDe(
  pool: Pool,
  principal: PrincipalUsuario,
  filtros: FiltrosDeEventos,
): Promise<FiltroDeEventos> {
  const verTodos = tienePermiso(principal, 'accesos.evento.ver_todos');
  const verAsignadas = !verTodos && tienePermiso(principal, 'accesos.evento.ver_asignadas');
  const asignadas = verAsignadas
    ? await crearServicioDeOrganizacion(pool).puertasAsignadasA(principal.usuarioId)
    : null;
  return {
    generadoPor: verTodos || verAsignadas ? null : principal.usuarioId,
    puertaIds: asignadas === null || asignadas.todas ? null : asignadas.puertaIds,
    resultado: filtros.resultado,
    ejecucion: filtros.ejecucion ?? null,
    puertaId: filtros.puertaId,
    desde: filtros.desde,
    hasta: filtros.hasta,
  };
}

/** Arma los eventos con su puerta, su sitio, el QR que se leyó y qué pasó con la orden de abrir. */
export async function presentarEventos(
  pool: Pool,
  filas: readonly EventoFila[],
): Promise<EventoListado[]> {
  const [puertas, etiquetas, ejecuciones] = await Promise.all([
    puertasPorId(
      pool,
      filas.map((fila) => fila.puerta_id),
    ),
    crearServicioDeUsuarios(pool).etiquetasDe([
      ...new Set(
        filas.flatMap((fila) => (fila.qr_generado_por === null ? [] : [fila.qr_generado_por])),
      ),
    ]),
    ejecucionesPorEvento(
      pool,
      filas.map((fila) => fila.id),
    ),
  ]);
  return filas.map((fila) => {
    const puerta = puertas.get(fila.puerta_id);
    return {
      id: fila.id,
      ocurrido_at: aIso(fila.ocurrido_at),
      resultado: fila.resultado,
      motivo_code: fila.motivo_code,
      puerta: {
        id: fila.puerta_id,
        nombre: puerta?.nombre ?? '',
        sitio: { id: puerta?.sitioId ?? '', nombre: puerta?.sitioNombre ?? '' },
      },
      qr_id: fila.qr_acceso_id,
      ejecucion: ejecuciones.get(fila.id) ?? null,
      qr:
        fila.qr_acceso_id === null || fila.qr_generado_por === null
          ? null
          : {
              id: fila.qr_acceso_id,
              etiqueta: fila.qr_etiqueta,
              generador: {
                id: fila.qr_generado_por,
                etiqueta: etiquetas.get(fila.qr_generado_por) ?? null,
              },
            },
    };
  });
}

/**
 * Los intentos de acceso que el usuario puede ver (HU-15, HU-16), con filtros por resultado,
 * ejecución, puerta y fecha, cada uno con su puerta, su sitio y el QR que se leyó.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  filtros: FiltrosDeEventos,
  paginacion: Paginacion,
): Promise<Listado<EventoListado>> {
  const filtro = await alcanceDe(pool, principal, filtros);
  const { limite, desplazamiento } = limiteDe(paginacion);
  const repositorio = new RepositorioDeEventos(pool);
  const [filas, total] = await Promise.all([
    repositorio.listar(filtro, limite, desplazamiento),
    repositorio.contarVisibles(filtro),
  ]);
  return armarListado(await presentarEventos(pool, filas), paginacion, total);
}
