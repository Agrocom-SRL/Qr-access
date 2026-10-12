import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FiltrosDeBitacora } from '../domain/evento';
import { useBitacoraRepositorio } from './contextos';

/** Clave raíz: toda mutación de plataforma invalida `['bitacora']` para que el cambio aparezca. */
export const CLAVE_BITACORA = ['bitacora'] as const;

export function useBitacora(filtros: FiltrosDeBitacora, porPagina: number) {
  const repositorio = useBitacoraRepositorio();
  return useQuery({
    queryKey: [...CLAVE_BITACORA, 'lista', filtros, porPagina],
    queryFn: () => repositorio.listar(filtros, porPagina),
    placeholderData: keepPreviousData,
  });
}

export function useCuentasDeLaBitacora() {
  const repositorio = useBitacoraRepositorio();
  return useQuery({
    queryKey: [...CLAVE_BITACORA, 'cuentas'],
    queryFn: () => repositorio.cuentas(),
    staleTime: 60_000,
  });
}
