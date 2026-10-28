import type { Pool } from 'mysql2/promise';
import { aIso } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeSenalesDePlataforma } from '../../incidentes/contracts.js';
import { crearServicioDeIdentidades } from '../../seguridad/contracts.js';

/** Cuántas cuentas lista el resumen. */
const CUENTAS_DEL_RESUMEN = 10;

/**
 * El resumen de las señales de abuso de los últimos `dias` días (hasta ahora): cuántas hubo de cada tipo, cuántas siguen
 * abiertas (sin resolver o pendientes) y de gravedad alta, y las diez cuentas con más señales. Para el encabezado del
 * panel de AGROCOM. Solo lectura.
 */
export async function ejecutar(pool: Pool, dias: number, ahora: Date = new Date()) {
  const hasta = new Date(ahora.getTime() + 1);
  const desde = new Date(ahora.getTime() - dias * 86_400_000);
  const senales = crearServicioDeSenalesDePlataforma(pool);
  const [porTipo, porCuenta] = await Promise.all([
    senales.resumenPorTipo(desde, hasta),
    senales.resumenPorCuenta(desde, hasta, CUENTAS_DEL_RESUMEN),
  ]);
  const cuentas = await crearServicioDeIdentidades(pool).cuentas(porCuenta.map((c) => c.cuentaId));
  return {
    desde: aIso(desde),
    hasta: aIso(ahora),
    dias,
    total: porTipo.reduce((suma, fila) => suma + fila.total, 0),
    abiertas: porTipo.reduce((suma, fila) => suma + fila.abiertas, 0),
    por_tipo: porTipo,
    cuentas: porCuenta.map((fila) => ({
      cuenta: {
        id: fila.cuentaId,
        codigo: cuentas.get(fila.cuentaId)?.codigo ?? '',
        nombre: cuentas.get(fila.cuentaId)?.nombre ?? '',
      },
      total: fila.total,
      abiertas: fila.abiertas,
      altas: fila.altas,
    })),
  };
}
