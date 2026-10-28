import type { Pool } from 'mysql2/promise';
import type { Listado } from '../../../platform/http/paginacion.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import type { SesionAbierta } from '../domain/sesion.js';
import { RepositorioDeSesiones } from '../repository.js';
import { listarSesiones } from '../sesiones-abiertas.js';

/** Mis dispositivos conectados: mis sesiones vivas, con la de esta petición marcada como `actual` (ADR 0030 §4.1). */
export function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  ahora: Date = new Date(),
): Promise<Listado<SesionAbierta>> {
  return listarSesiones(
    new RepositorioDeSesiones(pool),
    principal.usuarioId,
    principal.sesionId,
    ahora,
  );
}
