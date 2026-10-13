import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

const DESCRIPCION_DE_DISPOSITIVOS = {
  nombre: 'dispositivos',
  columnas: [
    'puerta_id',
    'nombre',
    'clave_hash',
    'firmware_version',
    'ultimo_latido_at',
    'ultimo_rssi',
    'ultima_puerta_abierta',
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

  /** Solo uno en servicio: no revocado, no dado de baja y activo. */
  buscarEnServicio(id: string): Promise<DispositivoParaAutenticar | null> {
    return this.seleccionarUna<DispositivoParaAutenticar>({
      columnas: 't.id, t.tenant_id, t.puerta_id, t.clave_hash',
      donde: 't.id = ? AND t.revocado_at IS NULL AND t.activo = 1',
      params: [id],
    });
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
      },
      { sinBitacora: true },
    );
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
