import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FiltrosDeConsumo } from '../domain/consumo';
import { useLimitesRepositorio } from './contextos';

/** Clave raíz: un cambio de tope o de bolsa la invalida (ver `useCuentas`). */
export const CLAVE_LIMITES = ['limites'] as const;

export function useConsumoDeBolsa(filtros: FiltrosDeConsumo) {
  const repositorio = useLimitesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_LIMITES, 'consumo', filtros],
    queryFn: () => repositorio.listarConsumo(filtros),
    placeholderData: keepPreviousData,
  });
}

export function useConsumoDeCuenta(cuentaId: string) {
  const repositorio = useLimitesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_LIMITES, 'cuenta', cuentaId],
    queryFn: () => repositorio.consumoDeCuenta(cuentaId),
    enabled: cuentaId !== '',
  });
}
