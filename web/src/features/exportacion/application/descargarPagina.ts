import { descargarArchivo } from '../../../shared/lib/descargas';
import type { ExportacionesRepositorio } from '../api/ExportacionesRepositorio';
import {
  conBomDeExcel,
  nombreDeArchivo,
  type FiltrosDeExportacion,
  type RecursoExportable,
  type ResumenDePagina,
} from '../domain/exportacion';

export interface PedidoDePagina {
  recurso: RecursoExportable;
  pagina: number;
  filtros: FiltrosDeExportacion;
}

/**
 * Baja una página y devuelve solo su resumen: el CSV pasa del repositorio a la descarga y de ahí no queda en
 * ningún estado (invariante: los datos de una cuenta no se guardan más de lo necesario). Sin filas no baja nada.
 * La descarga se inyecta (DIP): los tests la cambian por un espía.
 */
export async function descargarPagina(
  repositorio: ExportacionesRepositorio,
  cuentaId: string,
  codigoCuenta: string,
  pedido: PedidoDePagina,
  descargar: (nombre: string, contenido: Blob) => void = descargarArchivo,
): Promise<ResumenDePagina> {
  const pagina = await repositorio.pagina(cuentaId, pedido.recurso, {
    pagina: pedido.pagina,
    filtros: pedido.filtros,
  });
  if (pagina.resumen.total > 0) {
    descargar(
      nombreDeArchivo(pedido.recurso, codigoCuenta, pagina.resumen.pagina),
      conBomDeExcel(pagina.csv),
    );
  }
  return pagina.resumen;
}
