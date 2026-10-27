/** Estilo común de los ejes: texto secundario de 12 y líneas recesivas (el dato manda, no el marco). */
export const ESTILO_DE_EJE = {
  tick: { fill: 'var(--textoSecundario)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--borde)' },
} as const;

export const ALTO_DE_GRAFICA = 260;

/** Con "reducir movimiento" las gráficas aparecen sin animar. */
export function sinAnimacion(): boolean {
  // jsdom (tests) no trae matchMedia.
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
