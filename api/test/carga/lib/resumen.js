// Resumen exportable de cada corrida: JSON completo (todas las métricas y umbrales) y CSV plano para hoja de
// cálculo. Además, un texto corto en la consola. Sin dependencias remotas (jslib), para que corra sin red.
import { CONFIG } from './entorno.js';

const ESTADISTICAS_CSV = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count', 'rate', 'value'];

function csvDe(datos) {
  const filas = ['metrica;estadistica;valor'];
  for (const [nombre, metrica] of Object.entries(datos.metrics ?? {})) {
    for (const estadistica of ESTADISTICAS_CSV) {
      const valor = metrica.values?.[estadistica];
      if (valor !== undefined) filas.push(`"${nombre}";${estadistica};${valor}`);
    }
  }
  filas.push('');
  filas.push('metrica;umbral;cumple');
  for (const [nombre, metrica] of Object.entries(datos.metrics ?? {})) {
    for (const [umbral, resultado] of Object.entries(metrica.thresholds ?? {})) {
      filas.push(`"${nombre}";"${umbral}";${resultado.ok ? 'si' : 'no'}`);
    }
  }
  return filas.join('\n');
}

function textoDe(nombre, datos) {
  const lineas = [`Resumen de ${nombre}`];
  for (const [clave, metrica] of Object.entries(datos.metrics ?? {})) {
    if (!/^(http_req_duration|respuestas_|aperturas_|sin_datos|limites_|validaciones_)/.test(clave)) continue;
    const v = metrica.values ?? {};
    const partes = [];
    if (v['p(95)'] !== undefined) partes.push(`p95=${v['p(95)'].toFixed(1)}`);
    if (v['p(99)'] !== undefined) partes.push(`p99=${v['p(99)'].toFixed(1)}`);
    if (v.count !== undefined) partes.push(`n=${v.count}`);
    if (v.rate !== undefined) partes.push(`tasa=${v.rate.toFixed(4)}`);
    lineas.push(`  ${clave}: ${partes.join(' ')}`);
  }
  const fallidos = [];
  for (const [clave, metrica] of Object.entries(datos.metrics ?? {})) {
    for (const [umbral, resultado] of Object.entries(metrica.thresholds ?? {})) {
      if (!resultado.ok) fallidos.push(`${clave} ${umbral}`);
    }
  }
  lineas.push(fallidos.length ? `Umbrales que NO se cumplen:\n  - ${fallidos.join('\n  - ')}` : 'Umbrales: todos se cumplen.');
  return lineas.join('\n');
}

/**
 * Crea el `handleSummary` de un escenario. Escribe `<salida>/<nombre>-<sello>.json` y `.csv`; la ruta sale de
 * CARGA_SALIDA (api/test/carga/resultados por omisión, dentro del repo y excluida de git).
 */
export function resumenDe(nombre) {
  return function handleSummary(datos) {
    const sello = new Date().toISOString().replace(/[:.]/g, '-');
    const ruta = `${CONFIG.salida}/${nombre}-${sello}`;
    return {
      stdout: `\n${textoDe(nombre, datos)}\n`,
      [`${ruta}.json`]: JSON.stringify(datos, null, 2),
      [`${ruta}.csv`]: csvDe(datos),
    };
  };
}
