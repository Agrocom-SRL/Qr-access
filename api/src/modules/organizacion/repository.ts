import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import { TODA_LA_CUENTA, type IdsOTodaLaCuenta } from '../../platform/db/alcance.js';

export interface PuertaFila extends RowDataPacket {
  id: string;
  nombre: string;
  segundos_apertura: number;
  activo: number;
  /** 1 si el administrador habilitó la apertura manual desde la app en esta puerta (ADR 0035 §5). */
  apertura_manual: number;
  sitio_id: string;
  sitio_nombre: string;
  zona_horaria: string;
}

const COLUMNAS =
  't.id, t.nombre, t.segundos_apertura, t.activo, t.apertura_manual, s.id AS sitio_id, s.nombre AS sitio_nombre, s.zona_horaria';
/** El sitio es de la misma cuenta que la puerta: se une también por `tenant_id`. */
const UNION_SITIO =
  'JOIN sitios AS s ON s.id = t.sitio_id AND s.tenant_id = t.tenant_id AND s.deleted_at IS NULL';

/** Dueño de `puertas` (y de `sitios`, que por ahora solo se leen unidos a una puerta). */
export class RepositorioDePuertas extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'puertas',
      columnas: ['sitio_id', 'nombre', 'segundos_apertura', 'activo', 'apertura_manual'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  /** Todas las puertas de la cuenta del contexto, activas o no (la gestión desde la plataforma). */
  listarTodas(): Promise<PuertaFila[]> {
    return this.seleccionar<PuertaFila>({
      columnas: COLUMNAS,
      uniones: UNION_SITIO,
      orden: 's.nombre, t.nombre, t.id',
    });
  }

  contarDelSitio(sitioId: string): Promise<number> {
    return this.contar({ donde: 't.sitio_id = ?', params: [sitioId] });
  }

  /** `aperturaManual` es el valor inicial de la cuenta (`cuentas.apertura_manual_por_omision`, ADR 0035 §5). */
  crear(
    tx: Transaccion,
    puerta: { sitioId: string; nombre: string; segundosApertura: number; aperturaManual: boolean },
  ): Promise<string> {
    return this.insertar(tx, {
      sitio_id: puerta.sitioId,
      nombre: puerta.nombre,
      segundos_apertura: puerta.segundosApertura,
      activo: 1,
      apertura_manual: puerta.aperturaManual ? 1 : 0,
    });
  }

  /** Enciende o apaga la apertura manual de una puerta; queda en la bitácora con el antes y el después. */
  fijarAperturaManual(tx: Transaccion, id: string, habilitada: boolean): Promise<boolean> {
    return this.actualizar(tx, id, { apertura_manual: habilitada ? 1 : 0 });
  }

  /**
   * Las puertas activas (en sitios activos) de la cuenta del contexto, sin paginar: es la lista que la app
   * ofrece en el botón de abrir y la pantalla del administrador, y una cuenta tiene decenas de puertas, no miles.
   */
  listarActivasSinPaginar(): Promise<PuertaFila[]> {
    return this.seleccionar<PuertaFila>({
      columnas: COLUMNAS,
      uniones: UNION_SITIO,
      donde: 't.activo = 1 AND s.activo = 1',
      orden: 's.nombre, t.nombre, t.id',
    });
  }

  editar(
    tx: Transaccion,
    id: string,
    cambios: Readonly<Record<string, unknown>>,
  ): Promise<boolean> {
    return this.actualizar(tx, id, cambios);
  }

  /** Baja lógica: la puerta deja de existir para la cuenta. */
  eliminar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }

  listarActivas(limite: number, desplazamiento: number): Promise<PuertaFila[]> {
    return this.seleccionar<PuertaFila>({
      columnas: COLUMNAS,
      uniones: UNION_SITIO,
      donde: 't.activo = 1 AND s.activo = 1',
      orden: 's.nombre, t.nombre, t.id',
      limite,
      desplazamiento,
    });
  }

  contarActivas(): Promise<number> {
    return this.contar({ uniones: UNION_SITIO, donde: 't.activo = 1 AND s.activo = 1' });
  }

  /**
   * Una página de las puertas (activas o no) que dieron de alta `autores` (el alcance de quien exporta: él y su
   * rama), por id: para la exportación (ADR 0033 §3). Una puerta no tiene otro dueño que quien la creó.
   */
  listarPaginaDe(
    autores: IdsOTodaLaCuenta,
    limite: number,
    desplazamiento: number,
  ): Promise<PuertaFila[]> {
    if (autores !== TODA_LA_CUENTA && autores.length === 0) return Promise.resolve([]);
    return this.seleccionar<PuertaFila>({
      columnas: COLUMNAS,
      uniones: UNION_SITIO,
      ...(autores === TODA_LA_CUENTA ? {} : { donde: 't.created_by IN (?)', params: [autores] }),
      orden: 't.id',
      limite,
      desplazamiento,
    });
  }

  /** `autores` `TODA_LA_CUENTA` = todas las puertas de la cuenta (la exportación de AGROCOM); el repositorio ya filtra por ella. */
  contarDe(autores: IdsOTodaLaCuenta): Promise<number> {
    if (autores !== TODA_LA_CUENTA && autores.length === 0) return Promise.resolve(0);
    return this.contar({
      uniones: UNION_SITIO,
      ...(autores === TODA_LA_CUENTA ? {} : { donde: 't.created_by IN (?)', params: [autores] }),
    });
  }

  /** Las puertas de la cuenta del contexto con esos ids; las que no existan o sean de otra cuenta no vuelven. */
  buscarPorIds(ids: readonly string[]): Promise<PuertaFila[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.seleccionar<PuertaFila>({
      columnas: COLUMNAS,
      uniones: UNION_SITIO,
      donde: 't.id IN (?)',
      params: [ids],
    });
  }
}

export interface SitioFila extends RowDataPacket {
  id: string;
  nombre: string;
  direccion: string | null;
  zona_horaria: string;
  activo: number;
}

/** Dueño de `sitios`: los datos de cada lugar con puertas de la cuenta (HU-07). */
export class RepositorioDeSitios extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'sitios',
      columnas: ['nombre', 'direccion', 'zona_horaria', 'activo'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  contarActivos(): Promise<number> {
    return this.contar({ donde: 't.activo = 1' });
  }

  listarTodos(): Promise<SitioFila[]> {
    return this.seleccionar<SitioFila>({
      columnas: 't.id, t.nombre, t.direccion, t.zona_horaria, t.activo',
      orden: 't.nombre, t.id',
    });
  }

  buscarPorId(id: string): Promise<SitioFila | null> {
    return this.seleccionarUna<SitioFila>({
      columnas: 't.id, t.nombre, t.direccion, t.zona_horaria, t.activo',
      donde: 't.id = ?',
      params: [id],
    });
  }

  crear(
    tx: Transaccion,
    sitio: { nombre: string; direccion: string | null; zonaHoraria: string },
  ): Promise<string> {
    return this.insertar(tx, {
      nombre: sitio.nombre,
      direccion: sitio.direccion,
      zona_horaria: sitio.zonaHoraria,
      activo: 1,
    });
  }

  editar(
    tx: Transaccion,
    id: string,
    cambios: Readonly<Record<string, unknown>>,
  ): Promise<boolean> {
    return this.actualizar(tx, id, cambios);
  }

  /** Baja lógica: solo de un sitio sin puertas (lo verifica la acción). */
  eliminar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
}

export interface AsignacionFila extends RowDataPacket {
  id: string;
  /** `null` = todas las puertas de la cuenta. */
  puerta_id: string | null;
}

/** Dueño de `asignaciones_puerta`: a qué puertas está asignado cada usuario (guardia). */
export class RepositorioDeAsignaciones extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'asignaciones_puerta',
      columnas: ['usuario_id', 'puerta_id'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  deUsuario(usuarioId: string): Promise<AsignacionFila[]> {
    return this.seleccionar<AsignacionFila>({
      columnas: 't.id, t.puerta_id',
      donde: 't.usuario_id = ?',
      params: [usuarioId],
      orden: 't.id',
    });
  }

  asignar(tx: Transaccion, usuarioId: string, puertaId: string | null): Promise<string> {
    return this.insertar(tx, { usuario_id: usuarioId, puerta_id: puertaId });
  }

  quitar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
}

export interface UnidadFila extends RowDataPacket {
  id: string;
  sitio_id: string;
  nombre: string;
  titular_id: string | null;
}

/** Dueño de `unidades`: una por Titular dentro de una propiedad (ADR 0028). */
export class RepositorioDeUnidades extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'unidades',
      columnas: ['sitio_id', 'nombre', 'titular_id', 'activo'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  crear(
    tx: Transaccion,
    unidad: { sitioId: string; nombre: string; titularId: string },
  ): Promise<string> {
    return this.insertar(tx, {
      sitio_id: unidad.sitioId,
      nombre: unidad.nombre,
      titular_id: unidad.titularId,
      activo: 1,
    });
  }

  /** Las unidades de esos Titulares; la de otra cuenta o de un Titular sin unidad no vuelve. */
  deTitulares(titularIds: readonly string[]): Promise<UnidadFila[]> {
    if (titularIds.length === 0) return Promise.resolve([]);
    return this.seleccionar<UnidadFila>({
      columnas: 't.id, t.sitio_id, t.nombre, t.titular_id',
      donde: 't.titular_id IN (?)',
      params: [titularIds],
    });
  }

  /** Baja lógica de las unidades de esos Titulares (la baja del Titular se lleva su unidad). */
  async darDeBajaDeTitulares(tx: Transaccion, titularIds: readonly string[]): Promise<void> {
    for (const unidad of await this.deTitulares(titularIds)) await this.borrar(tx, unidad.id);
  }
}
