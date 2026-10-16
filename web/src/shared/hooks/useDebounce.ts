import { useEffect, useState } from 'react';

/** Valor que solo cambia después de `esperaMs` sin nuevas modificaciones (p. ej. validar el código a 300 ms). */
export function useDebounce<T>(valor: T, esperaMs = 300): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setRetrasado(valor);
    }, esperaMs);
    return () => {
      clearTimeout(temporizador);
    };
  }, [valor, esperaMs]);
  return retrasado;
}
