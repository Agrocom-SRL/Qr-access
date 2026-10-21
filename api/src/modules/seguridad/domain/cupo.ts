/** Desde qué porcentaje del cupo se avisa que se está llegando al límite (ADR 0028 §6). */
export const UMBRAL_DE_AVISO = 80;

export interface EstadoDelCupo {
  readonly usados: number;
  /** `null` = el plan no limita usuarios. */
  readonly maximo: number | null;
  /** Entero redondeado hacia abajo; `null` si no hay máximo. */
  readonly porcentaje: number | null;
  readonly aviso: 'cerca_del_limite' | 'limite_alcanzado' | null;
}

/** Cuánto del cupo del plan se usó y si corresponde avisar (al 80 % y al 100 %). */
export function calcularCupo(usados: number, maximo: number | null): EstadoDelCupo {
  if (maximo === null || maximo <= 0) return { usados, maximo, porcentaje: null, aviso: null };
  const porcentaje = Math.floor((usados / maximo) * 100);
  const aviso =
    porcentaje >= 100
      ? 'limite_alcanzado'
      : porcentaje >= UMBRAL_DE_AVISO
        ? 'cerca_del_limite'
        : null;
  return { usados, maximo, porcentaje, aviso };
}
