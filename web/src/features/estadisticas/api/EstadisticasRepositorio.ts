import type { AperturaManual } from '../domain/aperturaManual';
import type { Estadisticas } from '../domain/estadisticas';

export interface EstadisticasRepositorio {
  obtener: () => Promise<Estadisticas>;
  /** El uso de la apertura manual desde la app en los últimos días (ADR 0035). */
  aperturaManual: () => Promise<AperturaManual>;
}
