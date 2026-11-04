import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

const DESCRIPCION_DE_ANUNCIOS = {
  nombre: 'placas_anuncios',
  columnas: [
    'placa_id',
    'clave_huella',
    'firmware_version',
    'ip',
    'ultimo_anuncio_at',
    'descartada_at',
  ],
  perfil: 'transitoria',
  deCuenta: false,
} as const;

/** Un máximo de candidatos vivos por placa: la MAC es pública y el anuncio es anónimo. */
export const MAXIMO_DE_CANDIDATOS = 5;

export interface Candidato extends RowDataPacket {
  id: string;
  descartada_at: Date | null;
}

export interface CandidatoActivo extends RowDataPacket {
  clave_huella: string;
  /** Cuándo se anunció por primera vez esa clave. */
  created_at: Date;
}

/**
 * Los `(mac, clave)` que se anuncian (ADR 0026). Tabla transitoria de plataforma, sin
 * `tenant_id`: solo la tocan las acciones de anuncio y confirmación de la propia placa.
 */
export class RepositorioDeAnuncios extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_ANUNCIOS);
  }

  buscar(
    placaId: string,
    huella: string,
    ejecutor: Pool | Transaccion = this.pool,
  ): Promise<Candidato | null> {
    return this.seleccionarUna<Candidato>(
      {
        columnas: 't.id, t.descartada_at',
        donde: 't.placa_id = ? AND t.clave_huella = ?',
        params: [placaId, huella],
      },
      ejecutor,
    );
  }

  /**
   * Los candidatos vivos que se anunciaron desde `desde`. Un anuncio falso de una sola vez deja de
   * contar pronto; la placa real, que repite el suyo cada 30 s, no (ADR 0037).
   */
  contarActivos(placaId: string, desde: Date): Promise<number> {
    return this.contar({
      donde: 't.placa_id = ? AND t.descartada_at IS NULL AND t.ultimo_anuncio_at >= ?',
      params: [placaId, desde],
    });
  }

  /**
   * Los candidatos vivos que se anunciaron desde `desde`, con su huella y su primer anuncio. Con
   * `bloquear` (dentro de una transacción) la lectura toma las filas, de modo que nadie inserte otro
   * candidato entre contar y crear el dispositivo (ADR 0037).
   */
  async activos(
    placaId: string,
    desde: Date,
    ejecutor: Pool | Transaccion = this.pool,
    bloquear = false,
  ): Promise<CandidatoActivo[]> {
    const [filas] = bloquear
      ? await ejecutor.query<CandidatoActivo[]>(
          'SELECT clave_huella, created_at FROM placas_anuncios WHERE placa_id = ? AND descartada_at IS NULL AND ultimo_anuncio_at >= ? FOR UPDATE',
          [placaId, desde],
        )
      : await ejecutor.query<CandidatoActivo[]>(
          'SELECT clave_huella, created_at FROM placas_anuncios WHERE placa_id = ? AND descartada_at IS NULL AND ultimo_anuncio_at >= ?',
          [placaId, desde],
        );
    return filas;
  }

  crear(
    tx: Transaccion,
    datos: { placaId: string; huella: string; firmware: string; ip: string; en: Date },
  ): Promise<string> {
    return this.insertar(tx, {
      placa_id: datos.placaId,
      clave_huella: datos.huella,
      firmware_version: datos.firmware,
      ip: datos.ip,
      ultimo_anuncio_at: datos.en,
    });
  }

  tocar(
    tx: Transaccion,
    id: string,
    datos: { firmware: string; ip: string; en: Date },
  ): Promise<boolean> {
    return this.actualizar(tx, id, {
      firmware_version: datos.firmware,
      ip: datos.ip,
      ultimo_anuncio_at: datos.en,
    });
  }

  /** Al confirmar uno, los demás candidatos de la placa (el falso y los viejos) quedan sin efecto. */
  async descartarTodos(tx: Transaccion, placaId: string, ahora: Date): Promise<void> {
    await tx.query(
      'UPDATE placas_anuncios SET descartada_at = ? WHERE placa_id = ? AND descartada_at IS NULL',
      [ahora, placaId],
    );
  }
}
