import { AlmacenSesion } from '../../shared/api/almacenSesion';
import { crearClienteFetch } from '../../shared/api/clienteHttp';
import { crearBitacoraHttp, type BitacoraRepositorio } from '../../features/bitacora';
import { crearCobroHttp, type CobroRepositorio } from '../../features/cobro';
import { crearCuentasHttp, type CuentasRepositorio } from '../../features/cuentas';
import { crearEventosHttp, type EventosRepositorio } from '../../features/eventos';
import { crearLimitesHttp, type LimitesRepositorio } from '../../features/limites';
import { crearEquipoHttp, type EquipoRepositorio } from '../../features/equipo';
import {
  crearNotificacionesHttp,
  type NotificacionesRepositorio,
} from '../../features/notificaciones';
import { crearEstadisticasHttp, type EstadisticasRepositorio } from '../../features/estadisticas';
import { crearPagosHttp, type PagosRepositorio } from '../../features/pagos';
import { crearPlacasHttp, type PlacasRepositorio } from '../../features/placas';
import { crearPlanesHttp, type PlanesRepositorio } from '../../features/planes';
import {
  crearSuscripcionesHttp,
  type SuscripcionesRepositorio,
} from '../../features/suscripciones';
import { crearResumenHttp, type ResumenRepositorio } from '../../features/resumen';
import { crearSeguridadHttp, type SeguridadRepositorio } from '../../features/seguridad';
import { crearSenalesHttp, type SenalesRepositorio } from '../../features/senales';
import { crearSesionesHttp, type SesionesRepositorio } from '../../features/sesiones';
import { crearIncidentesHttp, type IncidentesRepositorio } from '../../features/incidentes';

/** Todo lo inyectable de la aplicación: en producción son las implementaciones HTTP; en tests, mocks. */
export interface Servicios {
  almacen: AlmacenSesion;
  seguridad: SeguridadRepositorio;
  equipo: EquipoRepositorio;
  planes: PlanesRepositorio;
  cobro: CobroRepositorio;
  placas: PlacasRepositorio;
  cuentas: CuentasRepositorio;
  suscripciones: SuscripcionesRepositorio;
  pagos: PagosRepositorio;
  bitacora: BitacoraRepositorio;
  eventos: EventosRepositorio;
  notificaciones: NotificacionesRepositorio;
  resumen: ResumenRepositorio;
  estadisticas: EstadisticasRepositorio;
  limites: LimitesRepositorio;
  senales: SenalesRepositorio;
  sesiones: SesionesRepositorio;
  incidentes: IncidentesRepositorio;
}

/** Compone las implementaciones HTTP sobre un único cliente y almacén de sesión. */
export function crearServicios(
  baseUrl: string,
  alSesionVencida: () => void = () => undefined,
): Servicios {
  const almacen = new AlmacenSesion();
  const cliente = crearClienteFetch({ baseUrl, sesion: almacen, alSesionVencida });
  return {
    almacen,
    seguridad: crearSeguridadHttp(cliente, almacen),
    equipo: crearEquipoHttp(cliente),
    planes: crearPlanesHttp(cliente),
    cobro: crearCobroHttp(cliente),
    placas: crearPlacasHttp(cliente),
    cuentas: crearCuentasHttp(cliente),
    suscripciones: crearSuscripcionesHttp(cliente),
    pagos: crearPagosHttp(cliente),
    bitacora: crearBitacoraHttp(cliente),
    eventos: crearEventosHttp(cliente),
    notificaciones: crearNotificacionesHttp(cliente),
    resumen: crearResumenHttp(cliente),
    estadisticas: crearEstadisticasHttp(cliente),
    limites: crearLimitesHttp(cliente),
    senales: crearSenalesHttp(cliente),
    sesiones: crearSesionesHttp(cliente),
    incidentes: crearIncidentesHttp(cliente),
  };
}
