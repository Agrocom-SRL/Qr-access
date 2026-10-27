import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FiltrosDeIncidentes } from '../domain/incidente';
import { useIncidentesRepositorio } from './contextos';

/** Clave raíz de los incidentes de cuentas. */
export const CLAVE_INCIDENTES = ['incidentes'] as const;

/** Los incidentes de una cuenta con sus filtros; mantiene la página anterior mientras carga la nueva. */
export function useIncidentesDeCuenta(cuentaId: string, filtros: FiltrosDeIncidentes) {
  const repositorio = useIncidentesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_INCIDENTES, cuentaId, filtros],
    queryFn: () => repositorio.listar(cuentaId, filtros),
    placeholderData: keepPreviousData,
  });
}
