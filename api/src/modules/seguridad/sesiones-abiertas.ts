import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import { armarListado, type Listado } from '../../platform/http/paginacion.js';
import { enTransaccion, type Transaccion } from '../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../platform/seguridad/principal.js';
import type { AlmacenDeSesiones } from './apertura-de-sesion.js';
import { presentarSesion, type SesionAbierta } from './domain/sesion.js';
import {
  RepositorioDeCuentasDePlataforma,
  RepositorioDeUsuarios,
  type CierreSolicitado,
  type SesionDetalleFila,
} from './repository.js';

/**
 * Lo común de listar y cerrar sesiones (ADR 0030 §4.1). Lo comparten las de una cuenta y las de un super admin
 * (cada una con su repositorio) y las tres vías de cierre: el dueño, su superior y AGROCOM. Vive acá y no en una
 * acción porque son doce acciones con la misma mecánica y cada acción es un archivo con una sola función.
 */
export interface RepositorioDeSesionesAbiertas extends AlmacenDeSesiones {
  vivasDe(usuarioId: string, ahora: Date, tx?: Transaccion): Promise<SesionDetalleFila[]>;
  buscarVivaDe(usuarioId: string, id: string, ahora: Date): Promise<SesionDetalleFila | null>;
  cerrarVivasDe(
    tx: Transaccion,
    usuarioId: string,
    ahora: Date,
    cierre: CierreSolicitado,
    exceptoId?: string | null,
  ): Promise<number>;
}

/** Las sesiones vivas de un usuario. Acotado por el tope de sesiones por usuario: sin paginar. */
export async function listarSesiones(
  repositorio: RepositorioDeSesionesAbiertas,
  usuarioId: string,
  sesionActualId: string | null,
  ahora: Date,
): Promise<Listado<SesionAbierta>> {
  const filas = await repositorio.vivasDe(usuarioId, ahora);
  const datos = filas.map((fila) => presentarSesion(fila, sesionActualId));
  return armarListado(datos, { pagina: 1, por_pagina: Math.max(datos.length, 1) }, datos.length);
}

/** Cierra UNA sesión viva del usuario; si no existe (o ya estaba cerrada) responde 404. */
export async function cerrarUnaSesion(
  pool: Pool,
  repositorio: RepositorioDeSesionesAbiertas,
  usuarioId: string,
  sesionId: string,
  cierre: CierreSolicitado,
  ahora: Date,
): Promise<void> {
  if ((await repositorio.buscarVivaDe(usuarioId, sesionId, ahora)) === null) {
    throw new ErrorDeDominio('sesion.no_encontrada', 404);
  }
  const cerrada = await enTransaccion(pool, (tx) =>
    repositorio.cerrar(tx, sesionId, ahora, cierre),
  );
  // Otra petición la cerró entre la lectura y el cierre.
  if (!cerrada) throw new ErrorDeDominio('sesion.no_encontrada', 404);
}

/**
 * Cierra las sesiones vivas del usuario (todas, o todas menos `exceptoId`) y devuelve cuántas. `ademas` corre en
 * la MISMA transacción: así el cierre y lo que lo acompaña (anular sus QR) quedan los dos o ninguno.
 */
export function cerrarSesiones(
  pool: Pool,
  repositorio: RepositorioDeSesionesAbiertas,
  usuarioId: string,
  cierre: CierreSolicitado,
  ahora: Date,
  opciones: { exceptoId?: string | null; ademas?: (tx: Transaccion) => Promise<void> } = {},
): Promise<number> {
  return enTransaccion(pool, async (tx) => {
    const cerradas = await repositorio.cerrarVivasDe(
      tx,
      usuarioId,
      ahora,
      cierre,
      opciones.exceptoId ?? null,
    );
    await opciones.ademas?.(tx);
    return cerradas;
  });
}

/**
 * AGROCOM opera DENTRO de la cuenta (ADR 0004 §7) sobre un usuario suyo: comprueba que la cuenta exista y que el
 * usuario sea de ESA cuenta (de otra, o eliminado, no existe: 404) y corre `fn` con el contexto de esa cuenta y la
 * bitácora firmada con el usuario de AGROCOM. Salto explícito del aislamiento: lo invocan solo acciones de
 * plataforma ya autorizadas por permiso.
 */
export async function enUsuarioDeCuenta<T>(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  usuarioId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    if ((await new RepositorioDeUsuarios(pool).buscarPorId(usuarioId)) === null) {
      throw new ErrorDeDominio('usuario.no_encontrado', 404);
    }
    return fn();
  });
}
