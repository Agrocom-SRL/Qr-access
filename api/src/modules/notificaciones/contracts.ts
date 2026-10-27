import type { Pool } from 'mysql2/promise';
import type { Transaccion } from '../../platform/db/transaccion.js';
import { ejecutar as cerrarDeCuenta } from './actions/cerrar-avisos-de-cuenta.js';
import { ejecutar as depurar } from './actions/depurar-notificaciones.js';
import { ejecutar as encolar } from './actions/encolar-aviso.js';
import { ejecutar as entregar, type ResultadoDeEntrega } from './actions/entregar-pendientes.js';
import type { AvisoAgrupado } from './domain/aviso.js';

export type {
  AccionPropuesta,
  Audiencia,
  AvisoAgrupado,
  BolsaDeAviso,
  DatosDeAviso,
  FlujoDeAviso,
  PlacaDeAviso,
  PropuestaDeAviso,
  SenalDeAviso,
  Severidad,
  TipoDeAviso,
} from './domain/aviso.js';
export type { ResultadoDeEntrega } from './actions/entregar-pendientes.js';

export interface ServicioDeAvisos {
  /**
   * Deja un aviso agrupado en la cola de entrega (outbox) dentro de `tx` y con la cuenta del contexto: quien
   * detecta un cambio lo guarda y lo avisa en la misma transacción. No entrega nada.
   */
  encolar(tx: Transaccion, aviso: AvisoAgrupado, ahora: Date): Promise<void>;
  /**
   * Al dar de baja una cuenta: cierra sus incidentes abiertos (propios y de AGROCOM) y retira de la cola lo que
   * esperaba entrega, dentro de `tx`.
   */
  cerrarDeCuenta(tx: Transaccion, cuentaId: string, ahora: Date): Promise<void>;
}

export function crearServicioDeAvisos(pool: Pool): ServicioDeAvisos {
  return {
    encolar: (tx, aviso, ahora) => encolar(pool, tx, aviso, ahora),
    cerrarDeCuenta: (tx, cuentaId, ahora) => cerrarDeCuenta(pool, tx, cuentaId, ahora),
  };
}

/** Tareas periódicas del módulo (`tareas.ts`). */
export interface TareasDeNotificaciones {
  /** Entrega los avisos pendientes de la cola. */
  entregarPendientes(
    ahora: Date,
    registrarError?: (error: unknown) => void,
  ): Promise<ResultadoDeEntrega>;
  /** Retira lo viejo según la retención; devuelve cuántas filas. */
  depurar(ahora: Date, registrarError?: (error: unknown) => void): Promise<number>;
}

export function crearTareasDeNotificaciones(pool: Pool): TareasDeNotificaciones {
  return {
    entregarPendientes: (ahora, registrarError) => entregar(pool, ahora, registrarError),
    depurar: (ahora, registrarError) => depurar(pool, ahora, registrarError),
  };
}
