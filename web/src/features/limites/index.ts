/** API pública del módulo `limites` del panel: el consumo de la bolsa mensual por cuenta (ADR 0030). */
export type { LimitesRepositorio } from './api/LimitesRepositorio';
export { crearLimitesHttp } from './api/limitesHttp';
export { ProveedorLimites } from './application/contextos';
export { CLAVE_LIMITES, useConsumoDeBolsa, useConsumoDeCuenta } from './application/useLimites';
export type {
  ConsumoDeCuenta,
  DetalleDeConsumo,
  FiltrosDeConsumo,
  ListadoDeConsumo,
} from './domain/consumo';
export { PestanaConsumo } from './ui/components/PestanaConsumo';
export { DetalleConsumoPage } from './ui/pages/DetalleConsumoPage';
