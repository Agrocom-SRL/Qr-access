import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { cambiarEstadoDeUsuario } from '../cambio-de-estado.js';

/**
 * Restringe a un usuario de la rama del actor (ADR 0033 §1, D-25): él y toda su rama dejan de generar QR
 * nuevos (`qr.generacion_restringida`), pero conservan la sesión, consultan y sus QR ya generados siguen
 * abriendo hasta vencer. El motivo es obligatorio. Ver `cambiarEstadoDeUsuario` para las reglas de quién
 * puede y qué no se levanta desde abajo.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  motivo: string,
  ahora: Date = new Date(),
): Promise<void> {
  await cambiarEstadoDeUsuario(
    pool,
    principal,
    usuarioId,
    { estado: 'restringido', motivo },
    ahora,
  );
}
