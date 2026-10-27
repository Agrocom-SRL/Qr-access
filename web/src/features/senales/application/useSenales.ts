import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FiltrosDeFlujo } from '../domain/flujo';
import type { FiltrosDeSenales } from '../domain/senal';
import { useSenalesRepositorio } from './contextos';

/** Clave raíz de las señales y el flujo: un aviso nuevo o una resolución la invalidan. */
export const CLAVE_SENALES = ['senales'] as const;

export function useSenalesDeAbuso(filtros: FiltrosDeSenales) {
  const repositorio = useSenalesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_SENALES, 'lista', filtros],
    queryFn: () => repositorio.listarSenales(filtros),
    placeholderData: keepPreviousData,
  });
}

export function useResumenDeSenales(dias: number) {
  const repositorio = useSenalesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_SENALES, 'resumen', dias],
    queryFn: () => repositorio.resumen(dias),
    placeholderData: keepPreviousData,
  });
}

export function useOpcionesDeCuenta() {
  const repositorio = useSenalesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_SENALES, 'cuentas'],
    queryFn: () => repositorio.opcionesDeCuenta(),
    staleTime: 60_000,
  });
}

export function useFlujoDeCuentas(filtros: FiltrosDeFlujo) {
  const repositorio = useSenalesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_SENALES, 'flujo', filtros],
    queryFn: () => repositorio.listarFlujo(filtros),
    placeholderData: keepPreviousData,
  });
}

export function useFlujoDeCuenta(cuentaId: string, dias: number) {
  const repositorio = useSenalesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_SENALES, 'flujo-cuenta', cuentaId, dias],
    queryFn: () => repositorio.flujoDeCuenta(cuentaId, dias),
    enabled: cuentaId !== '',
    placeholderData: keepPreviousData,
  });
}
