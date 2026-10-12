import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { BorradorDeCuenta } from '../domain/alta';
import type { FiltrosDeCuentas } from '../domain/cuenta';
import { useCuentasRepositorio } from './contextos';

/** Clave raíz de todo lo de cuentas: cualquier mutación de una cuenta la invalida. */
export const CLAVE_CUENTAS = ['cuentas'] as const;

/** Listado con la búsqueda retrasada 300 ms (no se consulta por cada tecla) y la página anterior visible mientras carga. */
export function useCuentas(filtros: FiltrosDeCuentas) {
  const repositorio = useCuentasRepositorio();
  const busqueda = useDebounce(filtros.busqueda, 300);
  return useQuery({
    queryKey: [...CLAVE_CUENTAS, 'lista', busqueda, filtros.estado, filtros.pagina],
    queryFn: () => repositorio.listar({ ...filtros, busqueda }),
    placeholderData: keepPreviousData,
  });
}

export function useDetalleDeCuenta(id: string) {
  const repositorio = useCuentasRepositorio();
  return useQuery({
    queryKey: [...CLAVE_CUENTAS, 'detalle', id],
    queryFn: () => repositorio.obtener(id),
  });
}

export function useSitiosYPuertas(id: string, habilitado: boolean) {
  const repositorio = useCuentasRepositorio();
  return useQuery({
    queryKey: [...CLAVE_CUENTAS, 'puertas', id],
    queryFn: () => repositorio.sitiosYPuertas(id),
    enabled: habilitado,
  });
}

/** Validación del código con debounce de 300 ms; sin consulta si todavía no son 3 letras. */
export function useCodigoDisponible(codigo: string, razonSocial: string) {
  const repositorio = useCuentasRepositorio();
  const codigoRetrasado = useDebounce(codigo, 300);
  const razonRetrasada = useDebounce(razonSocial, 300);
  const consulta = useQuery({
    queryKey: [...CLAVE_CUENTAS, 'codigo', codigoRetrasado, razonRetrasada],
    queryFn: () => repositorio.codigoDisponible(codigoRetrasado, razonRetrasada),
    enabled: codigoRetrasado.length === 3,
  });
  const esperando = codigoRetrasado !== codigo || consulta.isFetching;
  return {
    verificando: codigo.length === 3 && esperando,
    /** `undefined` mientras no se sabe. */
    resultado: codigo.length === 3 && !esperando ? consulta.data : undefined,
  };
}

/**
 * Alta de cuenta. El PIN del administrador viaja en la respuesta: la mutación no se retiene en
 * la caché (`gcTime: 0`) y quien la usa debe guardarlo solo en su estado local.
 */
export function useCrearCuenta() {
  const repositorio = useCuentasRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (borrador: BorradorDeCuenta) => repositorio.crear(borrador),
    gcTime: 0,
    onSuccess: async () => {
      await Promise.all([
        clienteConsultas.invalidateQueries({ queryKey: CLAVE_CUENTAS }),
        clienteConsultas.invalidateQueries({ queryKey: ['resumen'] }),
        clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
      ]);
    },
  });
}

export function useAdministradores(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  return useQuery({
    queryKey: [...CLAVE_CUENTAS, 'administradores', cuentaId],
    queryFn: () => repositorio.administradores(cuentaId),
  });
}

/**
 * Regenera el PIN de un administrador. Como el alta, no retiene el resultado (`gcTime: 0`): el PIN
 * en claro solo debe vivir en el estado de quien lo muestra.
 */
export function useRegenerarPin(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => repositorio.regenerarPin(cuentaId, usuarioId),
    gcTime: 0,
    onSuccess: async () => {
      await Promise.all([
        clienteConsultas.invalidateQueries({
          queryKey: [...CLAVE_CUENTAS, 'administradores', cuentaId],
        }),
        clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
      ]);
    },
  });
}

export function useCambiarCodigo(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => repositorio.cambiarCodigo(cuentaId, codigo),
    onSuccess: async () => {
      await Promise.all([
        clienteConsultas.invalidateQueries({ queryKey: CLAVE_CUENTAS }),
        clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
        clienteConsultas.invalidateQueries({ queryKey: ['cobranza'] }),
        clienteConsultas.invalidateQueries({ queryKey: ['resumen'] }),
      ]);
    },
  });
}
