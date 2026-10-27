import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { crearServicioDeUmbralesDeSenal } from '../../limites/contracts.js';
import { ZONA_DE_LOS_TOPES } from '../../accesos/contracts.js';
import {
  crearServicioDeConteoDeUsuarios,
  crearServicioDeIdentidades,
} from '../../seguridad/contracts.js';
import { presentarCuenta } from '../consumo.js';
import { seriesDeFlujo } from '../flujo.js';

/**
 * La serie diaria de generaciones y aperturas de UNA cuenta, con la marca de anomalía de cada día y la base habitual,
 * para que la persona juzgue si el flujo es un pico de un día o persiste (ADR 0030 §5). 404 `cuenta.no_encontrada` si
 * no existe. Solo lectura. Los usuarios activos son los de hoy: no se guarda cuántos hubo cada día.
 */
export async function ejecutar(
  pool: Pool,
  cuentaId: string,
  dias: number,
  ahora: Date = new Date(),
) {
  const cuenta = (await crearServicioDeIdentidades(pool).cuentas([cuentaId])).get(cuentaId);
  if (cuenta === undefined) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  const [umbrales, activos] = await Promise.all([
    crearServicioDeUmbralesDeSenal(pool).flujoDeCuentas([cuentaId]),
    crearServicioDeConteoDeUsuarios(pool).activosPorCuenta([cuentaId]),
  ]);
  const limites = umbrales.get(cuentaId) ?? { aperturasMinimo: 0, aperturasPorUsuario: 0 };
  const { series } = await seriesDeFlujo(pool, [cuentaId], dias, activos, umbrales, ahora);
  return {
    cuenta: presentarCuenta(cuenta),
    usuarios_activos: activos.get(cuentaId) ?? 0,
    umbrales: {
      aperturas_minimo: limites.aperturasMinimo,
      aperturas_por_usuario: limites.aperturasPorUsuario,
    },
    zona_horaria: ZONA_DE_LOS_TOPES,
    serie: series.get(cuentaId) ?? [],
  };
}
