import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import {
  crearServicioDeAccesosDePlataforma,
  type FiltroDeEventosDePlataforma,
} from '../../accesos/contracts.js';

export interface EventoDeAccesoDePlataforma {
  id: string;
  ocurrido_at: string;
  resultado: 'permitido' | 'rechazado';
  motivo_code: string;
  cuenta: { id: string; codigo: string; nombre: string };
  puerta: { id: string; nombre: string; sitio: string };
  dispositivo: string | null;
  qr_etiqueta: string | null;
  /** Qué pasó con la orden de abrir (ADR 0031 §18): `ejecutada`, `fallida`, `sin_confirmacion` o `null`. */
  ejecucion: 'ejecutada' | 'fallida' | 'sin_confirmacion' | null;
  /** Por qué: `puerta_abrio`, `puerta_no_abrio`, `sin_sensor`, `sin_respuesta`...; `null` si no hay ejecución. */
  ejecucion_causa: string | null;
  /** Aperturas repetidas enlazadas a este intento (ADR 0032 §3). */
  repeticiones_permitidas: number;
  repeticiones_rechazadas: number;
}

/**
 * Los intentos de acceso de todas las cuentas (o de una) para el super admin: así se ve en
 * vivo qué leyeron las placas sin entrar cuenta por cuenta. Solo lectura (invariante 4).
 */
export async function ejecutar(
  pool: Pool,
  filtro: FiltroDeEventosDePlataforma,
  paginacion: Paginacion,
): Promise<Listado<EventoDeAccesoDePlataforma>> {
  const { limite, desplazamiento } = limiteDe(paginacion);
  const { eventos, total } = await crearServicioDeAccesosDePlataforma(pool).listar(
    filtro,
    limite,
    desplazamiento,
  );
  return armarListado(
    eventos.map((evento) => ({
      id: evento.id,
      ocurrido_at: aIso(evento.ocurridoAt),
      resultado: evento.resultado,
      motivo_code: evento.motivoCode,
      cuenta: evento.cuenta,
      puerta: evento.puerta,
      dispositivo: evento.dispositivo,
      qr_etiqueta: evento.qrEtiqueta,
      ejecucion: evento.ejecucion,
      ejecucion_causa: evento.ejecucionCausa,
      repeticiones_permitidas: evento.repeticionesPermitidas,
      repeticiones_rechazadas: evento.repeticionesRechazadas,
    })),
    paginacion,
    total,
  );
}
