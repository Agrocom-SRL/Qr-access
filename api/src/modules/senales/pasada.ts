import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import type { ResultadoDeSenal } from './senal-de-usuario.js';

/** Cuántos hallazgos lee de una vez cada detector; la pasada recorre TODOS, página a página, con un cursor. */
export const TAMANO_DE_PAGINA = 500;

/**
 * Tope de trabajo por detector y por pasada: señales abiertas, hallazgos ocupados y errores (lo que cuesta escribir).
 * En una avalancha (miles de usuarios cruzando el umbral a la vez) una pasada no puede ocupar para siempre uno de los
 * cupos de tareas simultáneas (`tareas.ts`): al llegar al tope se corta y la siguiente pasada sigue, porque lo ya
 * tratado queda como «omitido» (idempotente por clave) y no vuelve a gastar cupo. Los omitidos no cuentan: son una
 * lectura. Cambia aquí si hace falta ajustarlo.
 */
export const MAXIMO_DE_SENALES_POR_PASADA = 500;

/** ¿Ya hizo la pasada todo el trabajo que le toca esta vez? */
export function pasadaAgotada(resultado: ResultadoDePasada, maximo: number): boolean {
  return resultado.senales + resultado.ocupadas + resultado.errores >= maximo;
}

/** El cursor de los detectores por usuario: la página siguiente empieza después de (cuenta, usuario). */
export interface CursorDeUsuario {
  readonly cuentaId: string;
  readonly usuarioId: string;
}

export interface ResultadoDePasada {
  /** Hallazgos que cruzaron el piso de la búsqueda y se examinaron. */
  revisados: number;
  /** Señales nuevas: incidente y aviso (o constancia, si es de gravedad baja) dejados en esta pasada. */
  senales: number;
  /** Hallazgos que no hacía falta tratar: ya tenían su aviso del día, no llegaban a su umbral efectivo o el usuario ya no opera. */
  omitidos: number;
  /** Hallazgos que fallaron (siguen los demás; se reintenta en la próxima pasada). */
  errores: number;
  /** Hallazgos cuya cuenta otra pasada estaba atendiendo: se reintentan en la próxima. */
  ocupadas: number;
}

export function pasadaVacia(): ResultadoDePasada {
  return { revisados: 0, senales: 0, omitidos: 0, errores: 0, ocupadas: 0 };
}

/**
 * Trata un hallazgo y lo cuenta en el resultado. Un fallo de uno no corta la pasada: se registra y se sigue. Que el
 * usuario desaparezca entre la lectura y la escritura (una baja) no es un fallo del detector.
 */
export async function tratar(
  resultado: ResultadoDePasada,
  registrarError: (error: unknown) => void,
  tarea: () => Promise<ResultadoDeSenal>,
): Promise<void> {
  resultado.revisados += 1;
  try {
    const salida = await tarea();
    if (salida === 'abierta') resultado.senales += 1;
    else if (salida === 'ocupada') resultado.ocupadas += 1;
    else resultado.omitidos += 1;
  } catch (error) {
    if (error instanceof ErrorDeDominio && error.code === 'usuario.no_encontrado') {
      resultado.omitidos += 1;
      return;
    }
    resultado.errores += 1;
    registrarError(error);
  }
}

/**
 * Recorre TODOS los hallazgos de una consulta paginada por cursor (sin un tope fijo que los ya tratados taparían), de a
 * `tamano`. `pagina` devuelve la siguiente página a continuación del cursor; `cursorDe` saca el cursor del último.
 */
export async function* recorrer<H, C>(
  pagina: (cursor: C | null) => Promise<H[]>,
  cursorDe: (hallazgo: H) => C,
  tamano: number,
): AsyncGenerator<H> {
  let cursor: C | null = null;
  for (;;) {
    const hallazgos = await pagina(cursor);
    for (const hallazgo of hallazgos) yield hallazgo;
    const ultimo = hallazgos.at(-1);
    if (ultimo === undefined || hallazgos.length < tamano) return;
    cursor = cursorDe(ultimo);
  }
}
