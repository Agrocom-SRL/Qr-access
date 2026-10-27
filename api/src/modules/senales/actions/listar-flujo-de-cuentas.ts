import type { Pool } from 'mysql2/promise';
import { armarListado, limiteDe, type Paginacion } from '../../../platform/http/paginacion.js';
import { crearServicioDeUmbralesDeSenal } from '../../limites/contracts.js';
import {
  crearServicioDeConteoDeUsuarios,
  crearServicioDeIdentidades,
} from '../../seguridad/contracts.js';
import { coincideConLaBusqueda, presentarCuenta } from '../consumo.js';
import type { DiaDeFlujo } from '../domain/reglas.js';
import { seriesDeFlujo } from '../flujo.js';

export interface FiltroDeFlujo {
  readonly dias: number;
  readonly soloAtipicas: boolean;
  readonly buscar: string | null;
  readonly orden: 'por_usuario' | 'aperturas' | 'dias_atipicos' | 'nombre';
  readonly sentido: 'asc' | 'desc';
}

/**
 * El flujo reciente de todas las cuentas, para el panel de AGROCOM (ADR 0030 §5: «una lista de cuentas ordenable por
 * flujo atípico»): aperturas de hoy por usuario activo, cuántos de los últimos días fueron atípicos y la base habitual.
 * Por omisión, primero las de más aperturas por usuario. Solo lectura; no limita nada.
 */
export async function ejecutar(
  pool: Pool,
  filtro: FiltroDeFlujo,
  paginacion: Paginacion,
  ahora: Date = new Date(),
) {
  const cuentas = (await crearServicioDeIdentidades(pool).todasLasCuentas()).filter((cuenta) =>
    coincideConLaBusqueda(cuenta, filtro.buscar),
  );
  const ids = cuentas.map((cuenta) => cuenta.id);
  const [umbrales, activos] = await Promise.all([
    crearServicioDeUmbralesDeSenal(pool).flujoDeCuentas(ids),
    crearServicioDeConteoDeUsuarios(pool).activosPorCuenta(ids),
  ]);
  const { hoy, series } = await seriesDeFlujo(pool, ids, filtro.dias, activos, umbrales, ahora);

  const filas = cuentas.map((cuenta) => {
    const serie: DiaDeFlujo[] = series.get(cuenta.id) ?? [];
    const dehoy = serie.find((dia) => dia.dia === hoy);
    const atipicos = serie.filter((dia) => dia.atipico);
    const limites = umbrales.get(cuenta.id) ?? { aperturasMinimo: 0, aperturasPorUsuario: 0 };
    return {
      cuenta: presentarCuenta(cuenta),
      usuarios_activos: activos.get(cuenta.id) ?? 0,
      umbrales: {
        aperturas_minimo: limites.aperturasMinimo,
        aperturas_por_usuario: limites.aperturasPorUsuario,
      },
      aperturas_hoy: dehoy?.aperturas ?? 0,
      por_usuario_hoy: dehoy?.por_usuario ?? 0,
      atipica_hoy: dehoy?.atipico ?? false,
      aperturas_periodo: serie.reduce((suma, dia) => suma + dia.aperturas, 0),
      dias_atipicos: atipicos.length,
      ultimo_dia_atipico: atipicos.at(-1)?.dia ?? null,
      base: dehoy?.base ?? null,
    };
  });

  const clave = (fila: (typeof filas)[number]): number | string => {
    switch (filtro.orden) {
      case 'por_usuario':
        return fila.por_usuario_hoy;
      case 'aperturas':
        return fila.aperturas_hoy;
      case 'dias_atipicos':
        return fila.dias_atipicos;
      case 'nombre':
        return fila.cuenta.nombre.toLocaleLowerCase('es');
    }
  };
  const filtradas = filas
    .filter((fila) => !filtro.soloAtipicas || fila.dias_atipicos > 0)
    .sort((a, b) => {
      const x = clave(a);
      const y = clave(b);
      const orden = typeof x === 'string' ? x.localeCompare(String(y), 'es') : x - Number(y);
      return (
        (filtro.sentido === 'asc' ? orden : -orden) ||
        b.aperturas_hoy - a.aperturas_hoy ||
        a.cuenta.id.localeCompare(b.cuenta.id, 'es', { numeric: true })
      );
    });
  const { limite, desplazamiento } = limiteDe(paginacion);
  const listado = armarListado(
    filtradas.slice(desplazamiento, desplazamiento + limite),
    paginacion,
    filtradas.length,
  );
  return { datos: listado.datos, meta: { ...listado.meta, dias: filtro.dias, hoy } };
}
