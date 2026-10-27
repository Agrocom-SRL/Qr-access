import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PedidoDeResolucion } from '../api/IncidentesRepositorio';
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

/**
 * Resuelve un incidente de la cuenta. Al terminar refresca la lista de incidentes y la bitácora, donde queda
 * la resolución (la bitácora de AGROCOM registra el cambio).
 */
export function useResolverIncidenteDeCuenta(cuentaId: string) {
  const repositorio = useIncidentesRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: ({ incidenteId, ...pedido }: { incidenteId: string } & PedidoDeResolucion) =>
      repositorio.resolver(cuentaId, incidenteId, pedido),
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVE_INCIDENTES });
      void clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] });
    },
  });
}
