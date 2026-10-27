import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import type {
  EstadoDeIncidente,
  Evidencia,
  Gravedad,
  OrigenDeIncidente,
  ResultadoDeResolucion,
  TipoDeIncidente,
} from './domain/incidente.js';

export interface IncidenteFila extends RowDataPacket {
  id: string;
  usuario_id: string;
  tipo: TipoDeIncidente;
  gravedad: Gravedad;
  origen: OrigenDeIncidente;
  registrado_por: string | null;
  descripcion: string | null;
  /** MariaDB guarda JSON como texto; llega como `string`. */
  evidencia: string | object;
  ocurrido_at: Date;
  created_at: Date;
  /** La última resolución (la de mayor id); todo `null` si aún no hay ninguna. */
  res_id: string | null;
  res_resultado: ResultadoDeResolucion | null;
  res_motivo: string | null;
  res_resuelto_por: string | null;
  res_resuelta_at: Date | null;
}

const COLUMNAS =
  't.id, t.usuario_id, t.tipo, t.gravedad, t.origen, t.registrado_por, t.descripcion, t.evidencia, t.ocurrido_at, ' +
  't.created_at, r.id AS res_id, r.resultado AS res_resultado, r.motivo AS res_motivo, ' +
  'r.resuelto_por AS res_resuelto_por, r.resuelta_at AS res_resuelta_at';

/**
 * La última resolución de cada incidente, unida por `tenant_id` también. La subconsulta toma la de mayor id: las
 * resoluciones son de solo inserción, así que la vigente es siempre la más nueva.
 */
const UNION_RESOLUCION =
  'LEFT JOIN resoluciones_de_incidente AS r ON r.tenant_id = t.tenant_id AND r.id = (' +
  'SELECT MAX(r2.id) FROM resoluciones_de_incidente AS r2 WHERE r2.incidente_id = t.id AND r2.tenant_id = t.tenant_id)';

export interface FiltroDeIncidentes {
  /** Solo incidentes de estos usuarios; `null` = de toda la cuenta. */
  readonly usuarioIds: readonly string[] | null;
  readonly usuarioId: string | null;
  readonly tipo: TipoDeIncidente | null;
  readonly origen: OrigenDeIncidente | null;
  readonly estado: EstadoDeIncidente | null;
}

function armarFiltro(filtro: FiltroDeIncidentes): { donde?: string; params: unknown[] } {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.usuarioIds !== null) {
    if (filtro.usuarioIds.length === 0) {
      condiciones.push('1 = 0');
    } else {
      condiciones.push('t.usuario_id IN (?)');
      params.push(filtro.usuarioIds);
    }
  }
  if (filtro.usuarioId !== null) {
    condiciones.push('t.usuario_id = ?');
    params.push(filtro.usuarioId);
  }
  if (filtro.tipo !== null) {
    condiciones.push('t.tipo = ?');
    params.push(filtro.tipo);
  }
  if (filtro.origen !== null) {
    condiciones.push('t.origen = ?');
    params.push(filtro.origen);
  }
  if (filtro.estado === 'sin_resolver') {
    condiciones.push('r.id IS NULL');
  } else if (filtro.estado !== null) {
    condiciones.push('r.resultado = ?');
    params.push(filtro.estado);
  }
  return condiciones.length === 0 ? { params } : { donde: condiciones.join(' AND '), params };
}

export interface NuevoIncidente {
  readonly usuarioId: string;
  readonly tipo: TipoDeIncidente;
  readonly gravedad: Gravedad;
  readonly origen: OrigenDeIncidente;
  readonly registradoPor: string | null;
  readonly descripcion: string | null;
  readonly evidencia: Evidencia;
  readonly claveUnica: string | null;
  readonly ocurridoAt: Date;
}

function esEntradaDuplicada(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}

/** Dueño de `incidentes_uso`: el hecho, de solo inserción (nunca se edita ni se borra). */
export class RepositorioDeIncidentes extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'incidentes_uso',
      columnas: [
        'usuario_id',
        'tipo',
        'gravedad',
        'origen',
        'registrado_por',
        'descripcion',
        'evidencia',
        'clave_unica',
        'ocurrido_at',
      ],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  /** Inserta el incidente; devuelve su id, o `null` si su `claveUnica` ya existía (el sistema no lo repite). */
  async crear(tx: Transaccion, incidente: NuevoIncidente): Promise<string | null> {
    try {
      return await this.insertar(tx, {
        usuario_id: incidente.usuarioId,
        tipo: incidente.tipo,
        gravedad: incidente.gravedad,
        origen: incidente.origen,
        registrado_por: incidente.registradoPor,
        descripcion: incidente.descripcion,
        evidencia: JSON.stringify(incidente.evidencia),
        clave_unica: incidente.claveUnica,
        ocurrido_at: incidente.ocurridoAt,
      });
    } catch (error) {
      if (incidente.claveUnica !== null && esEntradaDuplicada(error)) return null;
      throw error;
    }
  }

  /** ¿Ya existe un incidente con esa clave de idempotencia en la cuenta del contexto? */
  async existeClave(claveUnica: string): Promise<boolean> {
    return (await this.contar({ donde: 't.clave_unica = ?', params: [claveUnica] })) > 0;
  }

  buscarPorId(id: string, tx?: Transaccion): Promise<IncidenteFila | null> {
    return this.seleccionarUna<IncidenteFila>(
      { columnas: COLUMNAS, uniones: UNION_RESOLUCION, donde: 't.id = ?', params: [id] },
      tx,
    );
  }

  /**
   * Bloquea TODOS los incidentes del usuario hasta que termine `tx`. Quien resuelve uno lo llama antes de leer nada
   * más: dos resoluciones del mismo usuario a la vez (del mismo incidente o de dos distintos) se serializan, así la
   * segunda cuenta los confirmados incluyendo la primera y la reincidencia no se pierde por una carrera. Es una
   * lectura bloqueante (no fija la «foto» de la transacción): lo que se lea después ve lo ya confirmado.
   */
  async bloquearDelUsuario(tx: Transaccion, usuarioId: string): Promise<void> {
    await this.seleccionar<RowDataPacket>(
      { columnas: 't.id', donde: 't.usuario_id = ?', params: [usuarioId], bloquear: true },
      tx,
    );
  }

  listar(
    filtro: FiltroDeIncidentes,
    limite: number,
    desplazamiento: number,
  ): Promise<IncidenteFila[]> {
    const { donde, params } = armarFiltro(filtro);
    return this.seleccionar<IncidenteFila>({
      columnas: COLUMNAS,
      uniones: UNION_RESOLUCION,
      ...(donde === undefined ? {} : { donde }),
      params,
      orden: 't.ocurrido_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contarFiltrados(filtro: FiltroDeIncidentes): Promise<number> {
    const { donde, params } = armarFiltro(filtro);
    return this.contar({
      uniones: UNION_RESOLUCION,
      ...(donde === undefined ? {} : { donde }),
      params,
    });
  }

  /** Cuántos incidentes registró una PERSONA sobre el usuario desde `desde` (para el tope diario). */
  contarRegistradosPorPersonasDesde(
    usuarioId: string,
    desde: Date,
    tx: Transaccion,
  ): Promise<number> {
    return this.contar(
      {
        donde: "t.usuario_id = ? AND t.origen = 'persona' AND t.created_at >= ?",
        params: [usuarioId, desde],
      },
      tx,
    );
  }

  /**
   * Los incidentes del usuario CONFIRMADOS (su última resolución lo dice) que ocurrieron desde `desde`: cuántos son
   * (el conteo de la reincidencia: los pendientes y los descartados no cuentan) y si TODOS los registró una misma
   * persona. Los del sistema (`registrado_por` nulo) no son de ninguna persona.
   */
  async resumirConfirmados(
    usuarioId: string,
    desde: Date,
    tx: Transaccion,
  ): Promise<{ total: number; deUnaSolaPersona: boolean }> {
    const fila = await this.seleccionarUna<ResumenDeConfirmadosFila>(
      {
        columnas:
          'COUNT(*) AS total, COUNT(DISTINCT t.registrado_por) AS personas, ' +
          'COALESCE(SUM(t.registrado_por IS NULL), 0) AS del_sistema',
        uniones: UNION_RESOLUCION,
        donde: "t.usuario_id = ? AND t.ocurrido_at >= ? AND r.resultado = 'confirmado'",
        params: [usuarioId, desde],
      },
      tx,
    );
    const total = Number(fila?.total ?? 0);
    return {
      total,
      deUnaSolaPersona:
        total > 0 && Number(fila?.del_sistema ?? 0) === 0 && Number(fila?.personas ?? 0) === 1,
    };
  }
}

interface ResumenDeConfirmadosFila extends RowDataPacket {
  total: string | number;
  personas: string | number;
  del_sistema: string | number | null;
}

export interface ResolucionFila extends RowDataPacket {
  id: string;
  incidente_id: string;
  resultado: ResultadoDeResolucion;
  motivo: string | null;
  resuelto_por: string;
  resuelta_at: Date;
}

/** Dueño de `resoluciones_de_incidente`: cada decisión es una fila nueva (de solo inserción). */
export class RepositorioDeResoluciones extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'resoluciones_de_incidente',
      columnas: ['incidente_id', 'resultado', 'motivo', 'resuelto_por', 'resuelta_at'],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  registrar(
    tx: Transaccion,
    resolucion: {
      readonly incidenteId: string;
      readonly resultado: ResultadoDeResolucion;
      readonly motivo: string | null;
      readonly resueltoPor: string;
      readonly resueltaAt: Date;
    },
  ): Promise<string> {
    return this.insertar(tx, {
      incidente_id: resolucion.incidenteId,
      resultado: resolucion.resultado,
      motivo: resolucion.motivo,
      resuelto_por: resolucion.resueltoPor,
      resuelta_at: resolucion.resueltaAt,
    });
  }

  /** La última decisión sobre el incidente dentro de `tx`, o `null` si no hay. */
  ultima(incidenteId: string, tx: Transaccion): Promise<ResolucionFila | null> {
    return this.seleccionarUna<ResolucionFila>(
      {
        columnas: 't.id, t.incidente_id, t.resultado, t.motivo, t.resuelto_por, t.resuelta_at',
        donde: 't.incidente_id = ?',
        params: [incidenteId],
        orden: 't.id DESC',
      },
      tx,
    );
  }

  /** Todas las decisiones sobre el incidente, de la primera a la última. */
  historial(incidenteId: string): Promise<ResolucionFila[]> {
    return this.seleccionar<ResolucionFila>({
      columnas: 't.id, t.incidente_id, t.resultado, t.motivo, t.resuelto_por, t.resuelta_at',
      donde: 't.incidente_id = ?',
      params: [incidenteId],
      orden: 't.id',
    });
  }
}

export interface IncidenteDeTodasFila extends IncidenteFila {
  tenant_id: string;
}

export interface FiltroDeSenales {
  readonly cuentaId: string | null;
  readonly usuarioId: string | null;
  readonly tipo: TipoDeIncidente | null;
  readonly gravedad: Gravedad | null;
  /** `abiertas` = sin resolver o pendientes (nadie decidió todavía). */
  readonly estado: EstadoDeIncidente | 'abiertas' | null;
  readonly desde: Date | null;
  readonly hasta: Date | null;
}

function armarFiltroDeSenales(filtro: FiltroDeSenales): { donde: string; params: unknown[] } {
  // Solo los que abrió el sistema: son las señales de abuso. Los que registra una persona se ven por cuenta.
  const condiciones: string[] = ["t.origen = 'sistema'"];
  const params: unknown[] = [];
  if (filtro.cuentaId !== null) {
    condiciones.push('t.tenant_id = ?');
    params.push(filtro.cuentaId);
  }
  if (filtro.usuarioId !== null) {
    condiciones.push('t.usuario_id = ?');
    params.push(filtro.usuarioId);
  }
  if (filtro.tipo !== null) {
    condiciones.push('t.tipo = ?');
    params.push(filtro.tipo);
  }
  if (filtro.gravedad !== null) {
    condiciones.push('t.gravedad = ?');
    params.push(filtro.gravedad);
  }
  if (filtro.estado === 'abiertas') {
    condiciones.push("(r.id IS NULL OR r.resultado = 'pendiente')");
  } else if (filtro.estado === 'sin_resolver') {
    condiciones.push('r.id IS NULL');
  } else if (filtro.estado !== null) {
    condiciones.push('r.resultado = ?');
    params.push(filtro.estado);
  }
  if (filtro.desde !== null) {
    condiciones.push('t.ocurrido_at >= ?');
    params.push(filtro.desde);
  }
  if (filtro.hasta !== null) {
    condiciones.push('t.ocurrido_at < ?');
    params.push(filtro.hasta);
  }
  return { donde: condiciones.join(' AND '), params };
}

interface ResumenPorTipoFila extends RowDataPacket {
  tipo: TipoDeIncidente;
  total: number | string;
  abiertas: number | string;
  altas: number | string;
}

interface ResumenPorCuentaFila extends RowDataPacket {
  tenant_id: string;
  total: number | string;
  abiertas: number | string;
  altas: number | string;
}

/**
 * Lee `incidentes_uso` de TODAS las cuentas, solo para la vista de AGROCOM (ADR 0030 §5, ola W12): salto EXPLÍCITO del
 * aislamiento, de solo lectura (el incidente es un hecho de solo inserción). Nunca escribe.
 */
export class RepositorioDeIncidentesDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'incidentes_uso',
      columnas: [],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  listarSenales(
    filtro: FiltroDeSenales,
    limite: number,
    desplazamiento: number,
  ): Promise<IncidenteDeTodasFila[]> {
    const { donde, params } = armarFiltroDeSenales(filtro);
    return this.seleccionar<IncidenteDeTodasFila>({
      columnas: 't.tenant_id, ' + COLUMNAS,
      uniones: UNION_RESOLUCION,
      donde,
      params,
      orden: 't.ocurrido_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contarSenales(filtro: FiltroDeSenales): Promise<number> {
    const { donde, params } = armarFiltroDeSenales(filtro);
    return this.contar({ uniones: UNION_RESOLUCION, donde, params });
  }

  /** Cuántas señales hubo de cada tipo en la ventana, y cuántas siguen abiertas o son de gravedad alta. */
  resumenPorTipo(desde: Date, hasta: Date): Promise<ResumenPorTipoFila[]> {
    return this.seleccionar<ResumenPorTipoFila>({
      columnas:
        "t.tipo, COUNT(*) AS total, SUM(r.id IS NULL OR r.resultado = 'pendiente') AS abiertas, " +
        "SUM(t.gravedad = 'alta') AS altas",
      uniones: UNION_RESOLUCION,
      donde: "t.origen = 'sistema' AND t.ocurrido_at >= ? AND t.ocurrido_at < ?",
      params: [desde, hasta],
      agrupar: 't.tipo',
      orden: 'total DESC, t.tipo',
    });
  }

  /** Las cuentas con más señales en la ventana, de mayor a menor (las `limite` primeras). */
  resumenPorCuenta(desde: Date, hasta: Date, limite: number): Promise<ResumenPorCuentaFila[]> {
    return this.seleccionar<ResumenPorCuentaFila>({
      columnas:
        "t.tenant_id, COUNT(*) AS total, SUM(r.id IS NULL OR r.resultado = 'pendiente') AS abiertas, " +
        "SUM(t.gravedad = 'alta') AS altas",
      uniones: UNION_RESOLUCION,
      donde: "t.origen = 'sistema' AND t.ocurrido_at >= ? AND t.ocurrido_at < ?",
      params: [desde, hasta],
      agrupar: 't.tenant_id',
      orden: 'altas DESC, total DESC, t.tenant_id',
      limite,
    });
  }
}
