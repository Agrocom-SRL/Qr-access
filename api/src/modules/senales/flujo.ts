import type { Pool } from 'mysql2/promise';
import {
  crearServicioDeActividadParaSenales,
  diaLocal,
  ZONA_DE_LOS_TOPES,
} from '../accesos/contracts.js';
import { inicioDelDia } from '../../platform/tiempo/fechas.js';
import {
  armarSerieDeFlujo,
  DESFASE_UTC,
  DIAS_DE_BASE,
  diasEntre,
  restarDias,
  type ActividadSimple,
  type DiaDeFlujo,
  type UmbralesDeFlujo,
} from './domain/reglas.js';

/**
 * La serie diaria de flujo de esas cuentas hasta hoy (incluido), con la marca de anomalía de cada día. Lee los
 * `DIAS_DE_BASE` días anteriores solo para calcular la base habitual. Solo lectura.
 */
export async function seriesDeFlujo(
  pool: Pool,
  cuentaIds: readonly string[],
  mostrar: number,
  usuariosActivos: ReadonlyMap<string, number>,
  umbrales: ReadonlyMap<string, UmbralesDeFlujo>,
  ahora: Date,
): Promise<{ hoy: string; series: Map<string, DiaDeFlujo[]> }> {
  const hoy = diaLocal(ahora, ZONA_DE_LOS_TOPES);
  const dias = diasEntre(restarDias(hoy, mostrar - 1 + DIAS_DE_BASE), hoy);
  const primero = dias[0] ?? hoy;
  const porCuenta = await crearServicioDeActividadParaSenales(pool).porDia(
    cuentaIds,
    inicioDelDia(primero, ZONA_DE_LOS_TOPES),
    new Date(ahora.getTime() + 1),
    DESFASE_UTC,
  );
  const series = new Map<string, DiaDeFlujo[]>();
  for (const cuentaId of cuentaIds) {
    const actividad = new Map<string, ActividadSimple>(
      (porCuenta.get(cuentaId) ?? []).map((d) => [d.dia, d]),
    );
    series.set(
      cuentaId,
      armarSerieDeFlujo({
        dias,
        mostrar,
        actividad,
        usuariosActivos: usuariosActivos.get(cuentaId) ?? 0,
        umbrales: umbrales.get(cuentaId) ?? { aperturasMinimo: 1, aperturasPorUsuario: 1 },
      }),
    );
  }
  return { hoy, series };
}
