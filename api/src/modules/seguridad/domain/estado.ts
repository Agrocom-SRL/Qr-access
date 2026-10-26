/**
 * Estados de un usuario o de una cuenta (ADR 0033 §1, ADR 0031 §0) y su efecto derivado por rama.
 *
 * - `activo`: funciona todo.
 * - `restringido` (leve): conserva la sesión y consulta, pero no genera QR nuevos; sus QR ya generados
 *   siguen abriendo hasta vencer.
 * - `suspendido` (crítico): sin sesión, sin QR vigentes, y arrastra a toda su rama.
 * - «Eliminado» no es un valor guardado: es `deleted_at` (invariante 8).
 *
 * La cascada NO se escribe en las filas de la rama: se deriva recorriendo `superior_id` hacia arriba y
 * mirando el estado de la cuenta (D-25). Así reactivar al superior devuelve la rama sin pisar a quien
 * tenga un estado propio. Este archivo es puro: no toca la base.
 */
export const ESTADOS = ['activo', 'restringido', 'suspendido'] as const;
export type Estado = (typeof ESTADOS)[number];

/** Gravedad creciente: suspendido > restringido > activo. */
const GRAVEDAD: Readonly<Record<Estado, number>> = { activo: 0, restringido: 1, suspendido: 2 };

/** El más grave de los dos. */
export function peorEstado(a: Estado, b: Estado): Estado {
  return GRAVEDAD[b] > GRAVEDAD[a] ? b : a;
}

/** `true` si pasar de `de` a `a` baja la gravedad (es levantar algo, aunque sea en parte). */
export function esAlivio(de: Estado, a: Estado): boolean {
  return GRAVEDAD[a] < GRAVEDAD[de];
}

/** De dónde viene el estado efectivo: el propio, el de un superior o el de la cuenta. */
export type OrigenDeEstado = 'usuario' | 'superior' | 'cuenta';

export interface EstadoEfectivo {
  /**
   * El peor entre el del usuario, el de sus superiores y el de su cuenta. `eliminado` si el usuario o
   * alguno de sus superiores ya no existe (soft delete) o la cadena no se puede recorrer: falla cerrado.
   */
  readonly estado: Estado | 'eliminado';
  /** `null` cuando el estado efectivo es `activo`. */
  readonly origen: OrigenDeEstado | null;
}

/** Lo mínimo de un usuario para derivar su estado efectivo. */
export interface NodoDeEstado {
  readonly id: string;
  readonly superiorId: string | null;
  readonly estado: Estado;
}

const ELIMINADO: EstadoEfectivo = { estado: 'eliminado', origen: null };

/** Los datos vienen de la base como texto: un valor fuera del catálogo no se debe tomar por «activo». */
function esEstadoConocido(valor: string): valor is Estado {
  return Object.hasOwn(GRAVEDAD, valor);
}

/**
 * El estado efectivo de `usuarioId`. `nodos` trae al menos al usuario y todos sus superiores (los
 * usuarios borrados no figuran); si falta alguno de la cadena, el usuario cuenta como eliminado. Falla
 * cerrado también ante un estado desconocido, del nodo o de la cuenta: cuenta como eliminado, nunca como
 * activo (una gravedad `undefined` perdería todas las comparaciones y dejaría pasar).
 */
export function estadoEfectivo(
  usuarioId: string,
  nodos: ReadonlyMap<string, NodoDeEstado>,
  estadoDeLaCuenta: Estado,
): EstadoEfectivo {
  if (!esEstadoConocido(estadoDeLaCuenta)) return ELIMINADO;
  let peor: Estado = 'activo';
  let origen: OrigenDeEstado | null = null;
  const visitados = new Set<string>();
  let actual: string | null = usuarioId;
  while (actual !== null) {
    // Un ciclo en `superior_id` no debería existir; si existe, no se confía en el usuario.
    if (visitados.has(actual)) return ELIMINADO;
    visitados.add(actual);
    const nodo = nodos.get(actual);
    if (nodo === undefined || !esEstadoConocido(nodo.estado)) return ELIMINADO;
    if (GRAVEDAD[nodo.estado] > GRAVEDAD[peor]) {
      peor = nodo.estado;
      origen = actual === usuarioId ? 'usuario' : 'superior';
    }
    actual = nodo.superiorId;
  }
  // La cuenta gana el empate: si toda la cuenta está en ese estado, el motivo es ella.
  if (GRAVEDAD[estadoDeLaCuenta] >= GRAVEDAD[peor] && estadoDeLaCuenta !== 'activo') {
    return { estado: estadoDeLaCuenta, origen: 'cuenta' };
  }
  return { estado: peor, origen };
}

/** Arma el mapa `id -> nodo` que pide `estadoEfectivo` a partir de filas con `superior_id` y `estado`. */
export function nodosDeEstado(
  filas: readonly { id: string; superior_id: string | null; estado: Estado }[],
): Map<string, NodoDeEstado> {
  return new Map(
    filas.map((fila) => [
      fila.id,
      { id: fila.id, superiorId: fila.superior_id, estado: fila.estado },
    ]),
  );
}

/** Lo que hace falta saber del estado propio de alguien para decidir si se puede cambiar. */
export interface EstadoImpuesto {
  readonly estado: Estado;
  /** Quién lo impuso; `null` si no se sabe (lo migrado): solo AGROCOM lo levanta. */
  readonly impuestoPor: string | null;
}

/**
 * ¿Puede `actorId` cambiar el estado propio de alguien de su rama? (ADR 0033 §1)
 * Si no tiene ninguno, sí. Si ya tiene uno, solo quien lo impuso o un superior de quien lo impuso: es
 * decir, el propio actor o alguien que cuelga del actor (`ramaDelActor`). Un estado impuesto por un
 * superior del actor, por un par o por AGROCOM no lo levanta el actor.
 */
export function puedeCambiarEstado(
  objetivo: EstadoImpuesto,
  actorId: string,
  ramaDelActor: ReadonlySet<string>,
): boolean {
  if (objetivo.estado === 'activo') return true;
  if (objetivo.impuestoPor === null) return false;
  return objetivo.impuestoPor === actorId || ramaDelActor.has(objetivo.impuestoPor);
}
