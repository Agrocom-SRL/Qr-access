import type { Plan } from '../domain/plan';

export interface PlanesRepositorio {
  listar: () => Promise<readonly Plan[]>;
  /** Guarda varios precios de una vez: todos o ninguno. */
  guardarPrecios: (cambios: readonly { planId: string; precioAnual: number }[]) => Promise<void>;
}
