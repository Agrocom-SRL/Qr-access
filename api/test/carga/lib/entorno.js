// Configuración de una corrida k6, leída de variables CARGA_*. Cada escenario lo importa primero: si el
// entorno no es de prueba o el host no está declarado, la corrida aborta en el init, antes de tocar la red.
import { configuracionDeCarga } from './guarda.mjs';

const base = configuracionDeCarga(__ENV);

export const CONFIG = Object.freeze({
  /** Base de la API del entorno de prueba, p. ej. http://127.0.0.1:3000/api/v1. */
  base: base.base,
  /** JSON que genera preparar-datos.mjs. Ruta ABSOLUTA: k6 resuelve las relativas desde la carpeta del script. */
  datos: __ENV.CARGA_DATOS || '',
  /**
   * Reparte un `X-Forwarded-For` distinto por VU. Solo sirve en el entorno de prueba, SIN proxy delante y con
   * TRUST_PROXY=1 (la API toma la última IP de esa cabecera). Sin proxy, la cabecera la pone quien llama:
   * por eso nunca se activa contra un entorno que lo tenga delante (docs/gestion/pruebas-de-carga.md).
   */
  ipSimuladas: __ENV.CARGA_IP_SIMULADAS === '1',
  /** Manda `Idempotency-Key` al generar QR. La cabecera la introduce W6: en esta base la API la ignora. */
  idempotencia: __ENV.CARGA_IDEMPOTENCIA === '1',
  /** Carpeta de salida de los resúmenes (relativa al directorio desde el que corre k6, la raíz del repo). */
  salida: __ENV.CARGA_SALIDA || 'api/test/carga/resultados',
  /** Etapas de tasa para la validación: "tasa:segundos,tasa:segundos". Una sola etapa es carga constante. */
  etapas: __ENV.CARGA_ETAPAS || '10:60',
});
