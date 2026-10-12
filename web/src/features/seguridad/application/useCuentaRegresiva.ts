import { useEffect, useState } from 'react';

/**
 * Segundos que faltan para `finEn` (ms desde epoch, `null` = sin espera). Baja de uno en uno
 * hasta 0; el cálculo sale del reloj en cada tick, no de contar intervalos.
 */
export function useCuentaRegresiva(finEn: number | null): number {
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    if (finEn === null) return;
    const tic = () => {
      setAhora(Date.now());
    };
    const inicio = setTimeout(tic, 0);
    const intervalo = setInterval(tic, 250);
    return () => {
      clearTimeout(inicio);
      clearInterval(intervalo);
    };
  }, [finEn]);

  if (finEn === null || ahora === 0) return finEn === null ? 0 : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.ceil((finEn - ahora) / 1000));
}
