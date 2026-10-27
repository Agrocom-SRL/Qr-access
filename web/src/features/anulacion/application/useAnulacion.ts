import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAnulacionRepositorio } from './contextos';

/**
 * Anula los QR vigentes de la cuenta. Al terminar refresca la bitácora, donde queda la constancia del motivo.
 * La mutación devuelve solo el recuento; no se guarda nada más de la respuesta.
 */
export function useAnularQrDeCuenta(cuentaId: string) {
  const repositorio = useAnulacionRepositorio();
  const clienteConsultas = useQueryClient();
  return useMutation({
    mutationFn: (motivo: string) => repositorio.anularCuenta(cuentaId, motivo),
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: ['bitacora'] });
    },
  });
}
