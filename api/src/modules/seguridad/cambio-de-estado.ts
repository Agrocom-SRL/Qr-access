import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import { enTransaccion, type Transaccion } from '../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma, PrincipalUsuario } from '../../platform/seguridad/principal.js';
import { crearServicioDeAnulacionDeQr } from '../accesos/contracts.js';
import { esAlivio, puedeCambiarEstado, type Estado } from './domain/estado.js';
import {
  RepositorioDeCuentasDePlataforma,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
  SIN_ESTADO,
  type CambioDeEstado,
} from './repository.js';

/**
 * Lo que comparten las acciones que cambian el estado de un usuario o de una cuenta (ADR 0033 §1,
 * ADR 0031 §0 a §2, D-25). Vive acá y no en una acción porque son seis acciones (restringir, suspender y
 * reactivar, de un usuario y de una cuenta) con una sola mecánica y cada acción es un archivo con una
 * sola función `ejecutar`.
 */

/** A qué estado se pasa; restringir y suspender exigen un motivo, reactivar no. */
export type DestinoDeEstado =
  | { readonly estado: 'restringido' | 'suspendido'; readonly motivo: string }
  | { readonly estado: 'activo' };

/** El permiso de la cuenta que hace falta para levantar cada estado. */
const PERMISO_PARA_LEVANTAR: Readonly<Record<Exclude<Estado, 'activo'>, string>> = {
  restringido: 'seguridad.usuario.restringir',
  suspendido: 'seguridad.usuario.suspender',
};

function cambioDe(destino: DestinoDeEstado, impuestoPor: string, ahora: Date): CambioDeEstado {
  return destino.estado === 'activo'
    ? SIN_ESTADO
    : { estado: destino.estado, impuestoPor, desde: ahora, motivo: destino.motivo };
}

/**
 * Restringe, suspende o reactiva a un usuario de la rama del actor.
 *
 * - Si baja la gravedad (suspendido a restringido o a activo) exige el permiso del estado que levanta, no
 *   el del destino.
 * - Solo se llega a la propia rama (ADR 0028 §4): un par, un superior, otra rama o otra cuenta no existen
 *   (404), así que un Titular nunca toca a otro Titular ni a su Administrador.
 * - El estado propio de quien ya tiene uno solo lo cambia quien lo impuso o un superior suyo
 *   (`puedeCambiarEstado`); lo impuesto por un superior del actor, por un par o por AGROCOM responde 403.
 * - La rama NO se escribe: restringida o suspendida, se deriva al consultar. Suspender sí cierra en la
 *   MISMA transacción las sesiones de toda la rama y anula sus QR vigentes; restringir no toca sesiones
 *   ni QR (los ya generados siguen vivos hasta vencer).
 * - La fila se cambia con «compare-and-set» sobre el estado leído: dos personas a la vez no se pisan.
 * Pasar al mismo estado que ya tiene es inofensivo (no hace nada).
 */
export async function cambiarEstadoDeUsuario(
  pool: Pool,
  principal: PrincipalUsuario,
  usuarioId: string,
  destino: DestinoDeEstado,
  ahora: Date,
): Promise<void> {
  if (usuarioId === principal.usuarioId) throw new ErrorDeDominio('usuario.propio', 422);
  const usuarios = new RepositorioDeUsuarios(pool);
  const rama = new Set(await usuarios.idsDeRama(principal.usuarioId));
  const objetivo = rama.has(usuarioId) ? await usuarios.buscarPorId(usuarioId) : null;
  if (objetivo === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  if (objetivo.estado === destino.estado) return;

  if (esAlivio(objetivo.estado, destino.estado)) {
    // Bajar la gravedad es levantar el estado que tiene: exige el permiso de ESE estado, también al pasar
    // de suspendido a restringido (un rol que solo restringe no levanta una suspensión).
    const permiso = PERMISO_PARA_LEVANTAR[objetivo.estado as Exclude<Estado, 'activo'>];
    if (!principal.permisos.has(permiso)) {
      throw new ErrorDeDominio('permiso.denegado', 403, { permiso });
    }
  }
  const propio = { estado: objetivo.estado, impuestoPor: objetivo.estado_impuesto_por };
  if (!puedeCambiarEstado(propio, principal.usuarioId, rama)) {
    throw new ErrorDeDominio('estado.impuesto_por_superior', 403, { estado: objetivo.estado });
  }

  const sesiones = new RepositorioDeSesiones(pool);
  await enTransaccion(pool, async (tx) => {
    const cambiado = await usuarios.cambiarEstado(
      tx,
      usuarioId,
      propio,
      cambioDe(destino, principal.usuarioId, ahora),
    );
    if (!cambiado) throw new ErrorDeDominio('estado.cambio_concurrente', 409);

    if (destino.estado === 'suspendido') {
      // Él y toda su rama (los que ya estaban suspendidos también: no cuesta y no deja rastros vivos). La
      // rama se relee DENTRO de la transacción (no se reusa la de antes): quien se sumó entre la primera
      // lectura y este punto también queda cerrado. Un QR que alguien de la rama genere justo después queda
      // sin efecto igual: `validar-qr` comprueba el estado del generador al abrir (ADR 0031 §2).
      const afectados = [usuarioId, ...(await usuarios.idsDeRama(usuarioId, tx))];
      for (const id of afectados) await sesiones.revocarTodasDe(tx, id, ahora);
      await crearServicioDeAnulacionDeQr(pool).anularVigentes(
        tx,
        afectados,
        principal.usuarioId,
        ahora,
      );
    }
  });
}

/**
 * Restringe, suspende o reactiva una cuenta (AGROCOM con `seguridad.cuenta.editar`). Suspender cierra en
 * la misma transacción las sesiones de TODOS sus usuarios y anula todos sus QR vigentes (ADR 0031 §1);
 * reactivarla no los revive: se generan de nuevo. Restringida, la cuenta no genera QR pero lo ya
 * generado sirve. Una cuenta inexistente o eliminada es 404.
 */
export async function cambiarEstadoDeCuenta(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  destino: DestinoDeEstado,
  ahora: Date,
): Promise<void> {
  const cuentas = new RepositorioDeCuentasDePlataforma(pool);
  const cuenta = await cuentas.buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  if (cuenta.estado === destino.estado) return;

  // Salto explícito del aislamiento: AGROCOM opera DENTRO de la cuenta (ADR 0004 §7) para cerrar sus
  // sesiones y anular sus QR; la bitácora firma con su usuario.
  await ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, () =>
    enTransaccion(pool, async (tx) => {
      const cambiado = await cuentas.cambiarEstado(
        tx,
        cuenta.id,
        { estado: cuenta.estado, impuestoPor: cuenta.estado_impuesto_por },
        cambioDe(destino, principal.usuarioId, ahora),
      );
      if (!cambiado) throw new ErrorDeDominio('estado.cambio_concurrente', 409);

      if (destino.estado === 'suspendido') {
        // Con `tx`: ve a los usuarios creados hasta este instante y los bloquea con la misma vista de la
        // transacción que cambió el estado, no con una lectura aparte del pool.
        const usuarios = await new RepositorioDeUsuarios(pool).listarTodos(tx);
        const sesiones = new RepositorioDeSesiones(pool);
        for (const usuario of usuarios) await sesiones.revocarTodasDe(tx, usuario.id, ahora);
        await crearServicioDeAnulacionDeQr(pool).anularVigentes(
          tx,
          null,
          principal.usuarioId,
          ahora,
        );
      }
    }),
  );
}

/** Qué pasó cuando el sistema intentó restringir a un usuario. */
export type ResultadoDeRestriccionDelSistema = 'aplicada' | 'sin_cambio';

/**
 * Restringe a un usuario COMO SISTEMA (ADR 0033 §4.4, ola W11): lo usa la reincidencia cuando la cuenta activó la
 * restricción automática. Solo el nivel LEVE: no cierra sesiones ni anula QR, y nunca suspende (eso lo decide una
 * persona). Va DENTRO de la transacción `tx` de quien la pide, para que la restricción y su aviso se guarden juntos.
 *
 * - La bitácora firma con origen `sistema` y sin usuario (nadie «hizo» el cambio).
 * - `estado_impuesto_por` queda en el SUPERIOR directo del usuario: así él y quienes están sobre él pueden levantarla
 *   (`puedeCambiarEstado`); si no tiene superior queda sin dueño y solo AGROCOM la levanta.
 * - Solo actúa sobre alguien `activo`: quien ya está restringido o suspendido (por una persona) no se toca, y el
 *   «compare-and-set» del repositorio evita pisar un cambio concurrente. `sin_cambio` es inofensivo.
 */
export async function restringirComoSistema(
  pool: Pool,
  tx: Transaccion,
  usuarioId: string,
  motivo: string,
  ahora: Date,
): Promise<ResultadoDeRestriccionDelSistema> {
  const usuarios = new RepositorioDeUsuarios(pool);
  const [usuario] = await usuarios.buscarPorIds([usuarioId], tx);
  if (usuario?.estado !== 'activo') return 'sin_cambio';
  const cambiado = await ContextoCuenta.ejecutar(
    {
      cuentaId: ContextoCuenta.cuentaRequerida(),
      usuarioId: null,
      rolActivoId: null,
      dispositivoId: null,
      origen: 'sistema',
    },
    () =>
      usuarios.cambiarEstado(
        tx,
        usuarioId,
        { estado: 'activo', impuestoPor: null },
        { estado: 'restringido', impuestoPor: usuario.superior_id, desde: ahora, motivo },
      ),
  );
  return cambiado ? 'aplicada' : 'sin_cambio';
}
