import { useMutation } from '@tanstack/react-query';
import { descargarPagina, type PedidoDePagina } from './descargarPagina';
import { useExportacionesRepositorio } from './contextos';

/**
 * Baja una página de datos de la cuenta. Es una acción, no una lectura en caché: la mutación devuelve solo el
 * resumen de la página (cifras), nunca el CSV, así que no se guarda ningún dato de la cuenta en TanStack Query.
 */
export function useDescargarPagina(cuentaId: string, codigoCuenta: string) {
  const repositorio = useExportacionesRepositorio();
  return useMutation({
    mutationFn: (pedido: PedidoDePagina) =>
      descargarPagina(repositorio, cuentaId, codigoCuenta, pedido),
  });
}
