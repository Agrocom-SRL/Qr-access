import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { tienePermiso } from '../../../plugins/permisos.js';
import { nombresDePuertas } from '../presentacion.js';
import { RepositorioDeEventos } from '../repository.js';

export interface EventoListado {
  id: string;
  ocurrido_at: string;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  puerta: { id: string; nombre: string };
  qr_id: string | null;
}

/**
 * Los intentos de acceso que el usuario puede ver: los de los QR que emitió, o todos los de la
 * cuenta con `accesos.evento.ver_todos` (HU-15, HU-16).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  paginacion: Paginacion,
): Promise<Listado<EventoListado>> {
  const emitidoPor = tienePermiso(principal, 'accesos.evento.ver_todos')
    ? null
    : principal.usuarioId;
  const { limite, desplazamiento } = limiteDe(paginacion);
  const repositorio = new RepositorioDeEventos(pool);
  const [filas, total] = await Promise.all([
    repositorio.listar(emitidoPor, limite, desplazamiento),
    repositorio.contarVisibles(emitidoPor),
  ]);
  const nombres = await nombresDePuertas(
    pool,
    filas.map((fila) => fila.puerta_id),
  );
  return armarListado(
    filas.map((fila) => ({
      id: fila.id,
      ocurrido_at: aIso(fila.ocurrido_at),
      resultado: fila.resultado,
      motivo_code: fila.motivo_code,
      puerta: { id: fila.puerta_id, nombre: nombres.get(fila.puerta_id) ?? '' },
      qr_id: fila.qr_acceso_id,
    })),
    paginacion,
    total,
  );
}
