import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import {
  crearServicioDeArbol,
  crearServicioDeUsuarios,
  crearServicioDeUsuariosExportables,
} from '../../seguridad/contracts.js';
import { RepositorioDeAnulacionesMasivas, RepositorioDeQr } from '../repository.js';

export type AlcanceDeAnulacion = 'usuario' | 'rama' | 'cuenta';

export interface PedidoDeAnulacionMasiva {
  readonly alcance: AlcanceDeAnulacion;
  /**
   * El usuario (alcance `usuario`) o la raíz de la rama (alcance `rama`). Sin él, el propio actor. Debe ser `null`
   * con el alcance `cuenta`.
   */
  readonly usuarioId: string | null;
  /** Por qué: obligatorio, entra a la bitácora. */
  readonly motivo: string;
}

export interface ResultadoDeAnulacionMasiva {
  readonly id: string;
  readonly alcance: AlcanceDeAnulacion;
  readonly usuarioId: string | null;
  readonly usuariosAlcanzados: number;
  readonly qrAnulados: number;
}

/**
 * Anula en bloque los QR VIGENTES de un usuario, de una rama o de toda la cuenta (ADR 0031 §3, ADR 0033 §3): la
 * respuesta rápida ante un PIN filtrado o una sesión robada. El alcance sale del árbol del ADR 0028, no solo del
 * permiso `accesos.qr.anular_masivo`:
 *
 * - Administrador: cualquier usuario o rama de la cuenta y la cuenta entera.
 * - Titular: él, sus Miembros y su rama; la cuenta entera no (`anulacion.alcance_no_permitido`, 403).
 * - Miembro y Guardia: solo lo propio.
 *
 * Quien está fuera del alcance (otro Titular, un superior, otra cuenta) NO existe: 404 `usuario.no_encontrado`, y
 * eso incluye a la cuenta B vista desde la A (invariante 1; el repositorio ya filtra por la cuenta del contexto).
 *
 * Todo en UNA transacción: cada QR anulado deja su fila de bitácora y el pedido deja la suya (`anulaciones_masivas`)
 * con el motivo. Solo se anulan los vigentes (no usados, no anulados, no vencidos); los anulados no reviven, y
 * pedirlo de nuevo no hace daño (anula 0). La restricción no es necesaria: un usuario restringido o suspendido
 * también puede (o debe poder) cortar sus QR.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  pedido: PedidoDeAnulacionMasiva,
  ahora: Date = new Date(),
): Promise<ResultadoDeAnulacionMasiva> {
  const arbol = crearServicioDeArbol(pool);
  const alcance = await arbol.alcanceDe(principal.usuarioId);

  let generadores: string[] | null;
  let objetivo: string | null;
  let usuariosAlcanzados: number;
  if (pedido.alcance === 'cuenta') {
    if (!alcance.todaLaCuenta) {
      throw new ErrorDeDominio('anulacion.alcance_no_permitido', 403, { alcance: 'cuenta' });
    }
    generadores = null;
    objetivo = null;
    usuariosAlcanzados = await crearServicioDeUsuariosExportables(pool).total();
  } else {
    objetivo = pedido.usuarioId ?? principal.usuarioId;
    // El Administrador llega a toda la cuenta: basta con que exista en ella (el repositorio ya la filtra).
    const alcanzable = alcance.todaLaCuenta
      ? (await crearServicioDeUsuarios(pool).etiquetasDe([objetivo])).has(objetivo)
      : alcance.ids.has(objetivo);
    if (!alcanzable) throw new ErrorDeDominio('usuario.no_encontrado', 404);
    generadores = pedido.alcance === 'usuario' ? [objetivo] : await arbol.ramaDe(objetivo);
    usuariosAlcanzados = generadores.length;
  }

  const qr = new RepositorioDeQr(pool);
  const anulaciones = new RepositorioDeAnulacionesMasivas(pool);
  return enTransaccion(pool, async (tx) => {
    const qrAnulados = await qr.anularVigentes(tx, generadores, principal.usuarioId, ahora);
    const id = await anulaciones.registrar(tx, {
      alcance: pedido.alcance,
      usuarioObjetivoId: objetivo,
      motivo: pedido.motivo,
      usuariosAlcanzados,
      qrAnulados,
    });
    return { id, alcance: pedido.alcance, usuarioId: objetivo, usuariosAlcanzados, qrAnulados };
  });
}
