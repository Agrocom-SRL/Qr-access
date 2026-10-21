import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import { calcularCupo, type EstadoDelCupo } from '../domain/cupo.js';
import { RepositorioDeCuentas, RepositorioDeUsuarios } from '../repository.js';

export interface CupoDeLaCuenta extends EstadoDelCupo {
  readonly max_miembros_por_titular: number;
}

/**
 * Cuánto del cupo de usuarios del plan usa la cuenta (ADR 0028 §6): cuentan todos los niveles,
 * así que cada Administrador ve el total de la cuenta aunque solo gestione su rama. Lo ve quien
 * tenga `seguridad.cupo.ver` (el Administrador); sin suscripción vigente el plan no limita nada.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  ahora: Date = new Date(),
): Promise<CupoDeLaCuenta> {
  const [cuenta, suscripcion, usados] = await Promise.all([
    new RepositorioDeCuentas(pool).buscarActivaPorId(principal.cuentaId),
    crearServicioDeSuscripciones(pool).obtenerVigente(ahora),
    new RepositorioDeUsuarios(pool).contarTodos(),
  ]);
  if (cuenta === null) throw new ErrorDeDominio('autenticacion.requerida', 401);
  return {
    ...calcularCupo(usados, suscripcion?.maxUsuarios ?? null),
    max_miembros_por_titular: cuenta.max_miembros_por_titular,
  };
}
