import { useQuery } from '@tanstack/react-query';
import { useEstadisticasRepositorio } from './contextos';

/** Clave raíz: un pago, un alta o un cambio de estado la invalidan (ver `useCuentas`). */
export const CLAVE_ESTADISTICAS = ['estadisticas'] as const;

/** El uso de la apertura manual (ADR 0035): cambia con cada apertura, se actualiza solo. */
export function useAperturaManual() {
  const repositorio = useEstadisticasRepositorio();
  return useQuery({
    queryKey: ['aperturaManual'] as const,
    queryFn: () => repositorio.aperturaManual(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useEstadisticas() {
  const repositorio = useEstadisticasRepositorio();
  return useQuery({
    queryKey: CLAVE_ESTADISTICAS,
    queryFn: () => repositorio.obtener(),
    staleTime: 60_000,
    // Los accesos por día cambian con cada lectura de QR: se actualizan solos.
    refetchInterval: 10_000,
  });
}
