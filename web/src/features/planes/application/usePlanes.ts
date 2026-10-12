import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DatosDePlan } from '../api/PlanesRepositorio';
import { usePlanesRepositorio } from './contextos';

/** Clave de los planes; otros módulos (cuentas, suscripciones) la invalidan al cambiar precios. */
export const CLAVE_PLANES = ['planes'] as const;

export function usePlanes() {
  const repositorio = usePlanesRepositorio();
  return useQuery({ queryKey: CLAVE_PLANES, queryFn: () => repositorio.listar() });
}

/** Tras crear, editar o retirar un plan se refresca todo lo que lo muestra. */
function useInvalidarPlanes() {
  const clienteConsultas = useQueryClient();
  return async () => {
    await Promise.all([
      clienteConsultas.invalidateQueries({ queryKey: CLAVE_PLANES }),
      clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
      clienteConsultas.invalidateQueries({ queryKey: ['resumen'] }),
      clienteConsultas.invalidateQueries({ queryKey: ['cobranza'] }),
      clienteConsultas.invalidateQueries({ queryKey: ['estadisticas'] }),
    ]);
  };
}

export function useCrearPlan() {
  const repositorio = usePlanesRepositorio();
  return useMutation({
    mutationFn: (datos: DatosDePlan) => repositorio.crear(datos),
    onSuccess: useInvalidarPlanes(),
  });
}

export function useEditarPlan() {
  const repositorio = usePlanesRepositorio();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<DatosDePlan> }) =>
      repositorio.editar(id, cambios),
    onSuccess: useInvalidarPlanes(),
  });
}

export function useRetirarPlan() {
  const repositorio = usePlanesRepositorio();
  return useMutation({
    mutationFn: (id: string) => repositorio.retirar(id),
    onSuccess: useInvalidarPlanes(),
  });
}
