import type { Pool } from 'mysql2/promise';
import { ejecutar as avisarBolsa } from './actions/avisar-bolsa.js';
import { ejecutar as detectarFlujoAtipico } from './actions/detectar-flujo-atipico.js';
import { ejecutar as detectarPinCompartido } from './actions/detectar-pin-compartido.js';
import { ejecutar as detectarQrReenviado } from './actions/detectar-qr-reenviado.js';
import { ejecutar as detectarUsoImposible } from './actions/detectar-uso-imposible.js';
import { ejecutar as detectarUsoMasivo } from './actions/detectar-uso-masivo.js';
import type { ResultadoDePasada } from './pasada.js';

export type { ResultadoDePasada } from './pasada.js';

type Pasada = (
  ahora: Date,
  registrarError?: (error: unknown) => void,
) => Promise<ResultadoDePasada>;

/**
 * Tareas periódicas de las señales de abuso (`tareas.ts`, ADR 0030 §4 y §5, ola W12). Todas son de solo observación:
 * abren incidentes del sistema y avisos en la bandeja, y NUNCA limitan ni bloquean a nadie ni tocan la validación.
 */
export interface TareasDeSenales {
  /** Uso masivo: aperturas con el QR propio de un usuario por encima de su N por nivel en el día. */
  detectarUsoMasivo: Pasada;
  /** Uso imposible: usos del QR propio de un usuario en puertas que no alcanzan a recorrerse. */
  detectarUsoImposible: Pasada;
  /** QR reenviado: un QR ya usado que sigue llegando a varios lectores. */
  detectarQrReenviado: Pasada;
  /** PIN compartido: sesiones activas de un usuario desde muchas IP distintas. */
  detectarPinCompartido: Pasada;
  /** Lleva a la bandeja las marcas de la bolsa mensual (80 % y superada). */
  avisarBolsa: Pasada;
  /** Flujo atípico de la cuenta: aperturas por usuario activo muy por encima de lo habitual. */
  detectarFlujoAtipico: Pasada;
}

export function crearTareasDeSenales(pool: Pool): TareasDeSenales {
  return {
    detectarUsoMasivo: (ahora, registrarError) => detectarUsoMasivo(pool, ahora, registrarError),
    detectarUsoImposible: (ahora, registrarError) =>
      detectarUsoImposible(pool, ahora, registrarError),
    detectarQrReenviado: (ahora, registrarError) =>
      detectarQrReenviado(pool, ahora, registrarError),
    detectarPinCompartido: (ahora, registrarError) =>
      detectarPinCompartido(pool, ahora, registrarError),
    avisarBolsa: (ahora, registrarError) => avisarBolsa(pool, ahora, registrarError),
    detectarFlujoAtipico: (ahora, registrarError) =>
      detectarFlujoAtipico(pool, ahora, registrarError),
  };
}
