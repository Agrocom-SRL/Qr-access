import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import { RepositorioDeQr } from './repository.js';

interface AccesosPorDiaFila extends RowDataPacket {
  dia: string;
  resultado: 'permitido' | 'rechazado';
  total: string;
}

const UNIONES_DE_EVENTO =
  'JOIN cuentas AS c ON c.id = t.tenant_id ' +
  'JOIN puertas AS p ON p.id = t.puerta_id AND p.tenant_id = t.tenant_id ' +
  'JOIN sitios AS s ON s.id = p.sitio_id AND s.tenant_id = t.tenant_id ' +
  'LEFT JOIN dispositivos AS d ON d.id = t.dispositivo_id AND d.tenant_id = t.tenant_id ' +
  'LEFT JOIN qr_accesos AS q ON q.id = t.qr_acceso_id AND q.tenant_id = t.tenant_id';

export interface FiltroDeEventosDePlataforma {
  readonly cuentaId: string | null;
  readonly resultado: 'permitido' | 'rechazado' | null;
  readonly desde: Date | null;
  readonly hasta: Date | null;
}

interface EventoDePlataformaFila extends RowDataPacket {
  id: string;
  ocurrido_at: Date;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  puerta_id: string;
  puerta_nombre: string;
  sitio_nombre: string;
  dispositivo_nombre: string | null;
  qr_etiqueta: string | null;
}

/** El `WHERE` de los filtros presentes; los valores van siempre como parámetros. */
function armarFiltro(filtro: FiltroDeEventosDePlataforma): { donde?: string; params: unknown[] } {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.cuentaId !== null) {
    condiciones.push('t.tenant_id = ?');
    params.push(filtro.cuentaId);
  }
  if (filtro.resultado !== null) {
    condiciones.push('t.resultado = ?');
    params.push(filtro.resultado);
  }
  if (filtro.desde !== null) {
    condiciones.push('t.ocurrido_at >= ?');
    params.push(filtro.desde);
  }
  if (filtro.hasta !== null) {
    condiciones.push('t.ocurrido_at < ?');
    params.push(filtro.hasta);
  }
  return condiciones.length === 0 ? { params } : { donde: condiciones.join(' AND '), params };
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

  /**
   * Los intentos de todas las cuentas, del más nuevo al más viejo, con quién es la cuenta, la
   * puerta y el lector. Las uniones leen nombres para mostrar; no escriben nada.
   */
  listar(
    filtro: FiltroDeEventosDePlataforma,
    limite: number,
    desplazamiento: number,
  ): Promise<EventoDePlataformaFila[]> {
    const { donde, params } = armarFiltro(filtro);
    return this.seleccionar<EventoDePlataformaFila>({
      columnas:
        't.id, t.ocurrido_at, t.resultado, t.motivo_code, ' +
        'c.id AS cuenta_id, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre, ' +
        'p.id AS puerta_id, p.nombre AS puerta_nombre, s.nombre AS sitio_nombre, ' +
        'd.nombre AS dispositivo_nombre, q.etiqueta AS qr_etiqueta',
      uniones: UNIONES_DE_EVENTO,
      ...(donde === undefined ? {} : { donde }),
      params,
      orden: 't.ocurrido_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contarTodos(filtro: FiltroDeEventosDePlataforma): Promise<number> {
    const { donde, params } = armarFiltro(filtro);
    return this.contar({
      uniones: UNIONES_DE_EVENTO,
      ...(donde === undefined ? {} : { donde }),
      params,
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

export interface EventoDePlataforma {
  readonly id: string;
  readonly ocurridoAt: Date;
  readonly resultado: 'permitido' | 'rechazado';
  readonly motivoCode: string;
  readonly cuenta: { readonly id: string; readonly codigo: string; readonly nombre: string };
  readonly puerta: { readonly id: string; readonly nombre: string; readonly sitio: string };
  readonly dispositivo: string | null;
  readonly qrEtiqueta: string | null;
}

export interface ServicioDeAccesosDePlataforma {
  /** Los intentos de todas las cuentas (o de una), paginados, del más nuevo al más viejo. */
  listar(
    filtro: FiltroDeEventosDePlataforma,
    limite: number,
    desplazamiento: number,
  ): Promise<{ eventos: EventoDePlataforma[]; total: number }>;
  /** Los días con al menos un intento entre `desde` (incl.) y `hasta` (excl.); los días sin intentos no figuran. */
  porDia(desde: Date, hasta: Date, desfaseUtc: string): Promise<AccesosDelDia[]>;
}

export function crearServicioDeAccesosDePlataforma(pool: Pool): ServicioDeAccesosDePlataforma {
  const repositorio = new RepositorioDeAccesosDeTodas(pool);
  return {
    async listar(filtro, limite, desplazamiento) {
      const [filas, total] = await Promise.all([
        repositorio.listar(filtro, limite, desplazamiento),
        repositorio.contarTodos(filtro),
      ]);
      return {
        total,
        eventos: filas.map((fila) => ({
          id: fila.id,
          ocurridoAt: fila.ocurrido_at,
          resultado: fila.resultado,
          motivoCode: fila.motivo_code,
          cuenta: { id: fila.cuenta_id, codigo: fila.cuenta_codigo, nombre: fila.cuenta_nombre },
          puerta: { id: fila.puerta_id, nombre: fila.puerta_nombre, sitio: fila.sitio_nombre },
          dispositivo: fila.dispositivo_nombre,
          qrEtiqueta: fila.qr_etiqueta,
        })),
      };
    },
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

/** Lo que un usuario hizo con sus QR en una ventana (estadísticas de uso, ADR 0028). */
export interface ActividadDeEmisor {
  readonly emitidos: number;
  readonly usados: number;
  /** El mayor número de QR generados en un solo día de la ventana. */
  readonly maxEnUnDia: number;
  /** El último QR generado, de cualquier fecha; `null` si nunca generó uno. */
  readonly ultimoEmitidoAt: Date | null;
}

export interface ServicioDeActividadDeQr {
  /**
   * La actividad de esos usuarios de la cuenta del contexto desde `desde`. Un usuario que no generó
   * ningún QR figura con ceros, así que quien llama no tiene que distinguir "sin datos" de "sin uso".
   */
  deEmisores(
    usuarioIds: readonly string[],
    desde: Date,
    desfaseUtc: string,
  ): Promise<Map<string, ActividadDeEmisor>>;
}

export function crearServicioDeActividadDeQr(pool: Pool): ServicioDeActividadDeQr {
  const repositorio = new RepositorioDeQr(pool);
  return {
    async deEmisores(usuarioIds, desde, desfaseUtc) {
      const [conteos, maximos, ultimos] = await Promise.all([
        repositorio.actividadDesde(usuarioIds, desde),
        repositorio.maxEnUnDiaDesde(usuarioIds, desde, desfaseUtc),
        repositorio.ultimoEmitidoDe(usuarioIds),
      ]);
      return new Map(
        usuarioIds.map((id) => [
          id,
          {
            emitidos: conteos.get(id)?.emitidos ?? 0,
            usados: conteos.get(id)?.usados ?? 0,
            maxEnUnDia: maximos.get(id) ?? 0,
            ultimoEmitidoAt: ultimos.get(id) ?? null,
          },
        ]),
      );
    },
  };
}
