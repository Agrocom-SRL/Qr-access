import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import { RepositorioDeConfirmacionesDeTodas } from './repository.js';

/** Las cuentas y los nombres que muestra el panel junto a cada cifra. */
const UNIONES_DE_PUERTA =
  'JOIN cuentas AS c ON c.id = t.tenant_id ' +
  'JOIN puertas AS p ON p.id = t.puerta_id AND p.tenant_id = t.tenant_id ' +
  'JOIN sitios AS s ON s.id = p.sitio_id AND s.tenant_id = t.tenant_id';

/** Solo las aperturas manuales (ADR 0035) dentro de la ventana `[desde, hasta)`. */
const MANUALES_EN_VENTANA = "t.metodo = 'manual' AND t.ocurrido_at >= ? AND t.ocurrido_at < ?";

interface TotalesFila extends RowDataPacket {
  ordenadas: number | string;
  rechazadas: number | string;
  qr: number | string;
  usuarios: number | string;
  cuentas: number | string;
}

interface PorPuertaFila extends RowDataPacket {
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  puerta_id: string;
  puerta_nombre: string;
  sitio_nombre: string;
  total: number | string;
  rechazadas: number | string;
}

interface PorCuentaFila extends RowDataPacket {
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  total: number | string;
  rechazadas: number | string;
  usuarios: number | string;
}

interface PorDiaFila extends RowDataPacket {
  dia: string;
  ordenadas: number | string;
  rechazadas: number | string;
}

interface PorHoraFila extends RowDataPacket {
  hora: number | string;
  total: number | string;
}

interface ConfiguracionFila extends RowDataPacket {
  puertas: number | string;
  habilitadas: number | string;
  disponibles: number | string;
  cuentas: number | string;
  cuentas_activas: number | string;
}

/**
 * Las aperturas manuales de TODAS las cuentas, para las estadísticas del panel de plataforma. Salto EXPLÍCITO del
 * aislamiento: solo lee totales agregados (nunca filas de una cuenta ni escribe; `lecturas` es de solo inserción).
 */
class RepositorioDeAperturasManualesDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, { nombre: 'lecturas', columnas: [], perfil: 'solo_insercion', deCuenta: true });
  }

  totales(desde: Date, hasta: Date): Promise<TotalesFila[]> {
    return this.seleccionar<TotalesFila>({
      columnas:
        "COALESCE(SUM(t.metodo = 'manual' AND t.resultado = 'permitido'), 0) AS ordenadas, " +
        "COALESCE(SUM(t.metodo = 'manual' AND t.resultado = 'rechazado'), 0) AS rechazadas, " +
        "COALESCE(SUM(t.metodo = 'qr' AND t.resultado = 'permitido' AND t.repetido_de_id IS NULL), 0) AS qr, " +
        "COUNT(DISTINCT CASE WHEN t.metodo = 'manual' THEN t.usuario_id END) AS usuarios, " +
        "COUNT(DISTINCT CASE WHEN t.metodo = 'manual' THEN t.tenant_id END) AS cuentas",
      donde: 't.ocurrido_at >= ? AND t.ocurrido_at < ?',
      params: [desde, hasta],
    });
  }

  porPuerta(desde: Date, hasta: Date, limite: number): Promise<PorPuertaFila[]> {
    return this.seleccionar<PorPuertaFila>({
      columnas:
        'c.id AS cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre, ' +
        'p.id AS puerta_id, p.nombre AS puerta_nombre, s.nombre AS sitio_nombre, ' +
        "COUNT(*) AS total, SUM(t.resultado = 'rechazado') AS rechazadas",
      uniones: UNIONES_DE_PUERTA,
      donde: MANUALES_EN_VENTANA,
      params: [desde, hasta],
      agrupar: 'c.id, c.codigo, c.nombre, p.id, p.nombre, s.nombre',
      orden: 'total DESC, p.id',
      limite,
    });
  }

  porCuenta(desde: Date, hasta: Date, limite: number): Promise<PorCuentaFila[]> {
    return this.seleccionar<PorCuentaFila>({
      columnas:
        'c.id AS cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre, ' +
        "COUNT(*) AS total, SUM(t.resultado = 'rechazado') AS rechazadas, " +
        'COUNT(DISTINCT t.usuario_id) AS usuarios',
      uniones: 'JOIN cuentas AS c ON c.id = t.tenant_id',
      donde: MANUALES_EN_VENTANA,
      params: [desde, hasta],
      agrupar: 'c.id, c.codigo, c.nombre',
      orden: 'total DESC, c.id',
      limite,
    });
  }

  porDia(desde: Date, hasta: Date, desfaseUtc: string): Promise<PorDiaFila[]> {
    return this.seleccionar<PorDiaFila>({
      columnas:
        "DATE_FORMAT(CONVERT_TZ(t.ocurrido_at, '+00:00', ?), '%Y-%m-%d') AS dia, " +
        "SUM(t.resultado = 'permitido') AS ordenadas, SUM(t.resultado = 'rechazado') AS rechazadas",
      donde: MANUALES_EN_VENTANA,
      params: [desfaseUtc, desde, hasta],
      agrupar: 'dia',
      orden: 'dia',
    });
  }

  porHora(desde: Date, hasta: Date, desfaseUtc: string): Promise<PorHoraFila[]> {
    return this.seleccionar<PorHoraFila>({
      columnas: "HOUR(CONVERT_TZ(t.ocurrido_at, '+00:00', ?)) AS hora, COUNT(*) AS total",
      donde: MANUALES_EN_VENTANA,
      params: [desfaseUtc, desde, hasta],
      agrupar: 'hora',
      orden: 'hora',
    });
  }
}

/** Cuántas puertas y cuentas tienen la apertura manual encendida y con placa (lee `puertas`, solo totales). */
class RepositorioDeConfiguracionManualDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, { nombre: 'puertas', columnas: [], perfil: 'dominio', deCuenta: true });
  }

  configuracion(): Promise<ConfiguracionFila[]> {
    const conPlaca =
      'EXISTS (SELECT 1 FROM dispositivos AS d WHERE d.puerta_id = t.id AND d.tenant_id = t.tenant_id AND d.en_servicio = 1)';
    return this.seleccionar<ConfiguracionFila>({
      columnas:
        'COUNT(*) AS puertas, ' +
        'COALESCE(SUM(t.apertura_manual = 1), 0) AS habilitadas, ' +
        `COALESCE(SUM(t.apertura_manual = 1 AND ${conPlaca}), 0) AS disponibles, ` +
        'COUNT(DISTINCT t.tenant_id) AS cuentas, ' +
        `COUNT(DISTINCT CASE WHEN t.apertura_manual = 1 AND ${conPlaca} THEN t.tenant_id END) AS cuentas_activas`,
      donde: 't.activo = 1',
    });
  }
}

export interface CuentaDeEstadistica {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
}

/** Cómo se usó la apertura manual en una ventana de tiempo, para el panel de AGROCOM (ADR 0035). */
export interface EstadisticasDeAperturaManual {
  readonly ordenadas: number;
  readonly rechazadas: number;
  /** Aperturas por QR permitidas en la misma ventana, para comparar el peso de cada camino. */
  readonly porQr: number;
  readonly usuarios: number;
  readonly cuentasQueLaUsaron: number;
  /** Cómo terminaron las órdenes según lo que informó la placa. */
  readonly ejecucion: {
    readonly ejecutadas: number;
    readonly fallidas: number;
    readonly sinConfirmacion: number;
  };
  readonly porPuerta: readonly {
    readonly cuenta: CuentaDeEstadistica;
    readonly puerta: { readonly id: string; readonly nombre: string; readonly sitio: string };
    readonly total: number;
    readonly rechazadas: number;
  }[];
  readonly porCuenta: readonly {
    readonly cuenta: CuentaDeEstadistica;
    readonly total: number;
    readonly rechazadas: number;
    readonly usuarios: number;
  }[];
  /** Solo los días con aperturas; el que lo arma rellena los demás con ceros. */
  readonly porDia: readonly {
    readonly dia: string;
    readonly ordenadas: number;
    readonly rechazadas: number;
  }[];
  /** Solo las horas (0–23, hora local) con aperturas. */
  readonly porHora: readonly { readonly hora: number; readonly total: number }[];
  readonly configuracion: {
    readonly puertas: number;
    readonly habilitadas: number;
    readonly disponibles: number;
    readonly cuentas: number;
    readonly cuentasConModoActivo: number;
  };
}

export interface ServicioDeEstadisticasDeAperturaManual {
  estadisticas(
    desde: Date,
    hasta: Date,
    desfaseUtc: string,
    maximoDeFilas: number,
  ): Promise<EstadisticasDeAperturaManual>;
}

const aNumero = (valor: number | string | undefined): number => Number(valor ?? 0);

export function crearServicioDeEstadisticasDeAperturaManual(
  pool: Pool,
): ServicioDeEstadisticasDeAperturaManual {
  const lecturas = new RepositorioDeAperturasManualesDeTodas(pool);
  const puertas = new RepositorioDeConfiguracionManualDeTodas(pool);
  const confirmaciones = new RepositorioDeConfirmacionesDeTodas(pool);
  return {
    async estadisticas(desde, hasta, desfaseUtc, maximoDeFilas) {
      const [totales, porPuerta, porCuenta, porDia, porHora, configuracion, resultados] =
        await Promise.all([
          lecturas.totales(desde, hasta),
          lecturas.porPuerta(desde, hasta, maximoDeFilas),
          lecturas.porCuenta(desde, hasta, maximoDeFilas),
          lecturas.porDia(desde, hasta, desfaseUtc),
          lecturas.porHora(desde, hasta, desfaseUtc),
          puertas.configuracion(),
          confirmaciones.resultadosDeManuales(desde, hasta),
        ]);
      const total = totales[0];
      const config = configuracion[0];
      let ejecutadas = 0;
      let fallidas = 0;
      let sinConfirmacion = 0;
      for (const fila of resultados) {
        const cantidad = aNumero(fila.total);
        if (fila.resultado === 'sin_confirmacion') sinConfirmacion += cantidad;
        else if (fila.origen === 'placa' && fila.resultado === 'ejecutada') ejecutadas += cantidad;
        else if (fila.origen === 'placa') fallidas += cantidad;
      }
      return {
        ordenadas: aNumero(total?.ordenadas),
        rechazadas: aNumero(total?.rechazadas),
        porQr: aNumero(total?.qr),
        usuarios: aNumero(total?.usuarios),
        cuentasQueLaUsaron: aNumero(total?.cuentas),
        ejecucion: { ejecutadas, fallidas, sinConfirmacion },
        porPuerta: porPuerta.map((fila) => ({
          cuenta: { id: fila.cuenta_id, codigo: fila.cuenta_codigo, nombre: fila.cuenta_nombre },
          puerta: { id: fila.puerta_id, nombre: fila.puerta_nombre, sitio: fila.sitio_nombre },
          total: aNumero(fila.total),
          rechazadas: aNumero(fila.rechazadas),
        })),
        porCuenta: porCuenta.map((fila) => ({
          cuenta: { id: fila.cuenta_id, codigo: fila.cuenta_codigo, nombre: fila.cuenta_nombre },
          total: aNumero(fila.total),
          rechazadas: aNumero(fila.rechazadas),
          usuarios: aNumero(fila.usuarios),
        })),
        porDia: porDia.map((fila) => ({
          dia: fila.dia,
          ordenadas: aNumero(fila.ordenadas),
          rechazadas: aNumero(fila.rechazadas),
        })),
        porHora: porHora.map((fila) => ({ hora: aNumero(fila.hora), total: aNumero(fila.total) })),
        configuracion: {
          puertas: aNumero(config?.puertas),
          habilitadas: aNumero(config?.habilitadas),
          disponibles: aNumero(config?.disponibles),
          cuentas: aNumero(config?.cuentas),
          cuentasConModoActivo: aNumero(config?.cuentas_activas),
        },
      };
    },
  };
}
