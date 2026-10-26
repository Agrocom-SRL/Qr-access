import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormularioDeCuentaDeCobro } from '../domain/cuentaDeCobro';
import { useCobroRepositorio } from './contextos';

/** Clave de las cuentas de cobro; el alta y el registro de pago la leen para mostrar dónde pagar. */
export const CLAVE_COBRO = ['cuentas-de-cobro'] as const;

export function useCuentasDeCobro() {
  const repositorio = useCobroRepositorio();
  return useQuery({ queryKey: CLAVE_COBRO, queryFn: () => repositorio.listar() });
}

/** Tras cualquier cambio se refresca la lista y la bitácora (que registra quién lo hizo). */
function useInvalidarCobro() {
  const clienteConsultas = useQueryClient();
  return async () => {
    await Promise.all([
      clienteConsultas.invalidateQueries({ queryKey: CLAVE_COBRO }),
      clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
    ]);
  };
}

export function useCrearCuentaDeCobro() {
  const repositorio = useCobroRepositorio();
  return useMutation({
    mutationFn: (datos: FormularioDeCuentaDeCobro) => repositorio.crear(datos),
    onSuccess: useInvalidarCobro(),
  });
}

export function useEditarCuentaDeCobro() {
  const repositorio = useCobroRepositorio();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: FormularioDeCuentaDeCobro }) =>
      repositorio.editar(id, datos),
    onSuccess: useInvalidarCobro(),
  });
}

export function useCambiarActivoDeCuentaDeCobro() {
  const repositorio = useCobroRepositorio();
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      repositorio.cambiarActivo(id, activo),
    onSuccess: useInvalidarCobro(),
  });
}

export function useEliminarCuentaDeCobro() {
  const repositorio = useCobroRepositorio();
  return useMutation({
    mutationFn: (id: string) => repositorio.eliminar(id),
    onSuccess: useInvalidarCobro(),
  });
}

/** La imagen de un QR de cobro, lista para un `<img>` (la API la entrega con la sesión, no por URL pública). */
export function useImagenDeCobro(imagenId: string | null) {
  const repositorio = useCobroRepositorio();
  return useQuery({
    queryKey: ['cuentas-de-cobro', 'imagen', imagenId],
    enabled: imagenId !== null,
    staleTime: Infinity,
    queryFn: async () => URL.createObjectURL(await repositorio.verImagen(imagenId ?? '')),
  });
}
