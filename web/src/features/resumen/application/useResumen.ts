import { useQuery } from '@tanstack/react-query';
import { useResumenRepositorio } from './contextos';

/** Clave raíz: las mutaciones de cuentas, pagos y planes la invalidan. */
export const CLAVE_RESUMEN = ['resumen'] as const;

/** El tablero se refresca solo: un acceso o un latido nuevo se ve sin recargar la página. */
export const REFRESCO_EN_VIVO_MS = 10_000;

export function useResumen() {
  const repositorio = useResumenRepositorio();
  return useQuery({
    queryKey: CLAVE_RESUMEN,
    queryFn: () => repositorio.obtener(),
    refetchInterval: REFRESCO_EN_VIVO_MS,
  });
}
