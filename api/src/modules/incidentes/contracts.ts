import type { Pool } from 'mysql2/promise';
import {
  ejecutar as detectarGeneracionRuidosa,
  type ResultadoDeDeteccion,
} from './actions/detectar-generacion-ruidosa.js';
import {
  ejecutar as registrarDelSistema,
  type IncidenteDelSistema,
} from './actions/registrar-incidente-del-sistema.js';

export type { IncidenteDelSistema } from './actions/registrar-incidente-del-sistema.js';
export type { Evidencia, Gravedad, TipoDeIncidente } from './domain/incidente.js';

export interface ServicioDeIncidentes {
  /**
   * El contrato para que un detector del sistema (ola W12) abra un incidente de uso en la cuenta del contexto
   * (ADR 0033 §4.1). Idempotente por `claveUnica`: devuelve el id, o `null` si ya existía. Nace sin resolver y sin
   * autor; no limita a nadie hasta que una persona lo confirme.
   */
  registrarDelSistema(incidente: IncidenteDelSistema): Promise<string | null>;
}

export function crearServicioDeIncidentes(pool: Pool): ServicioDeIncidentes {
  return { registrarDelSistema: (incidente) => registrarDelSistema(pool, incidente) };
}

/** Tareas periódicas del módulo (`tareas.ts`). */
export interface TareasDeIncidentes {
  /** Abre incidentes `generacion_ruidosa` para quienes repiten rechazos por tope de generación. */
  detectarGeneracionRuidosa(
    ahora: Date,
    registrarError?: (error: unknown) => void,
  ): Promise<ResultadoDeDeteccion>;
}

export function crearTareasDeIncidentes(pool: Pool): TareasDeIncidentes {
  return {
    detectarGeneracionRuidosa: (ahora, registrarError) =>
      detectarGeneracionRuidosa(pool, ahora, registrarError),
  };
}
