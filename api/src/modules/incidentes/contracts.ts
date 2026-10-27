import type { Pool } from 'mysql2/promise';
import {
  ejecutar as detectarGeneracionRuidosa,
  type ResultadoDeDeteccion,
} from './actions/detectar-generacion-ruidosa.js';
import { aIso } from '../../platform/tiempo/fechas.js';
import {
  RepositorioDeIncidentes,
  RepositorioDeIncidentesDeTodas,
  type FiltroDeSenales,
} from './repository.js';
import { normalizarEvidencia, type EvidenciaParcial } from './domain/incidente.js';
import type {
  EstadoDeIncidente,
  Evidencia,
  Gravedad,
  TipoDeIncidente,
} from './domain/incidente.js';
import {
  ejecutar as registrarDelSistema,
  type IncidenteDelSistema,
} from './actions/registrar-incidente-del-sistema.js';

export type { IncidenteDelSistema } from './actions/registrar-incidente-del-sistema.js';
export { GRAVEDADES, TIPOS_DE_INCIDENTE } from './domain/incidente.js';
export type { Evidencia, Gravedad, TipoDeIncidente } from './domain/incidente.js';

export interface ServicioDeIncidentes {
  /**
   * El contrato para que un detector del sistema (ola W12) abra un incidente de uso en la cuenta del contexto
   * (ADR 0033 §4.1). Idempotente por `claveUnica`: devuelve el id, o `null` si ya existía. Nace sin resolver y sin
   * autor; no limita a nadie hasta que una persona lo confirme.
   */
  registrarDelSistema(incidente: IncidenteDelSistema): Promise<string | null>;
  /**
   * El id del incidente de la cuenta del contexto con esa `claveUnica`, o `null`. Para quien recibió `null` de
   * `registrarDelSistema` (ya existía) y necesita enlazarlo.
   */
  idPorClaveUnica(claveUnica: string): Promise<string | null>;
}

export function crearServicioDeIncidentes(pool: Pool): ServicioDeIncidentes {
  return {
    registrarDelSistema: (incidente) => registrarDelSistema(pool, incidente),
    idPorClaveUnica: (claveUnica) => new RepositorioDeIncidentes(pool).idPorClave(claveUnica),
  };
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

export type { FiltroDeSenales } from './repository.js';

/** Una señal de abuso (incidente del sistema) tal como la ve AGROCOM: de cualquier cuenta, con ids y sin secretos. */
export interface SenalDePlataforma {
  readonly id: string;
  readonly cuentaId: string;
  readonly usuarioId: string;
  readonly tipo: TipoDeIncidente;
  readonly gravedad: Gravedad;
  readonly descripcion: string | null;
  /** Solo ids (QR, intentos de acceso, rechazos de generación); nunca un token. */
  readonly evidencia: Evidencia;
  /** `sin_resolver` mientras nadie decidió; si no, el resultado de la última resolución. */
  readonly estado: EstadoDeIncidente;
  readonly ocurridoAt: string;
  readonly creadoAt: string;
}

export interface ResumenDeSenalesPorTipo {
  readonly tipo: TipoDeIncidente;
  readonly total: number;
  readonly abiertas: number;
  readonly altas: number;
}

export interface ResumenDeSenalesPorCuenta {
  readonly cuentaId: string;
  readonly total: number;
  readonly abiertas: number;
  readonly altas: number;
}

export interface ServicioDeSenalesDePlataforma {
  /** Las señales de abuso (incidentes del sistema) de todas las cuentas, o de una, del más reciente al más antiguo. */
  listar(
    filtro: FiltroDeSenales,
    limite: number,
    desplazamiento: number,
  ): Promise<{ senales: SenalDePlataforma[]; total: number }>;
  /** Cuántas señales hubo de cada tipo entre `desde` (incl.) y `hasta` (excl.). */
  resumenPorTipo(desde: Date, hasta: Date): Promise<ResumenDeSenalesPorTipo[]>;
  /** Las `limite` cuentas con más señales (primero las de más gravedad alta) entre `desde` y `hasta`. */
  resumenPorCuenta(desde: Date, hasta: Date, limite: number): Promise<ResumenDeSenalesPorCuenta[]>;
}

export function crearServicioDeSenalesDePlataforma(pool: Pool): ServicioDeSenalesDePlataforma {
  const repositorio = new RepositorioDeIncidentesDeTodas(pool);
  return {
    async listar(filtro, limite, desplazamiento) {
      const [filas, total] = await Promise.all([
        repositorio.listarSenales(filtro, limite, desplazamiento),
        repositorio.contarSenales(filtro),
      ]);
      return {
        total,
        senales: filas.map((fila) => {
          const bruta: unknown =
            typeof fila.evidencia === 'string' ? JSON.parse(fila.evidencia) : fila.evidencia;
          return {
            id: fila.id,
            cuentaId: fila.tenant_id,
            usuarioId: fila.usuario_id,
            tipo: fila.tipo,
            gravedad: fila.gravedad,
            descripcion: fila.descripcion,
            evidencia: normalizarEvidencia(bruta as EvidenciaParcial),
            estado: fila.res_resultado ?? 'sin_resolver',
            ocurridoAt: aIso(fila.ocurrido_at),
            creadoAt: aIso(fila.created_at),
          };
        }),
      };
    },
    async resumenPorTipo(desde, hasta) {
      return (await repositorio.resumenPorTipo(desde, hasta)).map((fila) => ({
        tipo: fila.tipo,
        total: Number(fila.total),
        abiertas: Number(fila.abiertas),
        altas: Number(fila.altas),
      }));
    },
    async resumenPorCuenta(desde, hasta, limite) {
      return (await repositorio.resumenPorCuenta(desde, hasta, limite)).map((fila) => ({
        cuentaId: fila.tenant_id,
        total: Number(fila.total),
        abiertas: Number(fila.abiertas),
        altas: Number(fila.altas),
      }));
    },
  };
}
