import type { Pool } from 'mysql2/promise';
import { aIso } from '../../platform/tiempo/fechas.js';
import { crearServicioDeUsuarios } from '../seguridad/contracts.js';
import type {
  EstadoDeIncidente,
  Evidencia,
  EvidenciaParcial,
  Gravedad,
  OrigenDeIncidente,
  ResultadoDeResolucion,
  TipoDeIncidente,
} from './domain/incidente.js';
import { normalizarEvidencia } from './domain/incidente.js';
import type { IncidenteFila, ResolucionFila } from './repository.js';

export interface PersonaDeIncidente {
  readonly id: string;
  readonly etiqueta: string | null;
}

export interface ResolucionDeIncidente {
  readonly resultado: ResultadoDeResolucion;
  readonly motivo: string | null;
  readonly resuelto_por: PersonaDeIncidente;
  readonly resuelta_at: string;
}

export interface IncidenteDeUso {
  readonly id: string;
  readonly usuario: PersonaDeIncidente;
  readonly tipo: TipoDeIncidente;
  readonly gravedad: Gravedad;
  readonly origen: OrigenDeIncidente;
  /** Quién lo registró; `null` si lo creó el sistema. */
  readonly registrado_por: PersonaDeIncidente | null;
  readonly descripcion: string | null;
  readonly evidencia: Evidencia;
  /** `sin_resolver` mientras nadie lo haya resuelto; si no, el resultado de la última resolución. */
  readonly estado: EstadoDeIncidente;
  /** La última resolución; `null` si todavía no hay. */
  readonly resolucion: ResolucionDeIncidente | null;
  readonly ocurrido_at: string;
  readonly created_at: string;
}

function evidenciaDe(fila: Pick<IncidenteFila, 'evidencia'>): Evidencia {
  const bruta: unknown =
    typeof fila.evidencia === 'string' ? JSON.parse(fila.evidencia) : fila.evidencia;
  return normalizarEvidencia(bruta as EvidenciaParcial);
}

/** Arma los incidentes con la etiqueta de las personas que aparecen en ellos. */
export async function presentarIncidentes(
  pool: Pool,
  filas: readonly IncidenteFila[],
): Promise<IncidenteDeUso[]> {
  const ids = new Set<string>();
  for (const fila of filas) {
    ids.add(fila.usuario_id);
    if (fila.registrado_por !== null) ids.add(fila.registrado_por);
    if (fila.res_resuelto_por !== null) ids.add(fila.res_resuelto_por);
  }
  const etiquetas = await crearServicioDeUsuarios(pool).etiquetasDe([...ids]);
  const persona = (id: string): PersonaDeIncidente => ({ id, etiqueta: etiquetas.get(id) ?? null });
  return filas.map((fila) => ({
    id: fila.id,
    usuario: persona(fila.usuario_id),
    tipo: fila.tipo,
    gravedad: fila.gravedad,
    origen: fila.origen,
    registrado_por: fila.registrado_por === null ? null : persona(fila.registrado_por),
    descripcion: fila.descripcion,
    evidencia: evidenciaDe(fila),
    estado: fila.res_resultado ?? 'sin_resolver',
    resolucion:
      fila.res_resultado === null || fila.res_resuelto_por === null || fila.res_resuelta_at === null
        ? null
        : {
            resultado: fila.res_resultado,
            motivo: fila.res_motivo,
            resuelto_por: persona(fila.res_resuelto_por),
            resuelta_at: aIso(fila.res_resuelta_at),
          },
    ocurrido_at: aIso(fila.ocurrido_at),
    created_at: aIso(fila.created_at),
  }));
}

/** El historial de resoluciones de un incidente, de la primera a la última. */
export async function presentarHistorial(
  pool: Pool,
  historial: readonly ResolucionFila[],
): Promise<ResolucionDeIncidente[]> {
  const etiquetas = await crearServicioDeUsuarios(pool).etiquetasDe([
    ...new Set(historial.map((r) => r.resuelto_por)),
  ]);
  return historial.map((r) => ({
    resultado: r.resultado,
    motivo: r.motivo,
    resuelto_por: { id: r.resuelto_por, etiqueta: etiquetas.get(r.resuelto_por) ?? null },
    resuelta_at: aIso(r.resuelta_at),
  }));
}
