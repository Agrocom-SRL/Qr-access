import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeCuentas, RepositorioDeUsuarios } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { regenerarPinDeUsuario, type PinGenerado } from './regenerar-pin.js';

export type { PinGenerado } from './regenerar-pin.js';

/**
 * Regenera el PIN de un usuario de la rama del actor (HU-06): solo el nivel superior lo hace, sin
 * conocer nunca el PIN anterior (ADR 0018 §2, ADR 0028 §4). Uno de otra rama no existe: 404.
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
  const enLaRama = await new RepositorioDeUsuarios(servicios.pool).buscarEnRama(
    principal.usuarioId,
    usuarioId,
  );
  if (enLaRama === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  return regenerarPinDeUsuario(servicios, cuenta, usuarioId, ahora, sufijoElegido);
}
