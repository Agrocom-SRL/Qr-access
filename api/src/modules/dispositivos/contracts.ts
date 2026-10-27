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

export interface ServicioDeDispositivos {
  /** `puertaId -> dispositivo en servicio` de la cuenta del contexto; una puerta sin lector no figura. */
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
    async porPuerta(puertaIds, ahora) {
      const filas = await dispositivos.listarEnServicioPorPuertas(puertaIds);
      return new Map(
        filas.map((fila) => [
          fila.puerta_id,
          {
            id: fila.id,
            puertaId: fila.puerta_id,
            nombre: fila.nombre,
            enLinea: estaEnLinea(fila.ultimo_latido_at, ahora),
            ultimoLatidoAt: fila.ultimo_latido_at,
          },
        ]),
      );
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
