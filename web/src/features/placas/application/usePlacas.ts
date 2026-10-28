import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { DatosDeVinculo } from '../api/PlacasRepositorio';
import type { NivelAbierto } from '../domain/placa';
import type { FiltrosDePlacas } from '../domain/placa';
import { usePlacasRepositorio } from './contextos';

/** Clave raíz de todo lo de placas: cualquier mutación la invalida. */
export const CLAVE_PLACAS = ['placas'] as const;

/** Listado con la búsqueda retrasada 300 ms y la página anterior visible mientras carga. */
export function usePlacas(filtros: FiltrosDePlacas) {
  const repositorio = usePlacasRepositorio();
  const busqueda = useDebounce(filtros.busqueda, 300);
  return useQuery({
    queryKey: [
      ...CLAVE_PLACAS,
      'lista',
      busqueda,
      filtros.estado,
      filtros.conexion,
      filtros.pagina,
    ],
    queryFn: () => repositorio.listar({ ...filtros, busqueda }),
    placeholderData: keepPreviousData,
    // Una placa sin vincular se anuncia cada 30 s; mientras alguna espera su botón se mira más
    // seguido para que el panel vea el vínculo apenas se confirma.
    refetchInterval: (consulta) =>
      consulta.state.data?.elementos.some((placa) => placa.estado === 'por_confirmar')
        ? 5_000
        : 30_000,
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

export function useVincularPlaca() {
  const repositorio = usePlacasRepositorio();
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: ({ placaId, datos }: { placaId: string; datos: DatosDeVinculo }) =>
      repositorio.vincular(placaId, datos),
    onSuccess: invalidar,
  });
}

export function useCancelarVinculoDePlaca() {
  const repositorio = usePlacasRepositorio();
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: (placaId: string) => repositorio.cancelarVinculo(placaId),
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

export function useConfigurarSensorDePlaca() {
  const repositorio = usePlacasRepositorio();
  const invalidar = useInvalidarTodo();
  return useMutation({
    mutationFn: ({
      placaId,
      sensor,
    }: {
      placaId: string;
      sensor: { instalado: boolean; nivelAbierto: NivelAbierto };
    }) => repositorio.configurarSensor(placaId, sensor),
    onSuccess: invalidar,
  });
}
