import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { tienePermiso } from '../../../plugins/permisos.js';
import { RepositorioDeQr } from '../repository.js';

export interface ResumenDeQr {
  vigentes: number;
  usados: number;
  vencidos: number;
  anulados: number;
}

/** Cuántos QR hay en cada estado, con el mismo alcance que el listado (HU-13). */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  ahora: Date = new Date(),
): Promise<ResumenDeQr> {
  const conteos = await new RepositorioDeQr(pool).contarPorEstado(
    tienePermiso(principal, 'accesos.qr.ver_todos') ? null : principal.usuarioId,
    ahora,
  );
  return {
    vigentes: conteos.vigente,
    usados: conteos.usado,
    vencidos: conteos.vencido,
    anulados: conteos.anulado,
  };
}
