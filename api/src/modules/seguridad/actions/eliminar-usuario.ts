import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { RepositorioDeSesiones, RepositorioDeUsuarios } from '../repository.js';

/**
 * Da de baja un usuario de la rama del actor (HU-06): su PIN deja de entrar y sus sesiones se cortan
 * en el acto (ADR 0018 §2). Nadie se da de baja a sí mismo: se quedaría sin administrador.
 *
 * Si tiene otros debajo (un Titular con sus Miembros) la baja es en cascada y exige confirmación
 * (ADR 0028 §7): sin `confirmar` responde 409 con cuántos caerían; con él, cae toda la rama, se
 * dan de baja las unidades de los Titulares que caen y todos los lugares del cupo se liberan.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  confirmar = false,
  ahora: Date = new Date(),
): Promise<void> {
  if (usuarioId === principal.usuarioId) throw new ErrorDeDominio('usuario.propio', 422);
  const usuarios = new RepositorioDeUsuarios(pool);
  if ((await usuarios.buscarEnRama(principal.usuarioId, usuarioId)) === null) {
    throw new ErrorDeDominio('usuario.no_encontrado', 404);
  }
  const debajo = await usuarios.idsDeRama(usuarioId);
  if (debajo.length > 0 && !confirmar) {
    throw new ErrorDeDominio('usuario.con_dependientes', 409, { dependientes: debajo.length });
  }

  const sesiones = new RepositorioDeSesiones(pool);
  await enTransaccion(pool, async (tx) => {
    // Primero lo de abajo y al final el propio usuario
    for (const id of [...debajo, usuarioId]) {
      await usuarios.darDeBaja(tx, id);
      await sesiones.revocarTodasDe(tx, id, ahora);
    }
    await crearServicioDeOrganizacion(pool).darDeBajaUnidadesDe(tx, [...debajo, usuarioId]);
  });
}
