import type { Resumen } from '../domain/resumen';

export interface ResumenRepositorio {
  obtener: () => Promise<Resumen>;
}
