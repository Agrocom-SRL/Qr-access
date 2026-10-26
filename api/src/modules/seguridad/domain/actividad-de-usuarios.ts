/**
 * Estadísticas de uso de los usuarios (ADR 0028, decisiones del 2026-10-21): los umbrales son fijos e
 * informativos. Nunca disparan una acción: quien administra decide la baja.
 */

/** Ventana de tiempo que se mira, en días. */
export const VENTANA_EN_DIAS = 30;

/** Sin QR generados ni usados en esta cantidad de días, un usuario cuenta como inactivo. */
export const DIAS_SIN_USO_PARA_INACTIVO = 30;

/** Más de esta cantidad de QR generados en un mismo día cuenta como ruido. */
export const QR_POR_DIA_PARA_RUIDOSO = 10;

/** Un Titular está cerca de su tope de Miembros desde este porcentaje. */
export const PORCENTAJE_CERCA_DEL_TOPE = 80;

/** Lo que hizo un usuario con sus QR dentro de la ventana. */
export interface ActividadDeQr {
  readonly generados: number;
  readonly usados: number;
  /** El mayor número de QR generados en un solo día de la ventana. */
  readonly maxEnUnDia: number;
  /** El último QR generado, de cualquier fecha; `null` si nunca generó uno. */
  readonly ultimoGeneradoAt: Date | null;
}

export const SIN_ACTIVIDAD: ActividadDeQr = {
  generados: 0,
  usados: 0,
  maxEnUnDia: 0,
  ultimoGeneradoAt: null,
};

export interface EvaluacionDeUsuario {
  readonly inactivo: boolean;
  readonly ruidoso: boolean;
}

/**
 * Inactivo: no generó ningún QR en la ventana (ni propio ni de visitas) y ya tiene más de esa
 * antigüedad: un usuario recién creado todavía no tuvo tiempo de usar nada. Ruidoso: algún día
 * generó más QR que el umbral, usados o no.
 */
export function evaluarUsuario(
  actividad: ActividadDeQr,
  creadoAt: Date,
  ahora: Date,
): EvaluacionDeUsuario {
  const antiguedadEnDias = (ahora.getTime() - creadoAt.getTime()) / 86_400_000;
  return {
    inactivo: actividad.generados === 0 && antiguedadEnDias >= DIAS_SIN_USO_PARA_INACTIVO,
    ruidoso: actividad.maxEnUnDia > QR_POR_DIA_PARA_RUIDOSO,
  };
}

/** Qué porcentaje del tope de Miembros usa un Titular, redondeado hacia abajo. */
export function porcentajeDelTope(miembros: number, tope: number): number {
  return tope <= 0 ? 0 : Math.floor((miembros / tope) * 100);
}

export function estaCercaDelTope(miembros: number, tope: number): boolean {
  return porcentajeDelTope(miembros, tope) >= PORCENTAJE_CERCA_DEL_TOPE;
}

/** Cuántos usuarios cuelgan de cada Administrador, a cualquier profundidad (el cupo de su rama). */
export function usuariosPorRama(
  nodos: readonly { id: string; superiorId: string | null }[],
): Map<string, number> {
  const hijos = new Map<string, string[]>();
  for (const nodo of nodos) {
    if (nodo.superiorId === null) continue;
    hijos.set(nodo.superiorId, [...(hijos.get(nodo.superiorId) ?? []), nodo.id]);
  }
  const contar = (id: string, visitados: Set<string>): number => {
    let total = 0;
    for (const hijo of hijos.get(id) ?? []) {
      // Un ciclo (que la base no debería permitir) no se recorre dos veces
      if (visitados.has(hijo)) continue;
      visitados.add(hijo);
      total += 1 + contar(hijo, visitados);
    }
    return total;
  };
  return new Map(nodos.map((nodo) => [nodo.id, contar(nodo.id, new Set([nodo.id]))]));
}
