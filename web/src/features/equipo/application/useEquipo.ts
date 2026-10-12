import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { usuarioConFormatoValido } from '../domain/equipo';
import { useEquipoRepositorio } from './contextos';

const CLAVE_EQUIPO = ['equipo'] as const;

export function useEquipo() {
  const repositorio = useEquipoRepositorio();
  return useQuery({ queryKey: [...CLAVE_EQUIPO, 'lista'], queryFn: () => repositorio.listar() });
}

/** Disponibilidad del usuario con debounce de 300 ms; sin consulta si el formato no sirve. */
export function useUsuarioDisponible(usuario: string) {
  const repositorio = useEquipoRepositorio();
  const retrasado = useDebounce(usuario.trim().toLowerCase(), 300);
  const consulta = useQuery({
    queryKey: [...CLAVE_EQUIPO, 'usuario-disponible', retrasado],
    queryFn: () => repositorio.usuarioDisponible(retrasado),
    enabled: usuarioConFormatoValido(retrasado),
  });
  const esperando = retrasado !== usuario.trim().toLowerCase() || consulta.isFetching;
  return {
    /** `undefined` mientras no se sabe (formato inválido, vacío o consultando). */
    disponible: esperando || !usuarioConFormatoValido(retrasado) ? undefined : consulta.data,
    verificando: usuarioConFormatoValido(usuario.trim().toLowerCase()) && esperando,
  };
}

export function useAgregarMiembro() {
  const repositorio = useEquipoRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: repositorio.agregar,
    onSuccess: () => clienteConsultas.invalidateQueries({ queryKey: CLAVE_EQUIPO }),
  });
}

export function useDesactivarMiembro() {
  const repositorio = useEquipoRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositorio.desactivar(id),
    onSuccess: () => clienteConsultas.invalidateQueries({ queryKey: CLAVE_EQUIPO }),
  });
}
