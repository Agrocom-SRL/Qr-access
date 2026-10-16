import type { Pool } from 'mysql2/promise';
import { normalizarUsername } from '../domain/super-admin.js';
import { RepositorioDeSuperAdmins } from '../repository.js';

/** ¿Se puede usar este usuario para un super admin nuevo? (validación en vivo de A11b) */
export async function ejecutar(pool: Pool, usuario: string): Promise<{ disponible: boolean }> {
  const normalizado = normalizarUsername(usuario);
  if (normalizado === null) return { disponible: false };
  return { disponible: !(await new RepositorioDeSuperAdmins(pool).existeUsername(normalizado)) };
}
