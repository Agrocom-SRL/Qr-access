import { expect } from 'vitest';

/** Comodines de `expect` ya tipados: devuelven `any`, que dentro de un objeto literal no pasa el lint. */
export function cualquierTexto(): string {
  const comodin: unknown = expect.any(String);
  return comodin as string;
}

/** Una fecha ISO 8601 en UTC con `Z`. */
export function fechaIsoUtc(): string {
  const comodin: unknown = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  return comodin as string;
}
