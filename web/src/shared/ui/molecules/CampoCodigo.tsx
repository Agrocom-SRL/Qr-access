import type { ChangeEvent } from 'react';
import { AccesoCampoTexto, type PropsCampoTexto } from './AccesoCampoTexto';

/** Código de cuenta: 3 letras A–Z que se guardan siempre en mayúsculas (README, "Código de cuenta"). */
export function normalizarCodigo(valor: string): string {
  return valor
    .toUpperCase()
    .replaceAll(/[^A-Z]/g, '')
    .slice(0, 3);
}

export function CampoCodigo({ onChange, ...resto }: Omit<PropsCampoTexto, 'mono' | 'maxLength'>) {
  const alCambiar = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = normalizarCodigo(e.target.value);
    onChange?.(e);
  };
  return <AccesoCampoTexto mono maxLength={3} autoComplete="off" onChange={alCambiar} {...resto} />;
}
