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
}

export interface Latido {
  readonly firmware: string;
  readonly rssi: number;
  readonly puertaAbierta: boolean;
  readonly en: Date;
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
}
