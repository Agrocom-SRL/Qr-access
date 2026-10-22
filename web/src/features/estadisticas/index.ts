/** API pública del módulo `estadisticas` del panel: los datos y las tarjetas de gráficas. */
export type { EstadisticasRepositorio } from './api/EstadisticasRepositorio';
export { crearEstadisticasHttp } from './api/estadisticasHttp';
export { ProveedorEstadisticas } from './application/contextos';
export { CLAVE_ESTADISTICAS, useEstadisticas } from './application/useEstadisticas';
export type { Estadisticas } from './domain/estadisticas';
export { AccesosPorDia } from './ui/AccesosPorDia';
export { AltasPorMes } from './ui/AltasPorMes';
export { CobradoPorMes } from './ui/CobradoPorMes';
export { CuentasPorEstado } from './ui/CuentasPorEstado';
export { CuentasPorPlan } from './ui/CuentasPorPlan';
export { GraficasDelResumen } from './ui/GraficasDelResumen';
export { EstadisticasPage } from './ui/pages/EstadisticasPage';
