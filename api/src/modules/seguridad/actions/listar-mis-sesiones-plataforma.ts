import type { Pool } from 'mysql2/promise';
import type { Listado } from '../../../platform/http/paginacion.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import type { SesionAbierta } from '../domain/sesion.js';
import { RepositorioDeSesionesDeSuperAdmins } from '../repository.js';
import { listarSesiones } from '../sesiones-abiertas.js';

/** Mis dispositivos conectados como super admin (el panel); solo ve filas de plataforma (`tenant_id NULL`). */
export function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  ahora: Date = new Date(),
): Promise<Listado<SesionAbierta>> {
  return listarSesiones(
    new RepositorioDeSesionesDeSuperAdmins(pool),
    principal.usuarioId,
    principal.sesionId,
    ahora,
  );
}
