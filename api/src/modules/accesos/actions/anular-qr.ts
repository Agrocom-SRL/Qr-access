import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { tienePermiso } from '../../../plugins/permisos.js';
import { presentarQr, type QrListado } from '../presentacion.js';
import { RepositorioDeQr, type QrFila } from '../repository.js';

/**
 * Anula un QR antes de que se use (HU-13). Quien lo emitió puede anularlo; anular el de otro
 * exige `accesos.qr.anular_todos`. Uno ajeno o de otra cuenta no existe: 404. Anular dos veces
 * es inofensivo; anular uno ya usado es un conflicto (409).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  qrId: string,
  ahora: Date = new Date(),
): Promise<QrListado> {
  const repositorio = new RepositorioDeQr(pool);
  const encontrado = await repositorio.buscarPorId(qrId);
  const esDeOtro = encontrado !== null && encontrado.emitido_por !== principal.usuarioId;
  if (encontrado === null || (esDeOtro && !tienePermiso(principal, 'accesos.qr.anular_todos'))) {
    throw new ErrorDeDominio('qr.no_encontrado', 404);
  }

  let actual: QrFila = encontrado;
  if (actual.usado_at !== null) throw new ErrorDeDominio('qr.ya_usado', 409);

  if (actual.anulado_at === null) {
    const anulado = await enTransaccion(pool, (tx) =>
      repositorio.anular(tx, qrId, principal.usuarioId, ahora),
    );
    if (!anulado) {
      // Alguien lo usó o lo anuló entre la lectura y el UPDATE: se vuelve a leer para decidir.
      const releido = await repositorio.buscarPorId(qrId);
      if (releido === null) throw new ErrorDeDominio('qr.no_encontrado', 404);
      if (releido.usado_at !== null) throw new ErrorDeDominio('qr.ya_usado', 409);
      actual = releido;
    } else {
      actual = { ...actual, anulado_at: ahora };
    }
  }

  const [presentado] = await presentarQr(pool, [actual], ahora);
  if (presentado === undefined) throw new ErrorDeDominio('qr.no_encontrado', 404);
  return presentado;
}
