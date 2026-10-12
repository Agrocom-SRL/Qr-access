import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlanesRepositorio } from './contextos';

/** Clave de los planes; otros módulos (cuentas, suscripciones) la invalidan al cambiar precios. */
export const CLAVE_PLANES = ['planes'] as const;

export function usePlanes() {
  const repositorio = usePlanesRepositorio();
  return useQuery({ queryKey: CLAVE_PLANES, queryFn: () => repositorio.listar() });
}

export function useGuardarPrecios() {
  const repositorio = usePlanesRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (cambios: readonly { planId: string; precioAnual: number }[]) =>
      repositorio.guardarPrecios(cambios),
    onSuccess: async () => {
      await Promise.all([
        clienteConsultas.invalidateQueries({ queryKey: CLAVE_PLANES }),
        // La bitácora de la plataforma registra el cambio de precio.
        clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
        clienteConsultas.invalidateQueries({ queryKey: ['resumen'] }),
        clienteConsultas.invalidateQueries({ queryKey: ['cobranza'] }),
      ]);
    },
  });
}
