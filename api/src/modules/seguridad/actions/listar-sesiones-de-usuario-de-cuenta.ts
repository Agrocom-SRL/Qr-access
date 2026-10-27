import type { Pool } from 'mysql2/promise';
import type { Listado } from '../../../platform/http/paginacion.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import type { SesionAbierta } from '../domain/sesion.js';
import { RepositorioDeSesiones } from '../repository.js';
import { enUsuarioDeCuenta, listarSesiones } from '../sesiones-abiertas.js';

/** AGROCOM ve los dispositivos conectados de cualquier usuario de una cuenta (ADR 0030 §4.1). Otra cuenta o usuario ajeno: 404. */
export function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<Listado<SesionAbierta>> {
  return enUsuarioDeCuenta(pool, principal, cuentaId, usuarioId, () =>
    listarSesiones(new RepositorioDeSesiones(pool), usuarioId, null, ahora),
  );
}
