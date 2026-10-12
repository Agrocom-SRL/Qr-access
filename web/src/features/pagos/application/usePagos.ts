import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useInvalidarSuscripcion } from '../../suscripciones';
import type { FormularioDePago, TipoDePago, VentanaDeCobranza } from '../domain/pago';
import { parsearMonto } from '../domain/pago';
import { usePagosRepositorio } from './contextos';

/** Clave raíz de la cobranza; los cambios de suscripción y los pagos la invalidan. */
export const CLAVE_COBRANZA = ['cobranza'] as const;

export function useCobranza(ventana: VentanaDeCobranza, busqueda: string) {
  const repositorio = usePagosRepositorio();
  const retrasada = useDebounce(busqueda, 300);
  return useQuery({
    queryKey: [...CLAVE_COBRANZA, ventana, retrasada],
    queryFn: () => repositorio.cobranza({ ventana, busqueda: retrasada }),
    placeholderData: keepPreviousData,
  });
}

/** Registra un pago: una renovación extiende la vigencia, así que refresca la cuenta y la cobranza. */
export function useRegistrarPago(cuentaId: string) {
  const repositorio = usePagosRepositorio();
  const invalidar = useInvalidarSuscripcion(cuentaId);
  return useMutation({
    mutationFn: ({ tipo, formulario }: { tipo: TipoDePago; formulario: FormularioDePago }) => {
      const monto = parsearMonto(formulario.monto);
      if (monto === null) return Promise.reject(new Error('monto inválido'));
      return repositorio.registrar(cuentaId, tipo, { ...formulario, monto });
    },
    onSuccess: invalidar,
  });
}
