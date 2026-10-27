import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { crearServicioDeUmbralesDePlaca } from '../../limites/contracts.js';
import { estaEnLinea } from '../domain/en-linea.js';
import { evaluarConexion, type EstadoDeConexion } from '../domain/estado-de-placa.js';
import { umbralesEnSegundos } from '../domain/umbrales.js';
import {
  RepositorioDePlacas,
  type EstadoDePlaca,
  type FiltrosDePlacas,
} from '../placas-repository.js';

export interface PlacaDeInventario {
  readonly id: string;
  readonly mac: string;
  readonly estado: EstadoDePlaca;
  readonly firmware: string | null;
  readonly ip: string | null;
  /** Último latido si está vinculada; último anuncio si no. */
  readonly ultimo_contacto_at: string | null;
  readonly en_linea: boolean;
  /** Estado derivado del latido (ADR 0031 §18); `null` si no está vinculada o nunca latió. */
  readonly estado_conexion: EstadoDeConexion | null;
  /** Lo que informó el último latido sobre el lector QR; `null` si no lo informa. */
  readonly lector_responde: boolean | null;
  /** En línea pero sin lecturas en la puerta por el plazo (marca informativa, sin aviso). */
  readonly en_observacion: boolean;
  /** Hasta cuándo espera el botón de la placa, si se pidió vincularla. */
  readonly por_confirmar_hasta: string | null;
  readonly dispositivo: { id: string; nombre: string } | null;
  readonly cuenta: { id: string; codigo: string; nombre: string } | null;
  readonly puerta: { id: string; nombre: string } | null;
}

/** El inventario de placas para el super admin, con quién tiene cada una y si está en línea. */
export async function ejecutar(
  pool: Pool,
  filtros: FiltrosDePlacas,
  paginacion: Paginacion,
  ahora: Date = new Date(),
): Promise<Listado<PlacaDeInventario>> {
  const { limite, desplazamiento } = limiteDe(paginacion);
  const umbrales = umbralesEnSegundos(await crearServicioDeUmbralesDePlaca(pool).umbrales());
  const { filas, total } = await new RepositorioDePlacas(pool).listar(
    filtros,
    ahora,
    limite,
    desplazamiento,
  );
  const datos = filas.map((fila): PlacaDeInventario => {
    const vinculada = fila.dispositivo_id !== null;
    const contacto = vinculada ? fila.ultimo_latido_at : fila.ultimo_anuncio_at;
    const esperaElPulsador = fila.por_confirmar_hasta !== null && fila.por_confirmar_hasta > ahora;
    return {
      id: fila.id,
      mac: fila.mac,
      estado: vinculada ? 'vinculada' : esperaElPulsador ? 'por_confirmar' : 'detectada',
      firmware: vinculada
        ? (fila.firmware_del_dispositivo ?? fila.firmware_version)
        : fila.firmware_version,
      ip: fila.ultima_ip,
      ultimo_contacto_at: contacto?.toISOString() ?? null,
      // Sin vínculo la placa se anuncia cada 30 s; con vínculo, el latido es cada 60 s.
      en_linea: estaEnLinea(contacto, ahora),
      // Se calcula con el reloj de la consulta y lo guardado de la pasada anterior: el mismo criterio que el detector.
      estado_conexion: vinculada
        ? evaluarConexion(
            {
              ultimoLatidoAt: fila.ultimo_latido_at,
              enLineaDesde: fila.en_linea_desde,
              previo: fila.estado_conexion,
            },
            ahora,
            umbrales,
          )
        : null,
      lector_responde:
        vinculada && fila.lector_responde !== null ? fila.lector_responde === 1 : null,
      en_observacion: vinculada && fila.en_observacion === 1,
      por_confirmar_hasta: esperaElPulsador
        ? (fila.por_confirmar_hasta?.toISOString() ?? null)
        : null,
      // Son LEFT JOIN: con el id presente, el resto de la unión también lo está.
      dispositivo:
        fila.dispositivo_id === null
          ? null
          : { id: fila.dispositivo_id, nombre: fila.dispositivo_nombre ?? '' },
      cuenta:
        fila.cuenta_id === null
          ? null
          : {
              id: fila.cuenta_id,
              codigo: fila.cuenta_codigo ?? '',
              nombre: fila.cuenta_nombre ?? '',
            },
      puerta:
        fila.puerta_id === null ? null : { id: fila.puerta_id, nombre: fila.puerta_nombre ?? '' },
    };
  });
  return armarListado(datos, paginacion, total);
}
