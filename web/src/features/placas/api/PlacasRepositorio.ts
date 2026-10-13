import type { Paginado } from '../../../shared/api/tipos';
import type { FiltrosDePlacas, Placa } from '../domain/placa';

export interface PlacaRegistrada {
  id: string;
  mac: string;
  /** En claro: llega una sola vez, solo se muestra y no se guarda en ninguna caché. */
  codigo: string;
}

export interface DatosDeVinculo {
  cuentaId: string;
  puertaId: string;
  nombre: string;
}

/** Lo que `application` necesita de la API de placas (`/plataforma/placas`, ADR 0025). */
export interface PlacasRepositorio {
  listar: (filtros: FiltrosDePlacas) => Promise<Paginado<Placa>>;
  registrar: (mac: string) => Promise<PlacaRegistrada>;
  /** Crea el dispositivo de la cuenta y la puerta con la clave que la placa ya propuso. */
  vincular: (placaId: string, datos: DatosDeVinculo) => Promise<void>;
  /** Revoca el dispositivo y deja la placa lista para otra cuenta. */
  liberar: (placaId: string) => Promise<void>;
  darDeBaja: (placaId: string) => Promise<void>;
}
