import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { aIsoONulo } from '../../../platform/tiempo/fechas.js';
import {
  RepositorioDeCuentasDePlataforma,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { regenerarPinDeUsuario, type PinGenerado } from './regenerar-pin.js';

export interface AdministradorDeCuenta {
  id: string;
  etiqueta: string | null;
  pin_generado_at: string | null;
  ultimo_ingreso_at: string | null;
}

async function cuentaODeLaPlataforma(pool: Pool, cuentaId: string) {
  const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  return cuenta;
}

/** Los administradores activos de una cuenta (A05a): a ellos AGROCOM les regenera el PIN si lo olvidan. */
export async function listar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
): Promise<AdministradorDeCuenta[]> {
  const cuenta = await cuentaODeLaPlataforma(pool, cuentaId);
  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const ids = await new RepositorioDeRolesDeUsuario(pool).idsDeAdministradores();
    const [usuarios, ingresos] = await Promise.all([
      new RepositorioDeUsuarios(pool).buscarPorIds(ids),
      new RepositorioDeSesiones(pool).ultimoIngresoDe(ids),
    ]);
    return usuarios.map((usuario) => ({
      id: usuario.id,
      etiqueta: usuario.etiqueta,
      pin_generado_at: aIsoONulo(usuario.pin_generado_at),
      ultimo_ingreso_at: aIsoONulo(ingresos.get(usuario.id) ?? null),
    }));
  });
}

/**
 * Regenera el PIN de un administrador de la cuenta. AGROCOM solo emite y restablece el PIN de los
 * administradores; ellos crean y regeneran los de sus usuarios (ADR 0023). Nadie conoce el PIN
 * anterior: el nuevo se muestra una sola vez y el anterior y sus sesiones dejan de servir.
 */
export async function regenerarPin(
  servicios: Pick<ServiciosDeSeguridad, 'pool' | 'config'>,
  principal: PrincipalPlataforma,
  cuentaId: string,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<PinGenerado> {
  const cuenta = await cuentaODeLaPlataforma(servicios.pool, cuentaId);
  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const administradores = await new RepositorioDeRolesDeUsuario(
      servicios.pool,
    ).idsDeAdministradores();
    // Un usuario que no es administrador de ESTA cuenta no existe para este endpoint.
    if (!administradores.includes(usuarioId))
      throw new ErrorDeDominio('usuario.no_encontrado', 404);
    return regenerarPinDeUsuario(servicios, cuenta, usuarioId, ahora);
  });
}
