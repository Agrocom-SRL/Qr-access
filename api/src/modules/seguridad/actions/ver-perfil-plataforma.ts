import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { aIsoONulo } from '../../../platform/tiempo/fechas.js';
import { RepositorioDeSesionesDeSuperAdmins, RepositorioDeSuperAdmins } from '../repository.js';

export interface PerfilDePlataforma {
  id: string;
  nombre: string | null;
  usuario: string;
  creado_at: string;
  ultimo_ingreso_at: string | null;
  debe_cambiar_contrasena: boolean;
  permisos: string[];
}

/** El perfil del super admin autenticado (A12). */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
): Promise<PerfilDePlataforma> {
  const admin = await new RepositorioDeSuperAdmins(pool).buscarActivoPorId(principal.usuarioId);
  if (admin === null) throw new ErrorDeDominio('autenticacion.requerida', 401);
  const ingresos = await new RepositorioDeSesionesDeSuperAdmins(pool).ultimoIngresoDe([admin.id]);
  return {
    id: admin.id,
    nombre: admin.etiqueta,
    usuario: admin.username,
    creado_at: admin.created_at.toISOString(),
    ultimo_ingreso_at: aIsoONulo(ingresos.get(admin.id) ?? null),
    debe_cambiar_contrasena: admin.contrasena_temporal === 1,
    permisos: [...principal.permisos].sort(),
  };
}
