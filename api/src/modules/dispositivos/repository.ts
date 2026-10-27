import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

const DESCRIPCION_DE_DISPOSITIVOS = {
  nombre: 'dispositivos',
  columnas: [
    'puerta_id',
    'placa_id',
    'nombre',
    'clave_hash',
    'firmware_version',
    'ultimo_latido_at',
    'ultimo_rssi',
    'ultima_puerta_abierta',
    'estado_conexion',
    'en_linea_desde',
    'lector_responde',
    'lector_cambio_at',
    'estado_lector',
    'en_observacion',
    'revocado_at',
    'activo',
  ],
  sensibles: ['clave_hash'],
  perfil: 'dominio',
  deCuenta: true,
} as const;

export interface DispositivoParaAutenticar extends RowDataPacket {
  id: string;
  tenant_id: string;
  puerta_id: string;
  clave_hash: string;
}

/**
 * Lectura de `dispositivos` SIN cuenta: la credencial `Dispositivo <id>.<clave>` llega antes
 * de saber a qué cuenta pertenece; de la fila sale la cuenta y la puerta (ADR 0004 §8).
 */
export class RepositorioDeDispositivosDePlataforma extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_DISPOSITIVOS);
  }

  /** Las cuentas (no eliminadas) con algún dispositivo que el detector de estados debe mirar. */
  async cuentasConDispositivosParaEvaluar(): Promise<
    { id: string; codigo: string; nombre: string }[]
  > {
    const filas = await this.seleccionar<RowDataPacket>({
      columnas: 'DISTINCT c.id, c.codigo, c.nombre',
      uniones: 'JOIN cuentas AS c ON c.id = t.tenant_id AND c.deleted_at IS NULL',
      donde:
        '(t.revocado_at IS NULL AND t.activo = 1) OR t.estado_conexion IS NOT NULL OR t.estado_lector IS NOT NULL OR t.en_observacion = 1',
      orden: 'c.id',
    });
    return filas.map((fila) => ({
      id: String(fila.id),
      codigo: String(fila.codigo),
      nombre: String(fila.nombre),
    }));
  }

  /** Solo uno en servicio: no revocado, no dado de baja y activo. */
  buscarEnServicio(id: string): Promise<DispositivoParaAutenticar | null> {
    return this.seleccionarUna<DispositivoParaAutenticar>({
      columnas: 't.id, t.tenant_id, t.puerta_id, t.clave_hash',
      donde: 't.id = ? AND t.revocado_at IS NULL AND t.activo = 1',
      params: [id],
    });
  }

  /** El dispositivo en servicio de una placa (a lo sumo uno, `uq_dispositivos_placa`). */
  async buscarEnServicioDePlaca(
    placaId: string,
  ): Promise<{ id: string; cuentaId: string; claveHash: string } | null> {
    const fila = await this.seleccionarUna<RowDataPacket>({
      columnas: 't.id, t.tenant_id, t.clave_hash',
      donde: 't.placa_id = ? AND t.revocado_at IS NULL',
      params: [placaId],
    });
    return fila === null
      ? null
      : {
          id: String(fila.id),
          cuentaId: String(fila.tenant_id),
          claveHash: String(fila.clave_hash),
        };
  }

  /**
   * Los dispositivos en servicio de TODAS las cuentas, para el tablero del super admin: salto
   * explícito del aislamiento, solo lectura. Los que el cliente desactivó (`activo = 0`) o
   * revocó no figuran: no se espera que reporten.
   */
  listarEnServicioDeTodas(): Promise<DispositivoDeCuentaFila[]> {
    return this.seleccionar<DispositivoDeCuentaFila>({
      columnas:
        't.id, t.nombre, t.ultimo_latido_at, t.firmware_version, p.nombre AS puerta_nombre, ' +
        'c.id AS cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre',
      uniones:
        'JOIN puertas AS p ON p.id = t.puerta_id AND p.tenant_id = t.tenant_id ' +
        'JOIN cuentas AS c ON c.id = t.tenant_id',
      donde: 't.revocado_at IS NULL AND t.activo = 1',
      orden: 'c.codigo, p.nombre',
    });
  }
}

export interface DispositivoDeCuentaFila extends RowDataPacket {
  id: string;
  nombre: string;
  ultimo_latido_at: Date | null;
  firmware_version: string | null;
  puerta_nombre: string;
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
}

export interface Latido {
  readonly firmware: string;
  readonly rssi: number;
  readonly puertaAbierta: boolean;
  readonly en: Date;
  /** Desde cuándo la racha de latidos es continua (lo calcula la acción con el latido anterior). */
  readonly enLineaDesde: Date;
  /** Lo que informa el lector QR; `undefined` = el firmware no lo informa y no se toca lo guardado. */
  readonly lector?: { readonly responde: boolean; readonly cambioAt: Date };
}

/** Lo que el latido anterior dejó, para saber si la racha sigue y si el lector cambió. */
export interface EstadoDeLatidoFila extends RowDataPacket {
  ultimo_latido_at: Date | null;
  en_linea_desde: Date | null;
  lector_responde: number | null;
}

/** Un dispositivo con todo lo que el detector de estados necesita. */
export interface DispositivoParaEvaluarFila extends RowDataPacket {
  id: string;
  puerta_id: string;
  created_at: Date;
  ultimo_latido_at: Date | null;
  en_linea_desde: Date | null;
  estado_conexion: 'en_linea' | 'sin_conexion' | 'caida_sostenida' | 'desaparecida' | null;
  lector_responde: number | null;
  lector_cambio_at: Date | null;
  estado_lector: 'responde' | 'sin_respuesta' | null;
  en_observacion: number;
  en_servicio: number;
}

/** El estado que el detector deja guardado; solo se escribe lo que cambió. */
export interface CambioDeEstadoDePlaca {
  readonly estadoConexion?: 'en_linea' | 'sin_conexion' | 'caida_sostenida' | 'desaparecida' | null;
  readonly estadoLector?: 'responde' | 'sin_respuesta' | null;
  readonly enObservacion?: boolean;
}

export interface PuertaConSitioFila extends RowDataPacket {
  puerta_id: string;
  puerta_nombre: string;
  sitio_id: string;
  sitio_nombre: string;
}

export interface DispositivoEnServicioFila extends RowDataPacket {
  id: string;
  puerta_id: string;
  nombre: string;
  ultimo_latido_at: Date | null;
}

/** Dueño de `dispositivos`. Con tenant: solo los de la cuenta del contexto. */
export class RepositorioDeDispositivos extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_DISPOSITIVOS);
  }

  /** Telemetría, no un cambio relevante: no llena la bitácora con un registro por latido. */
  registrarLatido(tx: Transaccion, id: string, latido: Latido): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      {
        firmware_version: latido.firmware,
        ultimo_latido_at: latido.en,
        ultimo_rssi: latido.rssi,
        ultima_puerta_abierta: latido.puertaAbierta ? 1 : 0,
        en_linea_desde: latido.enLineaDesde,
        ...(latido.lector === undefined
          ? {}
          : {
              lector_responde: latido.lector.responde ? 1 : 0,
              lector_cambio_at: latido.lector.cambioAt,
            }),
      },
      { sinBitacora: true },
    );
  }

  /** El latido anterior del dispositivo, bloqueado hasta que termine `tx` (dos latidos no se pisan). */
  leerEstadoDeLatido(tx: Transaccion, id: string): Promise<EstadoDeLatidoFila | null> {
    return this.seleccionarUna<EstadoDeLatidoFila>(
      {
        columnas: 't.ultimo_latido_at, t.en_linea_desde, t.lector_responde',
        donde: 't.id = ?',
        params: [id],
        bloquear: true,
      },
      tx,
    );
  }

  /**
   * Los dispositivos de la cuenta del contexto que el detector debe mirar, BLOQUEADOS hasta que termine `tx`
   * (dos pasadas simultáneas no encolan el mismo aviso): los que están en servicio y los que, ya fuera de
   * servicio, aún conservan un estado (para limpiarlo y cerrar su aviso).
   */
  listarParaEvaluar(tx: Transaccion): Promise<DispositivoParaEvaluarFila[]> {
    return this.seleccionar<DispositivoParaEvaluarFila>(
      {
        columnas:
          't.id, t.puerta_id, t.created_at, t.ultimo_latido_at, t.en_linea_desde, t.estado_conexion, ' +
          't.lector_responde, t.lector_cambio_at, t.estado_lector, t.en_observacion, ' +
          '(t.revocado_at IS NULL AND t.activo = 1) AS en_servicio',
        donde:
          '(t.revocado_at IS NULL AND t.activo = 1) OR t.estado_conexion IS NOT NULL OR t.estado_lector IS NOT NULL OR t.en_observacion = 1',
        orden: 't.id',
        bloquear: true,
      },
      tx,
    );
  }

  /** Guarda el estado derivado. Es telemetría calculada: no pasa por la bitácora (como el latido). */
  guardarEstado(tx: Transaccion, id: string, cambio: CambioDeEstadoDePlaca): Promise<boolean> {
    const cambios: Record<string, unknown> = {};
    if (cambio.estadoConexion !== undefined) cambios.estado_conexion = cambio.estadoConexion;
    if (cambio.estadoLector !== undefined) cambios.estado_lector = cambio.estadoLector;
    if (cambio.enObservacion !== undefined) cambios.en_observacion = cambio.enObservacion ? 1 : 0;
    if (Object.keys(cambios).length === 0) return Promise.resolve(true);
    return this.actualizar(tx, id, cambios, { sinBitacora: true });
  }

  /**
   * Nombre de la puerta y su sitio, para armar el aviso. Lectura de `puertas` y `sitios` de la MISMA cuenta
   * (la unión va por `tenant_id`); incluye los borrados, que pueden tener todavía un aviso abierto.
   */
  async puertasConSitio(puertaIds: readonly string[]): Promise<Map<string, PuertaConSitioFila>> {
    if (puertaIds.length === 0) return new Map();
    const filas = await this.seleccionar<PuertaConSitioFila>({
      columnas:
        'p.id AS puerta_id, p.nombre AS puerta_nombre, s.id AS sitio_id, s.nombre AS sitio_nombre',
      uniones:
        'JOIN puertas AS p ON p.id = t.puerta_id AND p.tenant_id = t.tenant_id ' +
        'JOIN sitios AS s ON s.id = p.sitio_id AND s.tenant_id = t.tenant_id',
      donde: 't.puerta_id IN (?)',
      params: [puertaIds],
      agrupar: 'p.id, p.nombre, s.id, s.nombre',
    });
    return new Map(filas.map((fila) => [fila.puerta_id, fila]));
  }

  /** Alta de un dispositivo para una placa (ADR 0025); la cuenta es la del contexto. */
  crearParaPlaca(
    tx: Transaccion,
    datos: { placaId: string; puertaId: string; nombre: string; claveHash: string },
  ): Promise<string> {
    return this.insertar(tx, {
      placa_id: datos.placaId,
      puerta_id: datos.puertaId,
      nombre: datos.nombre,
      clave_hash: datos.claveHash,
    });
  }

  /** Deja de autenticar: la placa recibe 401 y vuelve a anunciarse (ADR 0025). */
  revocar(tx: Transaccion, id: string, en: Date): Promise<boolean> {
    return this.actualizar(tx, id, { revocado_at: en });
  }

  /** Cuántos dispositivos en servicio tiene la cuenta del contexto (cupo del plan). */
  contarEnServicioDeLaCuenta(): Promise<number> {
    return this.contar({ donde: 't.revocado_at IS NULL' });
  }

  /** El dispositivo en servicio de cada una de esas puertas (a lo sumo uno por puerta). */
  listarEnServicioPorPuertas(puertaIds: readonly string[]): Promise<DispositivoEnServicioFila[]> {
    if (puertaIds.length === 0) return Promise.resolve([]);
    return this.seleccionar<DispositivoEnServicioFila>({
      columnas: 't.id, t.puerta_id, t.nombre, t.ultimo_latido_at',
      donde: 't.puerta_id IN (?) AND t.revocado_at IS NULL AND t.activo = 1',
      params: [puertaIds],
    });
  }

  /** Todos los dispositivos en servicio de la cuenta del contexto (para contar cuántos están sin conexión). */
  listarEnServicio(): Promise<DispositivoEnServicioFila[]> {
    return this.seleccionar<DispositivoEnServicioFila>({
      columnas: 't.id, t.puerta_id, t.nombre, t.ultimo_latido_at',
      donde: 't.revocado_at IS NULL AND t.activo = 1',
    });
  }
}
