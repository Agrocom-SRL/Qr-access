import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { tienePermiso } from '../../../plugins/permisos.js';
import type { EstadoDeQr } from '../domain/estado-qr.js';
import { presentarQr, type QrListado } from '../presentacion.js';
import { RepositorioDeQr } from '../repository.js';

/**
 * Los QR que el usuario puede ver: los suyos, o todos los de la cuenta si su rol activo tiene
 * `accesos.qr.ver_todos` (HU-13).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  filtros: { estado: EstadoDeQr | null; paginacion: Paginacion },
  ahora: Date = new Date(),
): Promise<Listado<QrListado>> {
  const filtro = {
    estado: filtros.estado,
    emitidoPor: tienePermiso(principal, 'accesos.qr.ver_todos') ? null : principal.usuarioId,
    ahora,
  };
  const { limite, desplazamiento } = limiteDe(filtros.paginacion);
  const repositorio = new RepositorioDeQr(pool);
  const [filas, total] = await Promise.all([
    repositorio.listar(filtro, limite, desplazamiento),
    repositorio.contarFiltrados(filtro),
  ]);
  return armarListado(await presentarQr(pool, filas, ahora), filtros.paginacion, total);
}
