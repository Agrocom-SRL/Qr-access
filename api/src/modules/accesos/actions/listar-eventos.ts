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
import { crearServicioDeUsuarios } from '../../seguridad/contracts.js';
import { puertasPorId } from '../presentacion.js';
import { RepositorioDeEventos, type FiltroDeEventos } from '../repository.js';

export interface EventoListado {
  id: string;
  ocurrido_at: string;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  puerta: { id: string; nombre: string; sitio: { id: string; nombre: string } };
  qr_id: string | null;
  /** El QR leído, con quién lo emitió; `null` si el código no era un QR de la cuenta. */
  qr: {
    id: string;
    etiqueta: string | null;
    emisor: { id: string; etiqueta: string | null };
  } | null;
}

export interface FiltrosDeEventos {
  readonly resultado: 'permitido' | 'rechazado' | null;
  readonly puertaId: string | null;
  readonly desde: Date | null;
  readonly hasta: Date | null;
}

/** Lo que el usuario puede ver: los eventos de los QR que emitió, o todos con `accesos.evento.ver_todos`. */
export function alcanceDe(principal: PrincipalUsuario, filtros: FiltrosDeEventos): FiltroDeEventos {
  return {
    emitidoPor: tienePermiso(principal, 'accesos.evento.ver_todos') ? null : principal.usuarioId,
    resultado: filtros.resultado,
    puertaId: filtros.puertaId,
    desde: filtros.desde,
    hasta: filtros.hasta,
  };
}

/**
 * Los intentos de acceso que el usuario puede ver (HU-15, HU-16), con filtros por resultado,
 * puerta y fecha, cada uno con su puerta, su sitio y el QR que se leyó.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  filtros: FiltrosDeEventos,
  paginacion: Paginacion,
): Promise<Listado<EventoListado>> {
  const filtro = alcanceDe(principal, filtros);
  const { limite, desplazamiento } = limiteDe(paginacion);
  const repositorio = new RepositorioDeEventos(pool);
  const [filas, total] = await Promise.all([
    repositorio.listar(filtro, limite, desplazamiento),
    repositorio.contarVisibles(filtro),
  ]);
  const [puertas, etiquetas] = await Promise.all([
    puertasPorId(
      pool,
      filas.map((fila) => fila.puerta_id),
    ),
    crearServicioDeUsuarios(pool).etiquetasDe([
      ...new Set(
        filas.flatMap((fila) => (fila.qr_emitido_por === null ? [] : [fila.qr_emitido_por])),
      ),
    ]),
  ]);
  return armarListado(
    filas.map((fila) => {
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
        qr:
          fila.qr_acceso_id === null || fila.qr_emitido_por === null
            ? null
            : {
                id: fila.qr_acceso_id,
                etiqueta: fila.qr_etiqueta,
                emisor: {
                  id: fila.qr_emitido_por,
                  etiqueta: etiquetas.get(fila.qr_emitido_por) ?? null,
                },
              },
      };
    }),
    paginacion,
    total,
  );
}
