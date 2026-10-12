import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSuscripcionesRepositorio } from './contextos';

/** Todo lo de la suscripción de una cuenta cuelga de la clave de cuentas, para invalidarse junto con ella. */
const claveDe = (cuentaId: string) => ['cuentas', 'suscripcion', cuentaId] as const;

export function useSuscripcionDeCuenta(cuentaId: string) {
  const repositorio = useSuscripcionesRepositorio();
  return useQuery({ queryKey: claveDe(cuentaId), queryFn: () => repositorio.obtener(cuentaId) });
}

/** Tras cambiar una suscripción se refrescan la cuenta, la cobranza, el resumen y la bitácora. */
function useInvalidarTrasCambio(cuentaId: string) {
  const clienteConsultas = useQueryClient();
  return async () => {
    await Promise.all([
      clienteConsultas.invalidateQueries({ queryKey: ['cuentas'] }),
      clienteConsultas.invalidateQueries({ queryKey: claveDe(cuentaId) }),
      clienteConsultas.invalidateQueries({ queryKey: ['cobranza'] }),
      clienteConsultas.invalidateQueries({ queryKey: ['resumen'] }),
      clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] }),
    ]);
  };
}

export function useCambiarPlan(cuentaId: string) {
  const repositorio = useSuscripcionesRepositorio();
  const invalidar = useInvalidarTrasCambio(cuentaId);
  return useMutation({
    mutationFn: (planId: string) => repositorio.cambiarPlan(cuentaId, planId),
    onSuccess: invalidar,
  });
}

export function useSuspender(cuentaId: string) {
  const repositorio = useSuscripcionesRepositorio();
  const invalidar = useInvalidarTrasCambio(cuentaId);
  return useMutation({ mutationFn: () => repositorio.suspender(cuentaId), onSuccess: invalidar });
}

export function useReactivar(cuentaId: string) {
  const repositorio = useSuscripcionesRepositorio();
  const invalidar = useInvalidarTrasCambio(cuentaId);
  return useMutation({ mutationFn: () => repositorio.reactivar(cuentaId), onSuccess: invalidar });
}

/** Para otros módulos (pagos): refresca lo que cambia al registrar un pago. */
export function useInvalidarSuscripcion(cuentaId: string) {
  return useInvalidarTrasCambio(cuentaId);
}
