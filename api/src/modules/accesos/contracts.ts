import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';

interface AccesosPorDiaFila extends RowDataPacket {
  dia: string;
  resultado: 'permitido' | 'rechazado';
  total: string;
}

/**
 * Cuántos intentos de acceso hubo por día en TODAS las cuentas, para las gráficas del panel de
 * plataforma. Salto EXPLÍCITO del aislamiento: solo lee totales agregados, nunca filas de una
 * cuenta ni escribe (`eventos_acceso` es de solo inserción).
 */
class RepositorioDeAccesosDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'eventos_acceso',
      columnas: [],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  contarPorDia(desde: Date, hasta: Date, zona: string): Promise<AccesosPorDiaFila[]> {
    return this.seleccionar<AccesosPorDiaFila>({
      columnas:
        "DATE_FORMAT(CONVERT_TZ(t.ocurrido_at, '+00:00', ?), '%Y-%m-%d') AS dia, t.resultado, COUNT(*) AS total",
      donde: 't.ocurrido_at >= ? AND t.ocurrido_at < ?',
      agrupar: 'dia, t.resultado',
      params: [zona, desde, hasta],
      orden: 'dia',
    });
  }
}

export interface AccesosDelDia {
  /** `aaaa-mm-dd`, en la zona pedida. */
  readonly dia: string;
  readonly permitidos: number;
  readonly rechazados: number;
}

export interface ServicioDeAccesosDePlataforma {
  /** Los días con al menos un intento entre `desde` (incl.) y `hasta` (excl.); los días sin intentos no figuran. */
  porDia(desde: Date, hasta: Date, desfaseUtc: string): Promise<AccesosDelDia[]>;
}

export function crearServicioDeAccesosDePlataforma(pool: Pool): ServicioDeAccesosDePlataforma {
  const repositorio = new RepositorioDeAccesosDeTodas(pool);
  return {
    async porDia(desde, hasta, desfaseUtc) {
      const dias = new Map<string, { permitidos: number; rechazados: number }>();
      for (const fila of await repositorio.contarPorDia(desde, hasta, desfaseUtc)) {
        const dia = dias.get(fila.dia) ?? { permitidos: 0, rechazados: 0 };
        if (fila.resultado === 'permitido') dia.permitidos += Number(fila.total);
        else dia.rechazados += Number(fila.total);
        dias.set(fila.dia, dia);
      }
      return [...dias.entries()].map(([dia, cuenta]) => ({ dia, ...cuenta }));
    },
  };
}
