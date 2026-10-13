import { randomUUID } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import type { Almacenamiento } from '../../../platform/almacenamiento/almacenamiento.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { detectarTipo, EXTENSION_DE } from '../../../platform/archivos/tipo-de-archivo.js';
import { RepositorioDeComprobantes } from '../repository.js';

export const MAX_BYTES_DE_COMPROBANTE = 5 * 1024 * 1024;

export interface ComprobanteSubido {
  id: string;
  tipo_mime: string;
  tamano: number;
}

/**
 * Guarda el comprobante de un pago (ADR 0024). El tipo se decide por los bytes, nunca por lo que
 * declare el cliente; el archivo se guarda con un nombre aleatorio y la base solo recibe la ruta.
 * Si la fila no se puede escribir, el archivo queda huérfano pero inofensivo (nadie lo referencia).
 */
export async function ejecutar(
  pool: Pool,
  almacen: Almacenamiento,
  contenido: Buffer,
): Promise<ComprobanteSubido> {
  if (contenido.length === 0) throw new ErrorDeDominio('comprobante.vacio', 422);
  if (contenido.length > MAX_BYTES_DE_COMPROBANTE) {
    throw new ErrorDeDominio('comprobante.muy_grande', 413);
  }
  const tipo = detectarTipo(contenido);
  if (tipo === null) throw new ErrorDeDominio('comprobante.formato_invalido', 422);

  const ruta = `comprobantes/${randomUUID()}.${EXTENSION_DE[tipo]}`;
  await almacen.guardar(ruta, contenido);
  const id = await enTransaccion(pool, (tx) =>
    new RepositorioDeComprobantes(pool).registrar(tx, {
      ruta,
      tipoMime: tipo,
      tamano: contenido.length,
    }),
  );
  return { id, tipo_mime: tipo, tamano: contenido.length };
}
