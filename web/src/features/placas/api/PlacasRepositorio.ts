import type { Paginado } from '../../../shared/api/tipos';
import type { FiltrosDePlacas, NivelAbierto, Placa, UbicacionDelLector } from '../domain/placa';

export interface DatosDeVinculo {
  cuentaId: string;
  puertaId: string;
  nombre: string;
  /** Dónde está el lector de la placa; sin elegir, la API toma `ambos`. */
  sentido?: UbicacionDelLector;
}

/** Lo que `application` necesita de la API de placas (`/plataforma/placas`, ADR 0026). */
export interface PlacasRepositorio {
  listar: (filtros: FiltrosDePlacas) => Promise<Paginado<Placa>>;
  /**
   * Pide vincular la placa: todavía no hay dispositivo, falta que alguien pulse el botón de la
   * placa. Devuelve hasta cuándo espera.
   */
  vincular: (placaId: string, datos: DatosDeVinculo) => Promise<{ porConfirmarHasta: Date }>;
  /** Retira la solicitud de vínculo que espera el botón. */
  cancelarVinculo: (placaId: string) => Promise<void>;
  /** Revoca el dispositivo y deja la placa lista para otra cuenta. */
  liberar: (placaId: string) => Promise<void>;
  darDeBaja: (placaId: string) => Promise<void>;
  /** Habilita o no el sensor de la puerta y fija su nivel con la puerta abierta (ADR 0031 §18). */
  configurarSensor: (
    placaId: string,
    sensor: { instalado: boolean; nivelAbierto: NivelAbierto },
  ) => Promise<void>;
}
