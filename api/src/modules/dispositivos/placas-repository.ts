import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import { LATIDO_MAXIMO_SEGUNDOS } from './domain/en-linea.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

const DESCRIPCION_DE_PLACAS = {
  nombre: 'placas',
  columnas: [
    'mac',
    'firmware_version',
    'ultimo_anuncio_at',
    'ultima_ip',
    'por_confirmar_hasta',
    'vinculo_cuenta_id',
    'vinculo_puerta_id',
    'vinculo_nombre',
    'vinculo_solicitado_por',
  ],
  perfil: 'dominio',
  deCuenta: false,
} as const;

/** Lo que hace falta de una placa para anunciarla, solicitar su vínculo o confirmarlo. */
export interface PlacaBasica extends RowDataPacket {
  id: string;
  por_confirmar_hasta: Date | null;
  vinculo_cuenta_id: string | null;
  vinculo_puerta_id: string | null;
  vinculo_nombre: string | null;
  vinculo_solicitado_por: string | null;
}

/** Estado derivado de una placa (ADR 0026). */
export type EstadoDePlaca = 'detectada' | 'por_confirmar' | 'vinculada';

export interface FiltrosDePlacas {
  busqueda?: string | undefined;
  estado?: EstadoDePlaca | undefined;
  conexion?: 'en_linea' | 'sin_conexion' | undefined;
}

export interface PlacaListada extends RowDataPacket {
  id: string;
  mac: string;
  firmware_version: string | null;
  ultimo_anuncio_at: Date | null;
  por_confirmar_hasta: Date | null;
  ultima_ip: string | null;
  dispositivo_id: string | null;
  dispositivo_nombre: string | null;
  ultimo_latido_at: Date | null;
  firmware_del_dispositivo: string | null;
  en_linea_desde: Date | null;
  estado_conexion: 'en_linea' | 'sin_conexion' | 'caida_sostenida' | 'desaparecida' | null;
  lector_responde: number | null;
  en_observacion: number | null;
  puerta_id: string | null;
  puerta_nombre: string | null;
  cuenta_id: string | null;
  cuenta_codigo: string | null;
  cuenta_nombre: string | null;
}

const COLUMNAS_BASICAS =
  't.id, t.por_confirmar_hasta, t.vinculo_cuenta_id, t.vinculo_puerta_id, ' +
  't.vinculo_nombre, t.vinculo_solicitado_por';

/** Quién tiene hoy la placa: el dispositivo en servicio y su cuenta y puerta. */
const UNIONES_DE_ASIGNACION =
  'LEFT JOIN dispositivos AS d ON d.placa_id = t.id AND d.deleted_at IS NULL AND d.revocado_at IS NULL ' +
  'LEFT JOIN puertas AS p ON p.id = d.puerta_id AND p.tenant_id = d.tenant_id ' +
  'LEFT JOIN cuentas AS c ON c.id = d.tenant_id';

/**
 * Dueño de `placas` (ADR 0025). La tabla es de la plataforma y no lleva `tenant_id`: ningún
 * repositorio de cuenta la ve, y esta clase solo la alcanzan acciones de plataforma o el
 * anuncio de la propia placa. Las uniones a `dispositivos` son lectura para el inventario.
 */
export class RepositorioDePlacas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_PLACAS);
  }

  buscarPorMac(mac: string): Promise<PlacaBasica | null> {
    return this.seleccionarUna<PlacaBasica>({
      columnas: COLUMNAS_BASICAS,
      donde: 't.mac = ?',
      params: [mac],
    });
  }

  /** Para solicitar, cancelar o confirmar un vínculo: bloquea la fila hasta cerrar la transacción. */
  buscarPorId(id: string, tx: Transaccion): Promise<PlacaBasica | null> {
    return this.seleccionarUna<PlacaBasica>(
      { columnas: COLUMNAS_BASICAS, donde: 't.id = ?', params: [id], bloquear: true },
      tx,
    );
  }

  /** Una placa nueva que se anuncia sola. Anónimo: sin autoría y sin datos de ninguna cuenta. */
  crear(
    tx: Transaccion,
    datos: { mac: string; firmware: string; ip: string; en: Date },
  ): Promise<string> {
    return this.insertar(tx, {
      mac: datos.mac,
      firmware_version: datos.firmware,
      ultima_ip: datos.ip,
      ultimo_anuncio_at: datos.en,
    });
  }

  /** Telemetría de cada anuncio (cada 30 s): no es un cambio relevante, va sin bitácora. */
  registrarAnuncio(
    tx: Transaccion,
    id: string,
    datos: { firmware: string; ip: string; en: Date },
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { firmware_version: datos.firmware, ultima_ip: datos.ip, ultimo_anuncio_at: datos.en },
      { sinBitacora: true },
    );
  }

  /** El super admin pidió vincular: queda a la espera del pulsador (ADR 0026 §3). */
  solicitarVinculo(
    tx: Transaccion,
    id: string,
    datos: {
      hasta: Date;
      cuentaId: string;
      puertaId: string;
      nombre: string;
      solicitadoPor: string;
    },
  ): Promise<boolean> {
    return this.actualizar(tx, id, {
      por_confirmar_hasta: datos.hasta,
      vinculo_cuenta_id: datos.cuentaId,
      vinculo_puerta_id: datos.puertaId,
      vinculo_nombre: datos.nombre,
      vinculo_solicitado_por: datos.solicitadoPor,
    });
  }

  /** Cancela o consume la solicitud de vínculo. */
  limpiarSolicitud(tx: Transaccion, id: string): Promise<boolean> {
    return this.actualizar(tx, id, {
      por_confirmar_hasta: null,
      vinculo_cuenta_id: null,
      vinculo_puerta_id: null,
      vinculo_nombre: null,
      vinculo_solicitado_por: null,
    });
  }

  darDeBaja(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }

  /**
   * Da de baja (soft delete) las placas sin dispositivo en servicio que no se anuncian desde
   * `antes`: la limpieza del inventario que llena el anuncio anónimo (ADR 0026 §6).
   */
  async depurarSinContacto(antes: Date, ahora: Date): Promise<number> {
    const [resultado] = await this.pool.query<ResultSetHeader>(
      'UPDATE placas AS t SET t.deleted_at = ? ' +
        'WHERE t.deleted_at IS NULL AND COALESCE(t.ultimo_anuncio_at, t.created_at) < ? ' +
        'AND NOT EXISTS (SELECT 1 FROM dispositivos AS d WHERE d.placa_id = t.id ' +
        'AND d.deleted_at IS NULL AND d.revocado_at IS NULL)',
      [ahora, antes],
    );
    return resultado.affectedRows;
  }

  async listar(
    filtros: FiltrosDePlacas,
    ahora: Date,
    limite: number,
    desplazamiento: number,
  ): Promise<{ filas: PlacaListada[]; total: number }> {
    const donde: string[] = [];
    const params: unknown[] = [];
    if (filtros.busqueda !== undefined) {
      donde.push('(t.mac LIKE ? OR c.codigo LIKE ? OR c.nombre LIKE ? OR d.nombre LIKE ?)');
      const patron = `%${filtros.busqueda}%`;
      params.push(patron, patron, patron, patron);
    }
    if (filtros.estado === 'vinculada') donde.push('d.id IS NOT NULL');
    if (filtros.estado === 'por_confirmar') {
      donde.push('d.id IS NULL AND t.por_confirmar_hasta > ?');
      params.push(ahora);
    }
    if (filtros.estado === 'detectada') {
      donde.push('d.id IS NULL AND (t.por_confirmar_hasta IS NULL OR t.por_confirmar_hasta <= ?)');
      params.push(ahora);
    }
    if (filtros.conexion !== undefined) {
      // Mismo criterio que `estaEnLinea`: el último contacto es el latido si está vinculada y el anuncio si no.
      const contacto = 'IF(d.id IS NOT NULL, d.ultimo_latido_at, t.ultimo_anuncio_at)';
      const limite = new Date(ahora.getTime() - LATIDO_MAXIMO_SEGUNDOS * 1000);
      donde.push(
        filtros.conexion === 'en_linea'
          ? `${contacto} >= ?`
          : `(${contacto} IS NULL OR ${contacto} < ?)`,
      );
      params.push(limite);
    }
    const consulta = {
      uniones: UNIONES_DE_ASIGNACION,
      ...(donde.length > 0 ? { donde: donde.join(' AND '), params } : {}),
    };
    const [filas, total] = await Promise.all([
      this.seleccionar<PlacaListada>({
        ...consulta,
        columnas:
          't.id, t.mac, t.firmware_version, t.ultimo_anuncio_at, t.por_confirmar_hasta, t.ultima_ip, ' +
          'd.id AS dispositivo_id, d.nombre AS dispositivo_nombre, d.ultimo_latido_at, ' +
          'd.firmware_version AS firmware_del_dispositivo, ' +
          'd.en_linea_desde, d.estado_conexion, d.lector_responde, d.en_observacion, ' +
          'p.id AS puerta_id, p.nombre AS puerta_nombre, ' +
          'c.id AS cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre',
        orden: 't.id DESC',
        limite,
        desplazamiento,
      }),
      this.contar(consulta),
    ]);
    return { filas, total };
  }
}
