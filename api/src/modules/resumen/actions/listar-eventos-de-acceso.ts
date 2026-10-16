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
    })),
    paginacion,
    total,
  );
}
