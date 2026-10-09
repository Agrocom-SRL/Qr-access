import type { Pool } from 'mysql2/promise';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { RepositorioDeEventos } from '../repository.js';
import { alcanceDe, type FiltrosDeEventos } from './listar-eventos.js';

export interface ResumenDeEventos {
  permitidos: number;
  rechazados: number;
  rechazados_por_motivo: { motivo_code: string; total: number }[];
}

/** Indicadores del tablero (accesos de hoy, rechazados y por qué) con el mismo alcance que el listado. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  filtros: FiltrosDeEventos,
): Promise<ResumenDeEventos> {
  const filas = await new RepositorioDeEventos(pool).resumir(alcanceDe(principal, filtros));
  const resumen: ResumenDeEventos = { permitidos: 0, rechazados: 0, rechazados_por_motivo: [] };
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
