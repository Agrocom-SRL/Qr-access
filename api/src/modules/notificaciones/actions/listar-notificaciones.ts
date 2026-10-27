import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { aIso, aIsoONulo } from '../../../platform/tiempo/fechas.js';
import type { DatosDeAviso, Severidad, TipoDeNotificacion } from '../domain/aviso.js';
import {
  datosDe,
  type FiltroDeBandeja,
  type NotificacionFila,
  type OperacionesDeBandeja,
} from '../repository.js';

export interface NotificacionDeBandeja {
  readonly id: string;
  readonly tipo: TipoDeNotificacion;
  readonly severidad: Severidad;
  /** De qué cuenta habla (en la bandeja de una cuenta es siempre la propia). */
  readonly cuenta_id: string;
  /** Cuántas placas hay hoy en el aviso agrupado. */
  readonly cantidad: number;
  /** El incidente ya se resolvió (las placas volvieron). */
  readonly resuelta: boolean;
  readonly leida: boolean;
  readonly datos: DatosDeAviso;
  readonly novedad_at: string;
  readonly resuelta_at: string | null;
  readonly leida_at: string | null;
  readonly creada_at: string;
}

export function aNotificacion(fila: NotificacionFila): NotificacionDeBandeja {
  return {
    id: fila.id,
    tipo: fila.tipo,
    severidad: fila.severidad,
    cuenta_id: fila.cuenta_id,
    cantidad: fila.cantidad,
    // Una constancia informativa nace cerrada pero no es un incidente resuelto: lo es solo si tiene fecha.
    resuelta: fila.resuelta_at !== null,
    leida: fila.leida_at !== null,
    datos: datosDe(fila),
    novedad_at: aIso(fila.novedad_at),
    resuelta_at: aIsoONulo(fila.resuelta_at),
    leida_at: aIsoONulo(fila.leida_at),
    creada_at: aIso(fila.created_at),
  };
}

/** Mis notificaciones (las que no descarté), de la más reciente a la más antigua. */
export async function ejecutar(
  bandeja: OperacionesDeBandeja,
  destinatarioId: string,
  filtro: FiltroDeBandeja,
  paginacion: Paginacion,
): Promise<Listado<NotificacionDeBandeja>> {
  const { limite, desplazamiento } = limiteDe(paginacion);
  const [filas, total] = await Promise.all([
    bandeja.listar(destinatarioId, filtro, limite, desplazamiento),
    bandeja.contar(destinatarioId, filtro),
  ]);
  return armarListado(filas.map(aNotificacion), paginacion, total);
}
