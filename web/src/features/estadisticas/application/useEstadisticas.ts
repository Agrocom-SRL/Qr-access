import { useQuery } from '@tanstack/react-query';
import { useEstadisticasRepositorio } from './contextos';

/** Clave raíz: un pago, un alta o un cambio de estado la invalidan (ver `useCuentas`). */
export const CLAVE_ESTADISTICAS = ['estadisticas'] as const;

export function useEstadisticas() {
  const repositorio = useEstadisticasRepositorio();
  return useQuery({
    queryKey: CLAVE_ESTADISTICAS,
    queryFn: () => repositorio.obtener(),
    staleTime: 60_000,
  });
}
