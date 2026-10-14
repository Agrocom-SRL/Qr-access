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

  contarVivos(placaId: string): Promise<number> {
    return this.contar({ donde: 't.placa_id = ? AND t.descartada_at IS NULL', params: [placaId] });
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
