import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { DatosDeVinculo } from '../api/PlacasRepositorio';
import type { FiltrosDePlacas } from '../domain/placa';
import { usePlacasRepositorio } from './contextos';

/** Clave raíz de todo lo de placas: cualquier mutación la invalida. */
export const CLAVE_PLACAS = ['placas'] as const;

/** Listado con la búsqueda retrasada 300 ms y la página anterior visible mientras carga. */
export function usePlacas(filtros: FiltrosDePlacas) {
  const repositorio = usePlacasRepositorio();
  const busqueda = useDebounce(filtros.busqueda, 300);
  return useQuery({
    queryKey: [...CLAVE_PLACAS, 'lista', busqueda, filtros.estado, filtros.pagina],
    queryFn: () => repositorio.listar({ ...filtros, busqueda }),
    placeholderData: keepPreviousData,
    // Una placa sin vincular sondea cada 30 s: el estado "en línea" se refresca solo.
    refetchInterval: 30_000,
  });
}

/** Lo que cambia una placa se ve también en las puertas de la cuenta, el resumen y la bitácora. */
function useInvalidarTodo() {
  const clienteConsultas = useQueryClient();
  return () =>
    Promise.all(
      [CLAVE_PLACAS, ['cuentas'], ['resumen'], ['bitacora']].map((queryKey) =>
        clienteConsultas.invalidateQueries({ queryKey }),
      ),
    );
}

/** El código llega en la respuesta: la mutación no se retiene en la caché (`gcTime: 0`). */
export function useRegistrarPlaca() {
  const repositorio = usePlacasRepositorio();
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: (mac: string) => repositorio.registrar(mac),
    gcTime: 0,
    onSuccess: invalidar,
  });
}

export function useVincularPlaca() {
  const repositorio = usePlacasRepositorio();
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: ({ placaId, datos }: { placaId: string; datos: DatosDeVinculo }) =>
      repositorio.vincular(placaId, datos),
    onSuccess: invalidar,
  });
}

export function useLiberarPlaca() {
  const repositorio = usePlacasRepositorio();
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: (placaId: string) => repositorio.liberar(placaId),
    onSuccess: invalidar,
  });
}

export function useDarDeBajaPlaca() {
  const repositorio = usePlacasRepositorio();
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: (placaId: string) => repositorio.darDeBaja(placaId),
    onSuccess: invalidar,
  });
}
