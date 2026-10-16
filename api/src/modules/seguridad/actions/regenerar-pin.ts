import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import { RepositorioDeSesiones, RepositorioDeUsuarios } from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { conPinNuevo } from './pin-nuevo.js';

export interface PinGenerado {
  /** El PIN en claro: existe solo en esta respuesta y se muestra una sola vez (ADR 0018 §3). */
  pin: string;
  pin_generado_at: string;
}

/**
 * Sortea un PIN nuevo para un usuario de la cuenta del contexto: el anterior deja de servir y
 * todas sus sesiones se cortan en la misma transacción (ADR 0018 §2). Lo comparten el
 * administrador de la cuenta (HU-06) y el super admin (que regenera el PIN de un administrador).
 */
export async function regenerarPinDeUsuario(
  servicios: Pick<ServiciosDeSeguridad, 'pool' | 'config'>,
  cuenta: { readonly id: string; readonly codigo: string },
  usuarioId: string,
  ahora: Date,
  sufijoElegido?: string,
): Promise<PinGenerado> {
  const { pool } = servicios;
  const usuarios = new RepositorioDeUsuarios(pool);
  if ((await usuarios.buscarPorId(usuarioId)) === null) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
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
      sufijoElegido,
    );
    await new RepositorioDeSesiones(pool).revocarTodasDe(tx, usuarioId, ahora);
    return completo;
  });
  return { pin, pin_generado_at: aIso(ahora) };
}
