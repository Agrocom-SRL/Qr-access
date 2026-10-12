import type { Pool } from 'mysql2/promise';
import type { Almacenamiento } from '../../../platform/almacenamiento/almacenamiento.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { RepositorioDeComprobantes } from '../repository.js';

/** El archivo de un comprobante y su tipo, para entregarlo por la API (nunca desde una carpeta pública). */
export async function ejecutar(
  pool: Pool,
  almacen: Almacenamiento,
  id: string,
): Promise<{ contenido: Buffer; tipoMime: string }> {
  const fila = await new RepositorioDeComprobantes(pool).buscarPorId(id);
  if (fila === null) throw new ErrorDeDominio('comprobante.no_encontrado', 404);
  try {
    return { contenido: await almacen.leer(fila.ruta), tipoMime: fila.tipo_mime };
  } catch {
    // La fila existe pero el archivo no: se trata como inexistente, sin revelar rutas.
    throw new ErrorDeDominio('comprobante.no_encontrado', 404);
  }
}
