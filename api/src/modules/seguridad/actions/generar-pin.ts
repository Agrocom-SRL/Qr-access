import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import {
  RepositorioDeCuentas,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { conPinNuevo } from './pin-nuevo.js';

export interface PinGenerado {
  /** El PIN en claro: existe solo en esta respuesta y se muestra una sola vez (ADR 0018 §3). */
  pin: string;
  pin_generado_at: string;
}

/**
 * Regenera el PIN de un usuario de la cuenta (HU-06). El anterior deja de servir y todas sus
 * sesiones se cortan en la misma transacción (ADR 0018 §2).
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool' | 'config'>,
  principal: PrincipalUsuario,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<PinGenerado> {
  const { pool } = servicios;
  const usuarios = new RepositorioDeUsuarios(pool);
  if ((await usuarios.buscarPorId(usuarioId)) === null) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  const cuenta = await new RepositorioDeCuentas(pool).buscarActivaPorId(principal.cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('autenticacion.requerida', 401);

  const pin = await enTransaccion(pool, async (tx) => {
    const completo = await conPinNuevo(
      tx,
      cuenta,
      servicios.config.PIN_PIMIENTA,
      async (sorteo) => {
        await usuarios.cambiarPin(tx, usuarioId, {
          pinIndice: sorteo.indice,
          pinHash: sorteo.hash,
          ahora,
        });
      },
    );
    await new RepositorioDeSesiones(pool).revocarTodasDe(tx, usuarioId, ahora);
    return completo;
  });
  return { pin, pin_generado_at: aIso(ahora) };
}
