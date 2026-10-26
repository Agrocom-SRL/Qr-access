import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import {
  RepositorioDeCuentasDePlataforma,
  RepositorioDeUsuarios,
  SIN_ESTADO,
} from '../repository.js';

/**
 * Levanta la restricción o la suspensión PROPIA de un usuario de una cuenta (AGROCOM, ADR 0033 §1). Es la
 * salida de los estados que nadie de la cuenta puede levantar: lo impuesto sin autor (migrado), por un
 * Administrador que ya no está sobre el usuario o por AGROCOM. A diferencia de `reactivar-usuario`, no
 * mira quién lo impuso: AGROCOM levanta siempre.
 *
 * - Un usuario que no es de esa cuenta (o está eliminado) no existe: 404, también si es de otra cuenta.
 * - Compare-and-set sobre el estado leído: dos cambios a la vez no se pisan (409).
 * - Los QR que anuló una suspensión no reviven; los usuarios de su rama siguen con su propio estado.
 * - El motivo es obligatorio y lo valida la ruta; la bitácora registra quién, cuándo y el estado anterior
 *   (con su motivo y su autor). El motivo de la reactivación solo va al log de la petición: la bitácora
 *   no tiene dónde guardarlo.
 * Si el usuario ya está activo no hace nada.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  usuarioId: string,
): Promise<void> {
  const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  await ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const usuarios = new RepositorioDeUsuarios(pool);
    const usuario = await usuarios.buscarPorId(usuarioId);
    if (usuario === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
    if (usuario.estado === 'activo') return;

    await enTransaccion(pool, async (tx) => {
      const cambiado = await usuarios.cambiarEstado(
        tx,
        usuario.id,
        { estado: usuario.estado, impuestoPor: usuario.estado_impuesto_por },
        SIN_ESTADO,
      );
      if (!cambiado) throw new ErrorDeDominio('estado.cambio_concurrente', 409);
    });
  });
}
