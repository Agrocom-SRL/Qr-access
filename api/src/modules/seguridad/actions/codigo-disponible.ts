import type { Pool } from 'mysql2/promise';
import { normalizarCodigoDeCuenta, sugerirCodigos } from '../domain/cuentas.js';
import { RepositorioDeCuentasDePlataforma } from '../repository.js';

export interface DisponibilidadDeCodigo {
  /** Tiene la forma de 3 letras A–Z. */
  formato_valido: boolean;
  disponible: boolean;
  /** Razón social de la cuenta que ya lo usa (A04a: "Ese código ya es de …"). */
  usado_por: string | null;
  sugerencias: string[];
}

/** Validación en vivo del código de cuenta, con sugerencias libres parecidas a la razón social (A04a). */
export async function ejecutar(
  pool: Pool,
  entrada: { codigo: string; razonSocial: string },
): Promise<DisponibilidadDeCodigo> {
  const repositorio = new RepositorioDeCuentasDePlataforma(pool);
  const codigo = normalizarCodigoDeCuenta(entrada.codigo);
  const existente = codigo === null ? null : await repositorio.buscarPorCodigo(codigo);
  const sugerencias =
    codigo !== null && existente === null
      ? []
      : sugerirCodigos(entrada.razonSocial, await repositorio.codigosEnUso());
  return {
    formato_valido: codigo !== null,
    disponible: codigo !== null && existente === null,
    usado_por: existente?.nombre ?? null,
    sugerencias,
  };
}
