import { AlmacenSesion } from '../../shared/api/almacenSesion';
import { crearClienteFetch } from '../../shared/api/clienteHttp';
import { crearCuentasHttp, type CuentasRepositorio } from '../../features/cuentas';
import { crearEquipoHttp, type EquipoRepositorio } from '../../features/equipo';
import { crearPlanesHttp, type PlanesRepositorio } from '../../features/planes';
import { crearSeguridadHttp, type SeguridadRepositorio } from '../../features/seguridad';

/** Todo lo inyectable de la aplicación: en producción son las implementaciones HTTP; en tests, mocks. */
export interface Servicios {
  almacen: AlmacenSesion;
  seguridad: SeguridadRepositorio;
  equipo: EquipoRepositorio;
  planes: PlanesRepositorio;
  cuentas: CuentasRepositorio;
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
  };
}
