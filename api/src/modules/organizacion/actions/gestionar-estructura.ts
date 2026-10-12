import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { aIsoONulo } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeDispositivos } from '../../dispositivos/contracts.js';
import { RepositorioDePuertas, RepositorioDeSitios } from '../repository.js';

export interface PuertaDeEstructura {
  id: string;
  nombre: string;
  segundos_apertura: number;
  activa: boolean;
  dispositivo: {
    id: string;
    nombre: string;
    en_linea: boolean;
    ultimo_latido_at: string | null;
  } | null;
}

export interface SitioDeEstructura {
  id: string;
  nombre: string;
  direccion: string | null;
  zona_horaria: string;
  activo: boolean;
  puertas: PuertaDeEstructura[];
}

export interface DatosDeSitio {
  readonly nombre: string;
  readonly direccion: string | null;
  readonly zonaHoraria: string;
}

export interface CambiosDeSitio {
  readonly nombre?: string;
  readonly direccion?: string | null;
  readonly zonaHoraria?: string;
  readonly activo?: boolean;
}

export interface DatosDePuerta {
  readonly nombre: string;
  readonly segundosApertura: number;
}

export interface CambiosDePuerta {
  readonly nombre?: string;
  readonly segundosApertura?: number;
  readonly activa?: boolean;
}

/** Los segundos que la cerradura queda abierta por pulso (hardware: 1 a 30, `ck_puertas_segundos`). */
export const SEGUNDOS_MINIMOS = 1;
export const SEGUNDOS_MAXIMOS = 30;

function esDuplicado(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}

function exigirZonaValida(zona: string): void {
  if (!Intl.supportedValuesOf('timeZone').includes(zona)) {
    throw new ErrorDeDominio('sitio.zona_invalida', 422);
  }
}

function exigirSegundosValidos(segundos: number): void {
  if (!Number.isInteger(segundos) || segundos < SEGUNDOS_MINIMOS || segundos > SEGUNDOS_MAXIMOS) {
    throw new ErrorDeDominio('puerta.segundos_invalidos', 422);
  }
}

/**
 * Los sitios de la cuenta del contexto con todas sus puertas (activas o no) y el lector de cada
 * una. Es la vista de gestión: incluye sitios sin puertas, que la lista de la app no muestra.
 */
export async function verEstructura(
  pool: Pool,
  ahora: Date = new Date(),
): Promise<SitioDeEstructura[]> {
  const [sitios, puertas] = await Promise.all([
    new RepositorioDeSitios(pool).listarTodos(),
    new RepositorioDePuertas(pool).listarTodas(),
  ]);
  const lectores = await crearServicioDeDispositivos(pool).porPuerta(
    puertas.map((puerta) => puerta.id),
    ahora,
  );
  return sitios.map((sitio) => ({
    id: sitio.id,
    nombre: sitio.nombre,
    direccion: sitio.direccion,
    zona_horaria: sitio.zona_horaria,
    activo: sitio.activo === 1,
    puertas: puertas
      .filter((puerta) => puerta.sitio_id === sitio.id)
      .map((puerta) => {
        const lector = lectores.get(puerta.id);
        return {
          id: puerta.id,
          nombre: puerta.nombre,
          segundos_apertura: puerta.segundos_apertura,
          activa: puerta.activo === 1,
          dispositivo:
            lector === undefined
              ? null
              : {
                  id: lector.id,
                  nombre: lector.nombre,
                  en_linea: lector.enLinea,
                  ultimo_latido_at: aIsoONulo(lector.ultimoLatidoAt),
                },
        };
      }),
  }));
}

export async function crearSitio(pool: Pool, datos: DatosDeSitio): Promise<{ id: string }> {
  exigirZonaValida(datos.zonaHoraria);
  try {
    const id = await enTransaccion(pool, (tx) => new RepositorioDeSitios(pool).crear(tx, datos));
    return { id };
  } catch (error) {
    if (esDuplicado(error)) throw new ErrorDeDominio('sitio.nombre_existente', 409);
    throw error;
  }
}

export async function editarSitio(pool: Pool, id: string, cambios: CambiosDeSitio): Promise<void> {
  const repositorio = new RepositorioDeSitios(pool);
  if ((await repositorio.buscarPorId(id)) === null) {
    throw new ErrorDeDominio('sitio.no_encontrado', 404);
  }
  if (cambios.zonaHoraria !== undefined) exigirZonaValida(cambios.zonaHoraria);
  const valores = {
    ...(cambios.nombre === undefined ? {} : { nombre: cambios.nombre }),
    ...(cambios.direccion === undefined ? {} : { direccion: cambios.direccion }),
    ...(cambios.zonaHoraria === undefined ? {} : { zona_horaria: cambios.zonaHoraria }),
    ...(cambios.activo === undefined ? {} : { activo: cambios.activo ? 1 : 0 }),
  };
  if (Object.keys(valores).length === 0) return;
  try {
    await enTransaccion(pool, (tx) => repositorio.editar(tx, id, valores));
  } catch (error) {
    if (esDuplicado(error)) throw new ErrorDeDominio('sitio.nombre_existente', 409);
    throw error;
  }
}

/** Solo se elimina un sitio sin puertas: primero se quitan (o se mueven) las puertas. */
export async function eliminarSitio(pool: Pool, id: string): Promise<void> {
  const sitios = new RepositorioDeSitios(pool);
  if ((await sitios.buscarPorId(id)) === null) throw new ErrorDeDominio('sitio.no_encontrado', 404);
  if ((await new RepositorioDePuertas(pool).contarDelSitio(id)) > 0) {
    throw new ErrorDeDominio('sitio.con_puertas', 409);
  }
  await enTransaccion(pool, (tx) => sitios.eliminar(tx, id));
}

export async function crearPuerta(
  pool: Pool,
  sitioId: string,
  datos: DatosDePuerta,
): Promise<{ id: string }> {
  exigirSegundosValidos(datos.segundosApertura);
  if ((await new RepositorioDeSitios(pool).buscarPorId(sitioId)) === null) {
    throw new ErrorDeDominio('sitio.no_encontrado', 404);
  }
  try {
    const id = await enTransaccion(pool, (tx) =>
      new RepositorioDePuertas(pool).crear(tx, { sitioId, ...datos }),
    );
    return { id };
  } catch (error) {
    if (esDuplicado(error)) throw new ErrorDeDominio('puerta.nombre_existente', 409);
    throw error;
  }
}

export async function editarPuerta(
  pool: Pool,
  id: string,
  cambios: CambiosDePuerta,
): Promise<void> {
  const repositorio = new RepositorioDePuertas(pool);
  if ((await repositorio.buscarPorIds([id])).length === 0) {
    throw new ErrorDeDominio('puerta.no_encontrada', 404);
  }
  if (cambios.segundosApertura !== undefined) exigirSegundosValidos(cambios.segundosApertura);
  const valores = {
    ...(cambios.nombre === undefined ? {} : { nombre: cambios.nombre }),
    ...(cambios.segundosApertura === undefined
      ? {}
      : { segundos_apertura: cambios.segundosApertura }),
    ...(cambios.activa === undefined ? {} : { activo: cambios.activa ? 1 : 0 }),
  };
  if (Object.keys(valores).length === 0) return;
  try {
    await enTransaccion(pool, (tx) => repositorio.editar(tx, id, valores));
  } catch (error) {
    if (esDuplicado(error)) throw new ErrorDeDominio('puerta.nombre_existente', 409);
    throw error;
  }
}

/**
 * Elimina una puerta que ya no tiene lector en servicio. Con un lector, primero hay que darlo de
 * baja: un ESP32 vinculado a una puerta inexistente seguiría rechazando accesos sin que nadie sepa por qué.
 */
export async function eliminarPuerta(pool: Pool, id: string): Promise<void> {
  const repositorio = new RepositorioDePuertas(pool);
  if ((await repositorio.buscarPorIds([id])).length === 0) {
    throw new ErrorDeDominio('puerta.no_encontrada', 404);
  }
  const lectores = await crearServicioDeDispositivos(pool).porPuerta([id], new Date());
  if (lectores.has(id)) throw new ErrorDeDominio('puerta.con_dispositivo', 409);
  await enTransaccion(pool, (tx) => repositorio.eliminar(tx, id));
}
