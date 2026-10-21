import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { CorreccionDeCuenta } from '../api/CuentasRepositorio';
import type { BorradorDeCuenta } from '../domain/alta';
import type { DatosDePuerta, DatosDeSitio, FiltrosDeCuentas } from '../domain/cuenta';
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
        clienteConsultas.invalidateQueries({ queryKey: ['estadisticas'] }),
        clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
      ]);
    },
  });
}

/** El uso de los usuarios de la cuenta (ADR 0028 §4): informativo, con umbrales fijos de la API. */
export function useEstadisticasDeUsuarios(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  return useQuery({
    queryKey: [...CLAVE_CUENTAS, 'estadisticas-de-usuarios', cuentaId],
    queryFn: () => repositorio.estadisticasDeUsuarios(cuentaId),
  });
}

/** El árbol de la cuenta (ADR 0028): Administradores con sus Guardias y Titulares. */
export function useJerarquia(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  return useQuery({
    queryKey: [...CLAVE_CUENTAS, 'jerarquia', cuentaId],
    queryFn: () => repositorio.jerarquia(cuentaId),
  });
}

/**
 * Suma un Administrador. Como el alta de cuenta, no retiene el resultado (`gcTime: 0`): el PIN en
 * claro solo debe vivir en el estado de quien lo muestra.
 */
export function useCrearAdministrador(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (datos: { etiqueta: string; sufijo?: string }) =>
      repositorio.crearAdministrador(cuentaId, datos),
    gcTime: 0,
    onSuccess: () => invalidarTodoDeCuentas(clienteConsultas),
  });
}

/** Mueve un Guardia o un Titular a otro Administrador: cambia el árbol y queda en la bitácora. */
export function useReasignar(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (datos: { usuarioId: string; administradorId: string }) =>
      repositorio.reasignar(cuentaId, datos.usuarioId, datos.administradorId),
    onSuccess: () => invalidarTodoDeCuentas(clienteConsultas),
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

/** Lo que cambia cuando se toca una cuenta: su ficha, los listados, el resumen y la bitácora. */
async function invalidarTodoDeCuentas(clienteConsultas: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    clienteConsultas.invalidateQueries({ queryKey: CLAVE_CUENTAS }),
    clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
    clienteConsultas.invalidateQueries({ queryKey: ['cobranza'] }),
    clienteConsultas.invalidateQueries({ queryKey: ['resumen'] }),
    clienteConsultas.invalidateQueries({ queryKey: ['estadisticas'] }),
  ]);
}

/** Corrige la razón social y los datos de la empresa y su persona responsable (no el código). */
export function useEditarCuenta(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (datos: CorreccionDeCuenta) => repositorio.editar(cuentaId, datos),
    onSuccess: () => invalidarTodoDeCuentas(clienteConsultas),
  });
}

/** Da de baja la cuenta; hay que repetir su código. */
export function useEliminarCuenta(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => repositorio.eliminar(cuentaId, codigo),
    onSuccess: () => invalidarTodoDeCuentas(clienteConsultas),
  });
}

/** Altas, ediciones y bajas de sitios y puertas de una cuenta: todas refrescan la misma estructura. */
export function useGestionDeEstructura(cuentaId: string) {
  const repositorio = useCuentasRepositorio();
  const clienteConsultas = useQueryClient();
  const refrescar = async () => {
    await Promise.all([
      clienteConsultas.invalidateQueries({ queryKey: [...CLAVE_CUENTAS, 'puertas', cuentaId] }),
      clienteConsultas.invalidateQueries({ queryKey: [...CLAVE_CUENTAS, 'detalle', cuentaId] }),
      clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
    ]);
  };
  const opciones = { onSuccess: refrescar };
  return {
    crearSitio: useMutation({
      mutationFn: (datos: DatosDeSitio) => repositorio.crearSitio(cuentaId, datos),
      ...opciones,
    }),
    editarSitio: useMutation({
      mutationFn: (p: { sitioId: string; cambios: Partial<DatosDeSitio> & { activo?: boolean } }) =>
        repositorio.editarSitio(cuentaId, p.sitioId, p.cambios),
      ...opciones,
    }),
    eliminarSitio: useMutation({
      mutationFn: (sitioId: string) => repositorio.eliminarSitio(cuentaId, sitioId),
      ...opciones,
    }),
    crearPuerta: useMutation({
      mutationFn: (p: { sitioId: string; datos: DatosDePuerta }) =>
        repositorio.crearPuerta(cuentaId, p.sitioId, p.datos),
      ...opciones,
    }),
    editarPuerta: useMutation({
      mutationFn: (p: {
        puertaId: string;
        cambios: Partial<DatosDePuerta> & { activa?: boolean };
      }) => repositorio.editarPuerta(cuentaId, p.puertaId, p.cambios),
      ...opciones,
    }),
    eliminarPuerta: useMutation({
      mutationFn: (puertaId: string) => repositorio.eliminarPuerta(cuentaId, puertaId),
      ...opciones,
    }),
  };
}
