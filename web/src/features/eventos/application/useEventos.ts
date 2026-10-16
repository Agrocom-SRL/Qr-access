import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { REFRESCO_DE_EVENTOS_MS, type FiltrosDeEventos } from '../domain/evento';
import { useEventosRepositorio } from './contextos';

export const CLAVE_EVENTOS = ['eventos'] as const;

/** La lista se refresca sola: lo que lee una placa aparece en segundos, como en vivo. */
export function useEventos(filtros: FiltrosDeEventos, porPagina: number) {
  const repositorio = useEventosRepositorio();
  return useQuery({
    queryKey: [...CLAVE_EVENTOS, 'lista', filtros, porPagina],
    queryFn: () => repositorio.listar(filtros, porPagina),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESCO_DE_EVENTOS_MS,
  });
}

export function useCuentasDeLosEventos() {
  const repositorio = useEventosRepositorio();
  return useQuery({
    queryKey: [...CLAVE_EVENTOS, 'cuentas'],
    queryFn: () => repositorio.cuentas(),
    staleTime: 60_000,
  });
}
