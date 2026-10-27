import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeArbol } from '../../seguridad/contracts.js';
import { RepositorioDeAnulacionesMasivas, RepositorioDeQr } from '../repository.js';

/** Cuántos QR anula cada transacción: bloquea pocas filas y por poco tiempo (validación y generación siguen). */
export const TAMANO_DE_LOTE_DE_ANULACION = 500;

export type AlcanceDeAnulacion = 'usuario' | 'rama' | 'cuenta';

export interface PedidoDeAnulacionMasiva {
  readonly alcance: AlcanceDeAnulacion;
  /**
   * El usuario (alcance `usuario`) o la raíz de la rama (alcance `rama`). Sin él, el propio actor. Debe ser `null`
   * con el alcance `cuenta` (que es la rama completa de quien pide: ver `ejecutar`).
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
 * Anula en bloque los QR VIGENTES de un usuario o de una rama (ADR 0031 §3, ADR 0033 §3): la respuesta rápida ante un
 * PIN filtrado o una sesión robada. El alcance sale del árbol del ADR 0028 §4, no solo del permiso
 * `accesos.qr.anular_masivo`:
 *
 * - Administrador: su RAMA (él, sus Titulares, Guardias y Miembros), nunca la de otro Administrador de la misma
 *   cuenta. El alcance `cuenta` significa «mi rama completa»: se eligió esto (y no «toda la cuenta si hay un solo
 *   Administrador») porque su significado no cambia en silencio el día que la cuenta suma un segundo Administrador.
 *   Supuesto a confirmar con Miguel (D-29).
 * - Titular: él, sus Miembros y su rama; la cuenta entera no (`anulacion.alcance_no_permitido`, 403).
 * - Miembro y Guardia: solo lo propio.
 *
 * Quien está fuera del alcance (otro Titular, un superior, la rama de otro Administrador, otra cuenta) NO existe:
 * 404 `usuario.no_encontrado`, y eso incluye a la cuenta B vista desde la A (invariante 1; el repositorio ya filtra
 * por la cuenta del contexto).
 *
 * **Por lotes:** cada lote (500 QR) va en su propia transacción corta; una sola transacción para miles de QR
 * retendría los bloqueos de `qr_accesos` demasiado tiempo. Cada QR anulado deja su fila de bitácora en la transacción
 * de su lote, y al terminar el pedido deja la suya (`anulaciones_masivas`) con el motivo y el TOTAL. No es atómico
 * entre lotes, y está bien: anular solo protege y es idempotente. Si falla a la mitad, lo ya anulado queda anulado,
 * el pedido responde error y repetirlo termina el trabajo. Solo se anulan los vigentes (no usados, no anulados, no
 * vencidos); los anulados no reviven. La restricción no es necesaria: un usuario restringido o suspendido también
 * puede (o debe poder) cortar sus QR.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  pedido: PedidoDeAnulacionMasiva,
  ahora: Date = new Date(),
  tamanoDeLote: number = TAMANO_DE_LOTE_DE_ANULACION,
): Promise<ResultadoDeAnulacionMasiva> {
  const arbol = crearServicioDeArbol(pool);
  const alcance = await arbol.alcanceDe(principal.usuarioId);

  let generadores: string[];
  let objetivo: string | null;
  if (pedido.alcance === 'cuenta') {
    if (alcance.nivel !== 'administrador') {
      throw new ErrorDeDominio('anulacion.alcance_no_permitido', 403, { alcance: 'cuenta' });
    }
    generadores = await arbol.ramaDe(principal.usuarioId);
    objetivo = null;
  } else {
    objetivo = pedido.usuarioId ?? principal.usuarioId;
    if (!alcance.ids.has(objetivo)) throw new ErrorDeDominio('usuario.no_encontrado', 404);
    generadores = pedido.alcance === 'usuario' ? [objetivo] : await arbol.ramaDe(objetivo);
  }

  const qr = new RepositorioDeQr(pool);
  let qrAnulados = 0;
  let cursor = '0';
  for (;;) {
    const lote = await enTransaccion(pool, (tx) =>
      qr.anularLoteDeVigentes(tx, generadores, principal.usuarioId, ahora, cursor, tamanoDeLote),
    );
    qrAnulados += lote.anulados;
    if (lote.ultimoId === null || lote.leidos < tamanoDeLote) break;
    cursor = lote.ultimoId;
  }

  const usuariosAlcanzados = generadores.length;
  const id = await enTransaccion(pool, (tx) =>
    new RepositorioDeAnulacionesMasivas(pool).registrar(tx, {
      alcance: pedido.alcance,
      usuarioObjetivoId: objetivo,
      motivo: pedido.motivo,
      usuariosAlcanzados,
      qrAnulados,
    }),
  );
  return { id, alcance: pedido.alcance, usuarioId: objetivo, usuariosAlcanzados, qrAnulados };
}
