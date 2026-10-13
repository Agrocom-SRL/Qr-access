import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

const DESCRIPCION_DE_PLACAS = {
  nombre: 'placas',
  columnas: [
    'mac',
    'codigo_hash',
    'clave_hash',
    'firmware_version',
    'ultimo_reclamo_at',
    'ultima_ip',
  ],
  sensibles: ['codigo_hash', 'clave_hash'],
  perfil: 'dominio',
  deCuenta: false,
} as const;

export interface PlacaParaReclamar extends RowDataPacket {
  id: string;
  codigo_hash: string;
  clave_hash: string | null;
}

export interface PlacaListada extends RowDataPacket {
  id: string;
  mac: string;
  firmware_version: string | null;
  ultimo_reclamo_at: Date | null;
  ultima_ip: string | null;
  dispositivo_id: string | null;
  dispositivo_nombre: string | null;
  ultimo_latido_at: Date | null;
  firmware_del_dispositivo: string | null;
  puerta_id: string | null;
  puerta_nombre: string | null;
  cuenta_id: string | null;
  cuenta_codigo: string | null;
  cuenta_nombre: string | null;
}

/** Quién tiene hoy la placa: el dispositivo en servicio y su cuenta y puerta. */
const UNIONES_DE_ASIGNACION =
  'LEFT JOIN dispositivos AS d ON d.placa_id = t.id AND d.deleted_at IS NULL AND d.revocado_at IS NULL ' +
  'LEFT JOIN puertas AS p ON p.id = d.puerta_id AND p.tenant_id = d.tenant_id ' +
  'LEFT JOIN cuentas AS c ON c.id = d.tenant_id';

/**
 * Dueño de `placas` (ADR 0025). La tabla es de la plataforma y no lleva `tenant_id`: ningún
 * repositorio de cuenta la ve, y esta clase solo la alcanzan acciones de plataforma o el
 * reclamo de la propia placa. Las uniones a `dispositivos` son lectura para el inventario.
 */
export class RepositorioDePlacas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_PLACAS);
  }

  buscarPorMac(mac: string): Promise<PlacaParaReclamar | null> {
    return this.seleccionarUna<PlacaParaReclamar>({
      columnas: 't.id, t.codigo_hash, t.clave_hash',
      donde: 't.mac = ?',
      params: [mac],
    });
  }

  /** Para vincular o liberar: bloquea la fila hasta cerrar la transacción. */
  buscarPorId(id: string, tx: Transaccion): Promise<PlacaParaReclamar | null> {
    return this.seleccionarUna<PlacaParaReclamar>(
      {
        columnas: 't.id, t.codigo_hash, t.clave_hash',
        donde: 't.id = ?',
        params: [id],
        bloquear: true,
      },
      tx,
    );
  }

  crear(tx: Transaccion, mac: string, codigoHash: string): Promise<string> {
    return this.insertar(tx, { mac, codigo_hash: codigoHash });
  }

  /**
   * Telemetría del reclamo (y, si cambió, la clave nueva de la placa). Sin bitácora: la placa
   * sondea cada 30 s y la clave es un secreto; el vínculo sí queda registrado al vincular.
   */
  registrarReclamo(
    tx: Transaccion,
    id: string,
    datos: { firmware: string; ip: string; en: Date; claveHash?: string },
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      {
        firmware_version: datos.firmware,
        ultima_ip: datos.ip,
        ultimo_reclamo_at: datos.en,
        ...(datos.claveHash === undefined ? {} : { clave_hash: datos.claveHash }),
      },
      { sinBitacora: true },
    );
  }

  /** Al liberar: la placa vuelve a empezar y sortea una clave nueva. */
  olvidarClave(tx: Transaccion, id: string): Promise<boolean> {
    return this.actualizar(tx, id, { clave_hash: null });
  }

  darDeBaja(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }

  async listar(
    filtros: { busqueda?: string | undefined; estado?: 'de_fabrica' | 'vinculada' | undefined },
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
    if (filtros.estado === 'de_fabrica') donde.push('d.id IS NULL');
    if (filtros.estado === 'vinculada') donde.push('d.id IS NOT NULL');
    const consulta = {
      uniones: UNIONES_DE_ASIGNACION,
      ...(donde.length > 0 ? { donde: donde.join(' AND '), params } : {}),
    };
    const [filas, total] = await Promise.all([
      this.seleccionar<PlacaListada>({
        ...consulta,
        columnas:
          't.id, t.mac, t.firmware_version, t.ultimo_reclamo_at, t.ultima_ip, ' +
          'd.id AS dispositivo_id, d.nombre AS dispositivo_nombre, d.ultimo_latido_at, ' +
          'd.firmware_version AS firmware_del_dispositivo, ' +
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
