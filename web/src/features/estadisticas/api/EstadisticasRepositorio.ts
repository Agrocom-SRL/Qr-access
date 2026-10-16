import type { Estadisticas } from '../domain/estadisticas';

export interface EstadisticasRepositorio {
  obtener: () => Promise<Estadisticas>;
}
