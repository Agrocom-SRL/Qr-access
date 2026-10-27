import type { Pool } from 'mysql2/promise';
import { armarListado, limiteDe, type Paginacion } from '../../../platform/http/paginacion.js';
import { CacheCorta } from '../../../platform/cache/cache-corta.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeIdentidades } from '../../seguridad/contracts.js';
import {
  calcularConsumo,
  VIGENCIA_DE_VISTAS_DE_PLATAFORMA_MS,
  coincideConLaBusqueda,
  presentarConsumo,
  type ConsumoDeCuenta,
} from '../consumo.js';
import type { EstadoDeBolsa } from '../domain/reglas.js';

export interface FiltroDeConsumo {
  readonly estado: EstadoDeBolsa | null;
  readonly buscar: string | null;
  readonly orden: 'porcentaje' | 'usado' | 'tope' | 'nombre';
  readonly sentido: 'asc' | 'desc';
}

/** El consumo de TODAS las cuentas del mes (es una vista de plataforma: no hay datos que separar por cuenta). */
const consumoDelMes = new CacheCorta<Awaited<ReturnType<typeof calcularConsumo>>>(
  VIGENCIA_DE_VISTAS_DE_PLATAFORMA_MS,
);

type Presentado = ReturnType<typeof presentarConsumo>;

/** La clave por la que se ordena; `null` (sin bolsa) va siempre al final. */
function claveDeOrden(
  consumo: ConsumoDeCuenta,
  orden: FiltroDeConsumo['orden'],
): number | string | null {
  switch (orden) {
    case 'porcentaje':
      return consumo.porcentaje;
    case 'usado':
      return consumo.usado;
    case 'tope':
      return consumo.tope;
    case 'nombre':
      return consumo.cuenta.nombre.toLocaleLowerCase('es');
  }
}

function comparar(a: ConsumoDeCuenta, b: ConsumoDeCuenta, filtro: FiltroDeConsumo): number {
  const x = claveDeOrden(a, filtro.orden);
  const y = claveDeOrden(b, filtro.orden);
  if (x === null && y === null)
    return a.cuenta.id.localeCompare(b.cuenta.id, 'es', { numeric: true });
  if (x === null) return 1;
  if (y === null) return -1;
  const orden = typeof x === 'string' ? x.localeCompare(String(y), 'es') : x - Number(y);
  const conSentido = filtro.sentido === 'asc' ? orden : -orden;
  // Empate: el que más consumió primero y, al final, por id (el orden es estable entre páginas).
  return conSentido !== 0
    ? conSentido
    : b.usado - a.usado || a.cuenta.id.localeCompare(b.cuenta.id, 'es', { numeric: true });
}

/**
 * El consumo de la bolsa mensual de QR de todas las cuentas, para el panel de AGROCOM (ADR 0030 §5: «una lista de
 * cuentas ordenable por consumo de la bolsa»). Por omisión, de mayor a menor porcentaje: el ranking de quienes más
 * consumen. Solo lectura; no corta ni limita nada. Se calcula (y se guarda unos segundos, `consumoDelMes`) para todas las cuentas y se pagina en memoria (son las
 * cuentas clientes, no los eventos), de modo que `total` y `por_estado` no dependen de la página.
 */
export async function ejecutar(
  pool: Pool,
  filtro: FiltroDeConsumo,
  paginacion: Paginacion,
  ahora: Date = new Date(),
) {
  // El cálculo cubre todas las cuentas y no depende del filtro: se reutiliza unos segundos entre clics del panel.
  const mes = await consumoDelMes.obtener('consumo', ahora.getTime(), async () =>
    calcularConsumo(pool, await crearServicioDeIdentidades(pool).todasLasCuentas(), ahora),
  );
  const busqueda = mes.consumos.filter((c) => coincideConLaBusqueda(c.cuenta, filtro.buscar));
  const porEstado = { normal: 0, aviso: 0, superada: 0, sin_tope: 0 };
  for (const consumo of busqueda) porEstado[consumo.estado] += 1;
  const filtrados = busqueda
    .filter((c) => filtro.estado === null || c.estado === filtro.estado)
    .sort((a, b) => comparar(a, b, filtro));
  const { limite, desplazamiento } = limiteDe(paginacion);
  const pagina: Presentado[] = filtrados
    .slice(desplazamiento, desplazamiento + limite)
    .map(presentarConsumo);
  const listado = armarListado(pagina, paginacion, filtrados.length);
  return {
    datos: listado.datos,
    meta: {
      ...listado.meta,
      mes: mes.mes,
      desde: aIso(mes.desde),
      aviso_porcentaje: mes.avisoPorcentaje,
      por_estado: porEstado,
    },
  };
}
