import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSesionesRepositorio } from './contextos';

/** Clave raíz de las sesiones: cualquier cierre la invalida. */
export const CLAVE_SESIONES = ['sesiones'] as const;

const claveDeUsuario = (cuentaId: string, usuarioId: string) =>
  [...CLAVE_SESIONES, cuentaId, usuarioId] as const;

/** Los dispositivos conectados de un usuario; el diálogo los pide al abrirse. */
export function useSesionesDeUsuario(cuentaId: string, usuarioId: string) {
  const repositorio = useSesionesRepositorio();
  return useQuery({
    queryKey: claveDeUsuario(cuentaId, usuarioId),
    queryFn: () => repositorio.listar(cuentaId, usuarioId),
  });
}

/** Cierra una sesión y refresca la lista del usuario. */
export function useCerrarSesion(cuentaId: string, usuarioId: string) {
  const repositorio = useSesionesRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (sesionId: string) => repositorio.cerrar(cuentaId, usuarioId, sesionId),
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: claveDeUsuario(cuentaId, usuarioId) });
    },
  });
}

/** Cierra todas las sesiones del usuario (la API también anula sus QR vigentes). */
export function useCerrarTodasLasSesiones(cuentaId: string, usuarioId: string) {
  const repositorio = useSesionesRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: () => repositorio.cerrarTodas(cuentaId, usuarioId),
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: claveDeUsuario(cuentaId, usuarioId) });
    },
  });
}
