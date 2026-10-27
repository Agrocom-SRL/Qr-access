import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeEventos } from '../repository.js';
import { alcanceDe, type FiltrosDeEventos } from './listar-eventos.js';

export interface ResumenDeEventos {
  permitidos: number;
  rechazados: number;
  rechazados_por_motivo: { motivo_code: string; total: number }[];
  /** Aperturas repetidas por respuesta perdida (ADR 0032 §3); no suman a `permitidos`. */
  repeticiones_permitidas: number;
  repeticiones_rechazadas: number;
}

/** Indicadores del tablero (accesos de hoy, rechazados y por qué) con el mismo alcance que el listado. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  filtros: FiltrosDeEventos,
): Promise<ResumenDeEventos> {
  const repositorio = new RepositorioDeEventos(pool);
  const alcance = await alcanceDe(pool, principal, filtros);
  const [filas, repeticiones] = await Promise.all([
    repositorio.resumir(alcance),
    repositorio.resumirRepeticiones(alcance),
  ]);
  const resumen: ResumenDeEventos = {
    permitidos: 0,
    rechazados: 0,
    rechazados_por_motivo: [],
    repeticiones_permitidas: 0,
    repeticiones_rechazadas: 0,
  };
  for (const fila of repeticiones) {
    if (fila.resultado === 'permitido') resumen.repeticiones_permitidas += Number(fila.total);
    else resumen.repeticiones_rechazadas += Number(fila.total);
  }
  for (const fila of filas) {
    const total = Number(fila.total);
    if (fila.resultado === 'permitido') {
      resumen.permitidos += total;
    } else {
      resumen.rechazados += total;
      resumen.rechazados_por_motivo.push({ motivo_code: fila.motivo_code, total });
    }
  }
  return resumen;
}
