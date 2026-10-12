import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSeguridadRepositorio } from './contextos';
import { useSesion } from './SesionProvider';

const CLAVE_PERFIL = ['seguridad', 'perfil'] as const;

/** Caso de uso "ingresar": al terminar bien deja la sesión en la interfaz. */
export function useIngresar() {
  const repositorio = useSeguridadRepositorio();
  const { iniciar } = useSesion();
  return useMutation({
    mutationFn: ({ usuario, contrasena }: { usuario: string; contrasena: string }) =>
      repositorio.ingresar(usuario, contrasena),
    onSuccess: iniciar,
  });
}

export function usePerfil() {
  const repositorio = useSeguridadRepositorio();
  const { sesion } = useSesion();
  return useQuery({
    queryKey: CLAVE_PERFIL,
    queryFn: () => repositorio.obtenerPerfil(),
    enabled: sesion !== null,
  });
}

/** Cambia el nombre del perfil y lo refleja también en la sesión (la barra lateral lo muestra). */
export function useCambiarNombre() {
  const repositorio = useSeguridadRepositorio();
  const clienteConsultas = useQueryClient();
  const { sesion, iniciar } = useSesion();
  return useMutation({
    mutationFn: (nombre: string) => repositorio.cambiarNombre(nombre),
    onSuccess: async (_, nombre) => {
      if (sesion) iniciar({ ...sesion, usuario: { ...sesion.usuario, nombre: nombre.trim() } });
      await Promise.all([
        clienteConsultas.invalidateQueries({ queryKey: CLAVE_PERFIL }),
        clienteConsultas.invalidateQueries({ queryKey: ['equipo'] }),
      ]);
    },
  });
}

export function useCambiarContrasena() {
  const repositorio = useSeguridadRepositorio();
  const clienteConsultas = useQueryClient();
  const { sesion, iniciar } = useSesion();
  return useMutation({
    mutationFn: ({ actual, nueva }: { actual: string; nueva: string }) =>
      repositorio.cambiarContrasena(actual, nueva),
    onSuccess: async () => {
      // Ya no es temporal: se libera la interfaz sin pedir otro ingreso.
      if (sesion) iniciar({ ...sesion, debeCambiarContrasena: false });
      await clienteConsultas.invalidateQueries({ queryKey: CLAVE_PERFIL });
    },
  });
}

/** Cierra la sesión y descarta TODO lo cacheado (nada de una sesión pasa a la siguiente). */
export function useCerrarSesion() {
  const repositorio = useSeguridadRepositorio();
  const clienteConsultas = useQueryClient();
  const { terminar } = useSesion();
  return useMutation({
    // Se marca como cierre voluntario antes de limpiar los tokens: no es una sesión vencida.
    onMutate: terminar,
    mutationFn: () => repositorio.cerrarSesion(),
    onSettled: () => {
      clienteConsultas.clear();
    },
  });
}
