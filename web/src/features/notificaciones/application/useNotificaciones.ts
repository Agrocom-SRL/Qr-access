import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { REFRESCO_DE_NOTIFICACIONES_MS, type FiltroDeNotificaciones } from '../domain/notificacion';
import { useNotificacionesRepositorio } from './contextos';

/** Clave raíz de la bandeja: cualquier cambio la invalida entera (contador incluido). */
export const CLAVE_NOTIFICACIONES = ['notificaciones'] as const;

/** La campana: cuántas sin leer, consultadas cada tanto para avisar sin recargar. */
export function useContadorDeNotificaciones() {
  const repositorio = useNotificacionesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_NOTIFICACIONES, 'contador'],
    queryFn: () => repositorio.noLeidas(),
    refetchInterval: REFRESCO_DE_NOTIFICACIONES_MS,
  });
}

/** La lista de la bandeja; se refresca mientras está abierta y mantiene la página anterior mientras carga. */
export function useNotificaciones(filtro: FiltroDeNotificaciones, pagina: number) {
  const repositorio = useNotificacionesRepositorio();
  return useQuery({
    queryKey: [...CLAVE_NOTIFICACIONES, 'lista', filtro, pagina],
    queryFn: () => repositorio.listar(filtro, pagina),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESCO_DE_NOTIFICACIONES_MS,
  });
}

function useInvalidarBandeja() {
  const clienteConsultas = useQueryClient();
  return () => {
    void clienteConsultas.invalidateQueries({ queryKey: CLAVE_NOTIFICACIONES });
  };
}

export function useLeerNotificacion() {
  const repositorio = useNotificacionesRepositorio();
  const invalidar = useInvalidarBandeja();
  return useMutation({
    mutationFn: (id: string) => repositorio.leer(id),
    onSuccess: invalidar,
  });
}

export function useDescartarNotificacion() {
  const repositorio = useNotificacionesRepositorio();
  const invalidar = useInvalidarBandeja();
  return useMutation({
    mutationFn: (id: string) => repositorio.descartar(id),
    onSuccess: invalidar,
  });
}

export function useLeerTodasLasNotificaciones() {
  const repositorio = useNotificacionesRepositorio();
  const invalidar = useInvalidarBandeja();
  return useMutation({
    mutationFn: () => repositorio.leerTodas(),
    onSuccess: invalidar,
  });
}
