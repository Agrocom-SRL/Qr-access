import type { Pool } from 'mysql2/promise';
import type { Transaccion } from '../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import type { Listado, Paginacion } from '../../platform/http/paginacion.js';
import {
  ejecutar as listarPuertasDeLaCuenta,
  type PuertaListada,
} from './actions/listar-puertas.js';
import * as asignaciones from './actions/asignar-puertas.js';
import * as estructura from './actions/gestionar-estructura.js';
import {
  RepositorioDePuertas,
  RepositorioDeSitios,
  RepositorioDeUnidades,
  type PuertaFila,
} from './repository.js';
import { type IdsOTodaLaCuenta } from '../../platform/db/alcance.js';

export type { PuertaListada } from './actions/listar-puertas.js';
export type {
  CambiosDePuerta,
  CambiosDeSitio,
  DatosDePuerta,
  DatosDeSitio,
  SitioDeEstructura,
} from './actions/gestionar-estructura.js';
export type { PuertasAsignadas } from './actions/asignar-puertas.js';
export { SEGUNDOS_MAXIMOS, SEGUNDOS_MINIMOS } from './actions/gestionar-estructura.js';

/** Lo que otros módulos pueden saber de una puerta (accesos, dispositivos). */
export interface PuertaDeCuenta {
  readonly id: string;
  readonly nombre: string;
  readonly sitioId: string;
  readonly sitioNombre: string;
  /** Zona IANA del sitio, en la que se evalúa el fin del día (invariante 7). */
  readonly zonaHoraria: string;
  readonly segundosApertura: number;
  readonly activa: boolean;
}

/** La unidad de un Titular: lo que el resto de los módulos puede saber de ella. */
export interface UnidadDeTitular {
  readonly id: string;
  readonly nombre: string;
  readonly sitioId: string;
}

export interface ServicioDeOrganizacion {
  /** Puertas de la cuenta del contexto. Un id inexistente o de otra cuenta simplemente no vuelve. */
  buscarPuertas(ids: readonly string[]): Promise<PuertaDeCuenta[]>;
  /** Cuántos sitios y puertas activos tiene la cuenta del contexto. */
  contarSitiosYPuertas(): Promise<{ sitios: number; puertas: number }>;
  /** Las puertas activas de la cuenta del contexto con su sitio y el estado de su lector. */
  listarPuertasConEstado(paginacion: Paginacion, ahora: Date): Promise<Listado<PuertaListada>>;
  /** Sitios con TODAS sus puertas y lectores de la cuenta del contexto: la vista de gestión. */
  verEstructura(ahora: Date): Promise<estructura.SitioDeEstructura[]>;
  crearSitio(datos: estructura.DatosDeSitio): Promise<{ id: string }>;
  editarSitio(id: string, cambios: estructura.CambiosDeSitio): Promise<void>;
  eliminarSitio(id: string): Promise<void>;
  crearPuerta(sitioId: string, datos: estructura.DatosDePuerta): Promise<{ id: string }>;
  editarPuerta(id: string, cambios: estructura.CambiosDePuerta): Promise<void>;
  eliminarPuerta(id: string): Promise<void>;
  /**
   * Cuántas puertas (activas o no) dieron de alta esos usuarios en la cuenta del contexto: para la exportación.
   * `TODA_LA_CUENTA` = todas las de la cuenta (la exportación que hace AGROCOM, cuyo alcance es la cuenta entera).
   */
  contarPuertas(autores: IdsOTodaLaCuenta): Promise<number>;
  /** Una página de esas puertas, por id: para la exportación (`autores` = el alcance de quien exporta). */
  puertasPagina(
    autores: IdsOTodaLaCuenta,
    limite: number,
    desplazamiento: number,
  ): Promise<PuertaDeCuenta[]>;
  /** Puertas a las que está asignado el usuario (guardia) de la cuenta del contexto. */
  puertasAsignadasA(usuarioId: string): Promise<asignaciones.PuertasAsignadas>;
  asignarPuertas(usuarioId: string, puertas: asignaciones.PuertasAsignadas): Promise<void>;
  /**
   * Crea la unidad de un Titular, dentro de la transacción que lo da de alta (ADR 0028). El sitio
   * debe existir en la cuenta del contexto (404) y el nombre no repetirse dentro de él (409).
   */
  crearUnidad(
    tx: Transaccion,
    datos: { sitioId: string; nombre: string; titularId: string },
  ): Promise<{ id: string }>;
  /** `titularId -> unidad` de la cuenta del contexto; un Titular sin unidad no aparece. */
  unidadesDeTitulares(titularIds: readonly string[]): Promise<Map<string, UnidadDeTitular>>;
  /** Da de baja las unidades de esos Titulares (soft delete), en la transacción de su baja. */
  darDeBajaUnidadesDe(tx: Transaccion, titularIds: readonly string[]): Promise<void>;
}

function esDuplicado(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}

function aPuerta(fila: PuertaFila): PuertaDeCuenta {
  return {
    id: fila.id,
    nombre: fila.nombre,
    sitioId: fila.sitio_id,
    sitioNombre: fila.sitio_nombre,
    zonaHoraria: fila.zona_horaria,
    segundosApertura: fila.segundos_apertura,
    activa: fila.activo === 1,
  };
}

export function crearServicioDeOrganizacion(pool: Pool): ServicioDeOrganizacion {
  const puertas = new RepositorioDePuertas(pool);
  return {
    async contarSitiosYPuertas() {
      const [sitios, cantidad] = await Promise.all([
        new RepositorioDeSitios(pool).contarActivos(),
        puertas.contarActivas(),
      ]);
      return { sitios, puertas: cantidad };
    },
    contarPuertas: (autores) => puertas.contarDe(autores),
    async puertasPagina(autores, limite, desplazamiento) {
      return (await puertas.listarPaginaDe(autores, limite, desplazamiento)).map(aPuerta);
    },
    listarPuertasConEstado: (paginacion, ahora) => listarPuertasDeLaCuenta(pool, paginacion, ahora),
    async buscarPuertas(ids) {
      return (await puertas.buscarPorIds(ids)).map(aPuerta);
    },
    verEstructura: (ahora) => estructura.verEstructura(pool, ahora),
    crearSitio: (datos) => estructura.crearSitio(pool, datos),
    editarSitio: (id, cambios) => estructura.editarSitio(pool, id, cambios),
    eliminarSitio: (id) => estructura.eliminarSitio(pool, id),
    crearPuerta: (sitioId, datos) => estructura.crearPuerta(pool, sitioId, datos),
    editarPuerta: (id, cambios) => estructura.editarPuerta(pool, id, cambios),
    eliminarPuerta: (id) => estructura.eliminarPuerta(pool, id),
    puertasAsignadasA: (usuarioId) => asignaciones.ver(pool, usuarioId),
    asignarPuertas: (usuarioId, puertas) => asignaciones.reemplazar(pool, usuarioId, puertas),
    async crearUnidad(tx, datos) {
      const sitio = await new RepositorioDeSitios(pool).buscarPorId(datos.sitioId);
      if (sitio?.activo !== 1) throw new ErrorDeDominio('sitio.no_encontrado', 404);
      try {
        return { id: await new RepositorioDeUnidades(pool).crear(tx, datos) };
      } catch (error) {
        if (esDuplicado(error)) throw new ErrorDeDominio('unidad.nombre_existente', 409);
        throw error;
      }
    },
    async unidadesDeTitulares(titularIds) {
      const mapa = new Map<string, UnidadDeTitular>();
      for (const fila of await new RepositorioDeUnidades(pool).deTitulares(titularIds)) {
        if (fila.titular_id !== null) {
          mapa.set(fila.titular_id, { id: fila.id, nombre: fila.nombre, sitioId: fila.sitio_id });
        }
      }
      return mapa;
    },
    darDeBajaUnidadesDe: (tx, titularIds) =>
      new RepositorioDeUnidades(pool).darDeBajaDeTitulares(tx, titularIds),
  };
}
