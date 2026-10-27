import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { generarTokenOpaco, sha256Hex } from '../../../platform/seguridad/tokens.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import type { SesionRefrescada } from '../domain/sesion.js';
import { RepositorioDeSesionesDeSuperAdmins, RepositorioDeSuperAdmins } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

/**
 * Refresco rotativo de la sesión de un super admin: mismo contrato que el de una cuenta, pero
 * el JWT no lleva cuenta. Un super admin desactivado ya no refresca.
 */
export async function ejecutar(
  servicios: ServiciosDeSeguridad,
  sesionId: string,
  usuarioId: string,
  hashActual: string,
  ahora: Date,
  ip: string | null = null,
): Promise<SesionRefrescada> {
  const invalido = new ErrorDeDominio('sesion.refresco_invalido', 401);
  const admin = await new RepositorioDeSuperAdmins(servicios.pool).buscarActivoPorId(usuarioId);
  if (admin === null) throw invalido;

  const refresco = generarTokenOpaco(32);
  const rotada = await enTransaccion(servicios.pool, (tx) =>
    new RepositorioDeSesionesDeSuperAdmins(servicios.pool).rotar(
      tx,
      sesionId,
      hashActual,
      sha256Hex(refresco),
      sumarDias(ahora, servicios.config.JWT_REFRESH_DIAS),
      ahora,
      ip,
    ),
  );
  if (!rotada) throw invalido;

  const acceso = await servicios.jwt.firmar({
    usuarioId: admin.id,
    cuentaId: null,
    sesionId,
    rolActivoId: null,
  });
  return { acceso, refresco };
}
