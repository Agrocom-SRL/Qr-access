import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { registrarCambio } from '../bitacora/registrar-cambio.js';
import { ContextoCuenta } from '../contexto/contexto-cuenta.js';
import type { Transaccion } from './transaccion.js';

/** Quien ejecuta una lectura: el pool o la conexión de una transacción en curso. */
export type Ejecutor = Pool | PoolConnection;

/**
 * Qué reglas lleva una tabla (ADR 0007):
 * - `dominio`: soft delete, autoría y bitácora.
 * - `dominio_sin_bitacora`: soft delete y autoría; para pivotes cuyo cambio ya queda en la
 *   bitácora de la entidad que los crea.
 * - `transitoria`: se actualiza en sitio, sin soft delete ni bitácora (sesiones).
 * - `solo_insercion`: no se actualiza ni se borra (eventos de acceso).
 */
export type PerfilDeTabla = 'dominio' | 'dominio_sin_bitacora' | 'transitoria' | 'solo_insercion';

export interface DescripcionDeTabla {
  readonly nombre: string;
  /** Lista blanca de columnas que se pueden escribir: ninguna clave de un objeto llega al SQL sin estar acá. */
  readonly columnas: readonly string[];
  /** Columnas que nunca van a la bitácora (hashes, secretos). */
  readonly sensibles?: readonly string[];
  readonly perfil: PerfilDeTabla;
  /** `false` en las tablas sin `tenant_id` (catálogos de plataforma). */
  readonly deCuenta: boolean;
}

/**
 * Una consulta de lectura. Todos los textos son constantes escritas en el repositorio de un
 * módulo, nunca un valor del usuario: los valores van en `params` con `?`. La tabla es el
 * alias `t`; en `uniones` toda tabla de una cuenta se une también por `tenant_id`.
 */
export interface Consulta {
  readonly columnas: string;
  readonly uniones?: string;
  readonly donde?: string;
  /** Valores de los `?` de `donde`, en orden. */
  readonly params?: readonly unknown[];
  /** Constante o elegido de una lista blanca. */
  readonly orden?: string;
  readonly limite?: number;
  readonly desplazamiento?: number;
  /** `SELECT … FOR UPDATE`: solo dentro de una transacción. */
  readonly bloquear?: boolean;
}

export interface CondicionExtra {
  /** Sin alias de tabla (es un UPDATE): `usado_at IS NULL`. */
  readonly sql: string;
  readonly params?: readonly unknown[];
}

export interface OpcionesDeActualizacion {
  readonly cuando?: CondicionExtra;
  /** Solo para telemetría que no es un cambio relevante (latido del dispositivo). */
  readonly sinBitacora?: boolean;
}

export class UsoIndebidoDeRepositorio extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'UsoIndebidoDeRepositorio';
  }
}

interface Alcance {
  /** Condición de cuenta, con o sin alias, y sus parámetros. `null` = sin filtro. */
  condicion(
    alias: string | null,
  ): { readonly sql: string; readonly params: readonly unknown[] } | null;
  /** `tenant_id` a escribir en un insert. */
  readonly tenantId: string | null;
}

const IDENTIFICADOR = /^[a-z][a-z0-9_]*$/;
/** Columnas internas (borrado y generadas) que no son parte del dato que se audita. */
const COLUMNAS_DE_CONTROL = ['deleted_at', 'deleted_by', 'tenant_clave', 'vigente'] as const;

function sinSensibles(
  valores: Readonly<Record<string, unknown>>,
  sensibles: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(valores).filter(([columna]) => !sensibles.includes(columna)),
  );
}

/**
 * Mecánica común del SQL a mano (ADR 0002): arma los SELECT/INSERT/UPDATE con `?`, excluye lo
 * borrado, completa la autoría y escribe la bitácora en la misma transacción. Quien decide a
 * qué filas se llega es la subclase (`alcance`): la cuenta del contexto o la plataforma.
 */
export abstract class RepositorioBase {
  protected constructor(
    protected readonly pool: Pool,
    protected readonly tabla: DescripcionDeTabla,
  ) {
    for (const columna of [...tabla.columnas, ...(tabla.sensibles ?? [])]) {
      if (!IDENTIFICADOR.test(columna))
        throw new UsoIndebidoDeRepositorio(`Columna inválida: ${columna}`);
    }
  }

  protected abstract alcance(): Alcance;

  private get conSoftDelete(): boolean {
    return this.tabla.perfil === 'dominio' || this.tabla.perfil === 'dominio_sin_bitacora';
  }

  private get conBitacora(): boolean {
    return this.tabla.perfil === 'dominio';
  }

  private condicionesBase(alias: string | null): { sql: string[]; params: unknown[] } {
    const prefijo = alias === null ? '' : `${alias}.`;
    const sql: string[] = [];
    const params: unknown[] = [];
    const alcance = this.alcance().condicion(alias);
    if (alcance !== null) {
      sql.push(alcance.sql);
      params.push(...alcance.params);
    }
    if (this.conSoftDelete) sql.push(`${prefijo}deleted_at IS NULL`);
    return { sql, params };
  }

  private armarSelect(
    consulta: Consulta,
    forma: 'filas' | 'conteo',
  ): { sql: string; params: unknown[] } {
    const base = this.condicionesBase('t');
    const donde = [...base.sql];
    if (consulta.donde !== undefined) donde.push(`(${consulta.donde})`);
    const partes = [
      'SELECT',
      forma === 'conteo' ? 'COUNT(*) AS total' : consulta.columnas,
      'FROM',
      this.tabla.nombre,
      'AS t',
      consulta.uniones ?? '',
      donde.length > 0 ? `WHERE ${donde.join(' AND ')}` : '',
    ];
    const params = [...base.params, ...(consulta.params ?? [])];
    if (forma === 'filas') {
      if (consulta.orden !== undefined) partes.push('ORDER BY', consulta.orden);
      if (consulta.limite !== undefined) {
        partes.push('LIMIT ? OFFSET ?');
        params.push(consulta.limite, consulta.desplazamiento ?? 0);
      }
      if (consulta.bloquear === true) partes.push('FOR UPDATE');
    }
    return { sql: partes.filter((parte) => parte !== '').join(' '), params };
  }

  protected async seleccionar<F extends RowDataPacket>(
    consulta: Consulta,
    ejecutor: Ejecutor = this.pool,
  ): Promise<F[]> {
    const { sql, params } = this.armarSelect(consulta, 'filas');
    const [filas] = await ejecutor.query<F[]>(sql, params);
    return filas;
  }

  protected async seleccionarUna<F extends RowDataPacket>(
    consulta: Consulta,
    ejecutor: Ejecutor = this.pool,
  ): Promise<F | null> {
    const filas = await this.seleccionar<F>({ ...consulta, limite: 1 }, ejecutor);
    return filas[0] ?? null;
  }

  protected async contar(
    consulta: Pick<Consulta, 'uniones' | 'donde' | 'params'>,
    ejecutor: Ejecutor = this.pool,
  ): Promise<number> {
    const { sql, params } = this.armarSelect({ columnas: '', ...consulta }, 'conteo');
    const [filas] = await ejecutor.query<RowDataPacket[]>(sql, params);
    return Number(filas[0]?.total ?? 0);
  }

  private validarColumnas(valores: Readonly<Record<string, unknown>>): void {
    for (const columna of Object.keys(valores)) {
      if (!this.tabla.columnas.includes(columna)) {
        throw new UsoIndebidoDeRepositorio(`${this.tabla.nombre}.${columna} no es escribible`);
      }
    }
  }

  private exigirEscritura(): void {
    if (this.tabla.deCuenta && this.alcance().tenantId === null) {
      throw new UsoIndebidoDeRepositorio(
        `${this.tabla.nombre} es de una cuenta: se escribe con RepositorioDeCuenta`,
      );
    }
  }

  protected async insertar(
    tx: Transaccion,
    valores: Readonly<Record<string, unknown>>,
  ): Promise<string> {
    this.exigirEscritura();
    this.validarColumnas(valores);
    const { tenantId } = this.alcance();
    const usuarioId = ContextoCuenta.actual()?.usuarioId ?? null;

    const fila: Record<string, unknown> = { ...valores };
    if (this.tabla.deCuenta) fila.tenant_id = tenantId;
    if (this.conSoftDelete) {
      fila.created_by = usuarioId;
      fila.updated_by = usuarioId;
    }

    const columnas = Object.keys(fila);
    const [resultado] = await tx.query<ResultSetHeader>(
      [
        'INSERT INTO',
        this.tabla.nombre,
        `(${columnas.join(', ')})`,
        `VALUES (${columnas.map(() => '?').join(', ')})`,
      ].join(' '),
      Object.values(fila),
    );
    const id = String(resultado.insertId);

    if (this.conBitacora) {
      await registrarCambio(tx, {
        tenantId: this.tabla.deCuenta ? tenantId : null,
        tabla: this.tabla.nombre,
        registroId: id,
        accion: 'creado',
        antes: null,
        despues: sinSensibles(valores, this.tabla.sensibles ?? []),
      });
    }
    return id;
  }

  /**
   * Actualiza una fila. Primero la lee con `FOR UPDATE` (para registrar el antes y serializar a
   * los que compiten por ella) y después aplica el UPDATE con la condición extra: es el
   * "compare-and-set" del consumo de un QR. Devuelve `false` si la fila no existe en este
   * alcance o si la condición ya no se cumple.
   */
  protected async actualizar(
    tx: Transaccion,
    id: string,
    cambios: Readonly<Record<string, unknown>>,
    opciones: OpcionesDeActualizacion = {},
  ): Promise<boolean> {
    if (this.tabla.perfil === 'solo_insercion') {
      throw new UsoIndebidoDeRepositorio(`${this.tabla.nombre} es de solo inserción`);
    }
    this.exigirEscritura();
    this.validarColumnas(cambios);
    const columnas = Object.keys(cambios);
    if (columnas.length === 0) throw new UsoIndebidoDeRepositorio('Actualización sin cambios');

    const antes = await this.seleccionarUna<RowDataPacket>(
      {
        columnas: columnas.map((c) => `t.${c}`).join(', '),
        donde: 't.id = ?',
        params: [id],
        bloquear: true,
      },
      tx,
    );
    if (antes === null) return false;

    const base = this.condicionesBase(null);
    const asignaciones = columnas.map((columna) => `${columna} = ?`);
    const valores: unknown[] = columnas.map((columna) => cambios[columna]);
    if (this.conSoftDelete) {
      asignaciones.push('updated_by = ?');
      valores.push(ContextoCuenta.actual()?.usuarioId ?? null);
    }
    const donde = [...base.sql, 'id = ?'];
    const paramsDonde = [...base.params, id];
    if (opciones.cuando !== undefined) {
      donde.push(`(${opciones.cuando.sql})`);
      paramsDonde.push(...(opciones.cuando.params ?? []));
    }

    const [resultado] = await tx.query<ResultSetHeader>(
      [
        'UPDATE',
        this.tabla.nombre,
        'SET',
        asignaciones.join(', '),
        'WHERE',
        donde.join(' AND '),
      ].join(' '),
      [...valores, ...paramsDonde],
    );
    if (resultado.affectedRows !== 1) return false;

    if (this.conBitacora && opciones.sinBitacora !== true) {
      const sensibles = this.tabla.sensibles ?? [];
      await registrarCambio(tx, {
        tenantId: this.tabla.deCuenta ? this.alcance().tenantId : null,
        tabla: this.tabla.nombre,
        registroId: id,
        accion: 'actualizado',
        antes: sinSensibles({ ...antes }, sensibles),
        despues: sinSensibles(cambios, sensibles),
      });
    }
    return true;
  }

  /** Soft delete (invariante 8): marca `deleted_at` y `deleted_by`, nunca un `DELETE`. */
  protected async borrar(tx: Transaccion, id: string): Promise<boolean> {
    if (!this.conSoftDelete) {
      throw new UsoIndebidoDeRepositorio(`${this.tabla.nombre} no se borra`);
    }
    this.exigirEscritura();
    const fila = await this.seleccionarUna<RowDataPacket>(
      { columnas: 't.*', donde: 't.id = ?', params: [id], bloquear: true },
      tx,
    );
    if (fila === null) return false;

    const base = this.condicionesBase(null);
    const [resultado] = await tx.query<ResultSetHeader>(
      [
        'UPDATE',
        this.tabla.nombre,
        'SET deleted_at = ?, deleted_by = ?',
        `WHERE ${[...base.sql, 'id = ?'].join(' AND ')}`,
      ].join(' '),
      [new Date(), ContextoCuenta.actual()?.usuarioId ?? null, ...base.params, id],
    );
    if (resultado.affectedRows !== 1) return false;

    if (this.conBitacora) {
      const sensibles = this.tabla.sensibles ?? [];
      await registrarCambio(tx, {
        tenantId: this.tabla.deCuenta ? this.alcance().tenantId : null,
        tabla: this.tabla.nombre,
        registroId: id,
        accion: 'eliminado',
        antes: sinSensibles({ ...fila }, [...sensibles, ...COLUMNAS_DE_CONTROL]),
        despues: null,
      });
    }
    return true;
  }
}
