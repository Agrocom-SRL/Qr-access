import { AlmacenSesion } from '../../shared/api/almacenSesion';
import { crearClienteFetch } from '../../shared/api/clienteHttp';
import { crearBitacoraHttp, type BitacoraRepositorio } from '../../features/bitacora';
import { crearCuentasHttp, type CuentasRepositorio } from '../../features/cuentas';
import { crearEquipoHttp, type EquipoRepositorio } from '../../features/equipo';
import { crearPagosHttp, type PagosRepositorio } from '../../features/pagos';
import { crearPlanesHttp, type PlanesRepositorio } from '../../features/planes';
import {
  crearSuscripcionesHttp,
  type SuscripcionesRepositorio,
} from '../../features/suscripciones';
import { crearResumenHttp, type ResumenRepositorio } from '../../features/resumen';
import { crearSeguridadHttp, type SeguridadRepositorio } from '../../features/seguridad';

/** Todo lo inyectable de la aplicación: en producción son las implementaciones HTTP; en tests, mocks. */
export interface Servicios {
  almacen: AlmacenSesion;
  seguridad: SeguridadRepositorio;
  equipo: EquipoRepositorio;
  planes: PlanesRepositorio;
  cuentas: CuentasRepositorio;
  suscripciones: SuscripcionesRepositorio;
  pagos: PagosRepositorio;
  bitacora: BitacoraRepositorio;
  resumen: ResumenRepositorio;
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
    cuentas: crearCuentasHttp(cliente),
    suscripciones: crearSuscripcionesHttp(cliente),
    pagos: crearPagosHttp(cliente),
    bitacora: crearBitacoraHttp(cliente),
    resumen: crearResumenHttp(cliente),
  };
}
