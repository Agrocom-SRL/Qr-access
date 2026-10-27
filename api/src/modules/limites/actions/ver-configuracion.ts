import type { Pool } from 'mysql2/promise';
import { todasLasDefiniciones, type AlcanceDeExcepcion } from '../domain/claves.js';
import { RepositorioDeConfiguracion } from '../repository.js';

export interface LimiteConfigurado {
  readonly clave: string;
  /** `null` solo si la base no se sembró con esa clave. */
  readonly valor: number | null;
  readonly minimo: number;
  readonly maximo: number;
  readonly excepcion: AlcanceDeExcepcion;
}

/** Los topes de generación de QR con su valor actual y los extremos entre los que AGROCOM puede fijarlos. */
export async function ejecutar(pool: Pool): Promise<LimiteConfigurado[]> {
  const filas = await new RepositorioDeConfiguracion(pool).listar();
  const valores = new Map(filas.map((fila) => [fila.clave, fila.valor]));
  return todasLasDefiniciones().map((definicion) => ({
    clave: definicion.clave,
    valor: valores.get(definicion.clave) ?? null,
    minimo: definicion.minimo,
    maximo: definicion.maximo,
    excepcion: definicion.excepcion,
  }));
}
