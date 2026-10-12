import { useQuery } from '@tanstack/react-query';
import { useResumenRepositorio } from './contextos';

/** Clave raíz: las mutaciones de cuentas, pagos y planes la invalidan. */
export const CLAVE_RESUMEN = ['resumen'] as const;

export function useResumen() {
  const repositorio = useResumenRepositorio();
  return useQuery({ queryKey: CLAVE_RESUMEN, queryFn: () => repositorio.obtener() });
}
