import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import type { ResultadoDeSenal } from './senal-de-usuario.js';

/** Cuántos hallazgos lee de una vez cada detector; la pasada recorre TODOS, página a página, con un cursor. */
export const TAMANO_DE_PAGINA = 500;

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
