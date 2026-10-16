import { createContext, useContext, type ReactNode } from 'react';

/**
 * Contexto de inyección de una dependencia (p. ej. un repositorio). `application` lo lee con el
 * hook y `app/` lo provee con la implementación real o un mock (SOLID, inversión de dependencias).
 */
export function crearContexto<T>(nombre: string) {
  const Contexto = createContext<T | null>(null);

  function Proveedor({ valor, children }: { valor: T; children: ReactNode }) {
    return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
  }

  function useDependencia(): T {
    const valor = useContext(Contexto);
    if (valor === null) throw new Error(`${nombre} no está provisto`);
    return valor;
  }

  return [Proveedor, useDependencia] as const;
}
