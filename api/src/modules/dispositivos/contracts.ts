import type { Pool } from 'mysql2/promise';
import {
  ejecutar as evaluarEstadoDePlacas,
  type ResultadoDeEvaluacion,
} from './actions/evaluar-estado-de-placas.js';
import {
  ejecutar as evaluarAperturasFallidas,
  type ResultadoDeEvaluacionDeAperturas,
} from './actions/evaluar-aperturas-fallidas.js';
import { estaEnLinea } from './domain/en-linea.js';
import { RepositorioDeDispositivos, RepositorioDeDispositivosDePlataforma } from './repository.js';

export { crearAutenticadorDeDispositivo } from './autenticador.js';

/** Lo que otros módulos pueden saber del dispositivo de una puerta (HU-09). */
export interface DispositivoDePuerta {
  readonly id: string;
  readonly puertaId: string;
  readonly nombre: string;
  readonly enLinea: boolean;
  readonly ultimoLatidoAt: Date | null;
}

/** Cuántas placas tiene en servicio una puerta y cuántas de ellas reportaron un latido reciente. */
export interface PlacasDeLaPuerta {
  readonly enServicio: number;
  readonly enLinea: number;
}

export interface ServicioDeDispositivos {
  /**
   * `puertaId -> placas en servicio y en línea` de la cuenta del contexto (una puerta lleva hasta dos, ADR 0035
   * §4); una puerta sin placa no figura. «En línea» es lo mismo que en el resto de la API: latido de hace menos de
   * `LATIDO_MAXIMO_SEGUNDOS`. Es lo que decide si la apertura manual se ofrece y si se puede ordenar.
   */
  placasPorPuerta(
    puertaIds: readonly string[],
    ahora: Date,
  ): Promise<Map<string, PlacasDeLaPuerta>>;
  /** `puertaId -> dispositivo en servicio` de la cuenta del contexto; una puerta sin lector no figura. Con dos placas, la que está en línea. */
  porPuerta(puertaIds: readonly string[], ahora: Date): Promise<Map<string, DispositivoDePuerta>>;
  /** Cuántos dispositivos en servicio de la cuenta del contexto no reportan latido (HU-09). */
  contarSinConexion(ahora: Date): Promise<number>;
}

export function crearServicioDeDispositivos(pool: Pool): ServicioDeDispositivos {
  const dispositivos = new RepositorioDeDispositivos(pool);
  return {
    async contarSinConexion(ahora) {
      const filas = await dispositivos.listarEnServicio();
      return filas.filter((fila) => !estaEnLinea(fila.ultimo_latido_at, ahora)).length;
    },
    async placasPorPuerta(puertaIds, ahora) {
      const mapa = new Map<string, PlacasDeLaPuerta>();
      for (const fila of await dispositivos.listarEnServicioPorPuertas(puertaIds)) {
        const actual = mapa.get(fila.puerta_id) ?? { enServicio: 0, enLinea: 0 };
        mapa.set(fila.puerta_id, {
          enServicio: actual.enServicio + 1,
          enLinea: actual.enLinea + (estaEnLinea(fila.ultimo_latido_at, ahora) ? 1 : 0),
        });
      }
      return mapa;
    },
    async porPuerta(puertaIds, ahora) {
      const filas = await dispositivos.listarEnServicioPorPuertas(puertaIds);
      const mapa = new Map<string, DispositivoDePuerta>();
      for (const fila of filas) {
        const dispositivo = {
          id: fila.id,
          puertaId: fila.puerta_id,
          nombre: fila.nombre,
          enLinea: estaEnLinea(fila.ultimo_latido_at, ahora),
          ultimoLatidoAt: fila.ultimo_latido_at,
        };
        // Con dos placas por puerta (ADR 0035) se muestra la que está en línea; si ninguna, la primera.
        const previo = mapa.get(fila.puerta_id);
        if (previo === undefined || (!previo.enLinea && dispositivo.enLinea)) {
          mapa.set(fila.puerta_id, dispositivo);
        }
      }
      return mapa;
    },
  };
}

/** Un dispositivo en servicio visto desde la plataforma, con su cuenta y su puerta. */
export interface DispositivoDeCuenta {
  readonly id: string;
  readonly nombre: string;
  readonly puertaNombre: string;
  readonly cuenta: { readonly id: string; readonly codigo: string; readonly nombre: string };
  readonly firmware: string | null;
  readonly enLinea: boolean;
  readonly ultimoLatidoAt: Date | null;
}

export interface ServicioDeDispositivosDePlataforma {
  /** Los dispositivos en servicio de todas las cuentas (solo el super admin; HU-09). */
  deTodasLasCuentas(ahora: Date): Promise<DispositivoDeCuenta[]>;
}

export function crearServicioDeDispositivosDePlataforma(
  pool: Pool,
): ServicioDeDispositivosDePlataforma {
  const dispositivos = new RepositorioDeDispositivosDePlataforma(pool);
  return {
    async deTodasLasCuentas(ahora) {
      const filas = await dispositivos.listarEnServicioDeTodas();
      return filas.map((fila) => ({
        id: fila.id,
        nombre: fila.nombre,
        puertaNombre: fila.puerta_nombre,
        cuenta: { id: fila.cuenta_id, codigo: fila.cuenta_codigo, nombre: fila.cuenta_nombre },
        firmware: fila.firmware_version,
        enLinea: estaEnLinea(fila.ultimo_latido_at, ahora),
        ultimoLatidoAt: fila.ultimo_latido_at,
      }));
    },
  };
}

export type { ResultadoDeEvaluacion } from './actions/evaluar-estado-de-placas.js';
export type { ResultadoDeEvaluacionDeAperturas } from './actions/evaluar-aperturas-fallidas.js';

/** Tareas periódicas del módulo (`tareas.ts`). */
export interface TareasDeDispositivos {
  /**
   * Evalúa el estado de las placas de todas las cuentas y encola los avisos agrupados por sitio
   * (ADR 0031 §18). El reloj se inyecta: los tests no esperan.
   */
  evaluarEstadoDePlacas(
    ahora: Date,
    registrarError?: (error: unknown) => void,
  ): Promise<ResultadoDeEvaluacion>;
  /**
   * Deja la constancia de las aperturas sin respuesta y avisa de las puertas que fallan al abrir, agrupado por
   * sitio (ADR 0031 §18). El reloj se inyecta.
   */
  evaluarAperturasFallidas(
    ahora: Date,
    registrarError?: (error: unknown) => void,
  ): Promise<ResultadoDeEvaluacionDeAperturas>;
}

export function crearTareasDeDispositivos(pool: Pool): TareasDeDispositivos {
  return {
    evaluarEstadoDePlacas: (ahora, registrarError) =>
      evaluarEstadoDePlacas(pool, ahora, registrarError),
    evaluarAperturasFallidas: (ahora, registrarError) =>
      evaluarAperturasFallidas(pool, ahora, registrarError),
  };
}
