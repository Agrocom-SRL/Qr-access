import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeActividadParaSenales } from '../../accesos/contracts.js';
import { crearServicioDeIdentidades } from '../../seguridad/contracts.js';
import { calcularConsumo, presentarConsumo } from '../consumo.js';
import { DESFASE_UTC, diasEntre } from '../domain/reglas.js';
import { diaLocal, ZONA_DE_LOS_TOPES } from '../../accesos/contracts.js';

/**
 * El detalle del consumo de la bolsa de UNA cuenta: lo de la lista más los QR generados por día del mes en curso (ADR
 * 0030 §5: «el consumo por día», para que la persona juzgue si es un pico o una semana entera con el tope alto). 404
 * `cuenta.no_encontrada` si no existe. Solo lectura.
 */
export async function ejecutar(pool: Pool, cuentaId: string, ahora: Date = new Date()) {
  const cuentas = await crearServicioDeIdentidades(pool).cuentas([cuentaId]);
  const cuenta = cuentas.get(cuentaId);
  if (cuenta === undefined) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  const mes = await calcularConsumo(pool, [cuenta], ahora);
  const consumo = mes.consumos[0];
  if (consumo === undefined) throw new ErrorDeDominio('cuenta.no_encontrada', 404);

  const hoy = diaLocal(ahora, ZONA_DE_LOS_TOPES);
  const porDia = (
    await crearServicioDeActividadParaSenales(pool).porDia(
      [cuentaId],
      mes.desde,
      new Date(ahora.getTime() + 1),
      DESFASE_UTC,
    )
  ).get(cuentaId);
  const generados = new Map((porDia ?? []).map((dia) => [dia.dia, dia.generados]));
  return {
    ...presentarConsumo(consumo),
    mes: mes.mes,
    desde: aIso(mes.desde),
    aviso_porcentaje: mes.avisoPorcentaje,
    serie: diasEntre(`${mes.mes}-01`, hoy).map((dia) => ({
      dia,
      generados: generados.get(dia) ?? 0,
    })),
  };
}
