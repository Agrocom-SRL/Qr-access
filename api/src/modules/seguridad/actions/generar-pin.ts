import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeCuentas } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { regenerarPinDeUsuario, type PinGenerado } from './regenerar-pin.js';

export type { PinGenerado } from './regenerar-pin.js';

/**
 * Regenera el PIN de un usuario de la cuenta (HU-06): el administrador de la cuenta lo hace con
 * cualquiera de sus usuarios, sin conocer nunca el PIN anterior (ADR 0018 §2).
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool' | 'config'>,
  principal: PrincipalUsuario,
  usuarioId: string,
  ahora: Date = new Date(),
  sufijoElegido?: string,
): Promise<PinGenerado> {
  const cuenta = await new RepositorioDeCuentas(servicios.pool).buscarActivaPorId(
    principal.cuentaId,
  );
  if (cuenta === null) throw new ErrorDeDominio('autenticacion.requerida', 401);
  return regenerarPinDeUsuario(servicios, cuenta, usuarioId, ahora, sufijoElegido);
}
