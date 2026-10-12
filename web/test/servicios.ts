import { AlmacenSesion } from '@/shared/api/almacenSesion';
import { ErrorApi } from '@/shared/api/errorApi';
import type { EquipoRepositorio } from '@/features/equipo';
import type { MiembroEquipo } from '@/features/equipo/domain/equipo';
import type { SeguridadRepositorio } from '@/features/seguridad';
import type { Servicios } from '@/app/providers/crearServicios';

export const SUPER_ADMIN = {
  usuario: { id: '1', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
  debeCambiarContrasena: false,
  permisos: ['seguridad.equipo.ver', 'seguridad.equipo.crear', 'seguridad.equipo.desactivar'],
} as const;

export const MIEMBROS: MiembroEquipo[] = [
  {
    id: '1',
    nombre: 'Lucía Paz',
    usuario: 'lucia.paz',
    activo: true,
    esActual: true,
    ultimoIngresoEn: new Date(),
  },
  {
    id: '2',
    nombre: 'Marco Suárez',
    usuario: 'marco.suarez',
    activo: true,
    esActual: false,
    ultimoIngresoEn: null,
  },
  {
    id: '3',
    nombre: 'Diego Rojas',
    usuario: 'diego.rojas',
    activo: false,
    esActual: false,
    ultimoIngresoEn: null,
  },
];

/** Servicios en memoria para tests de interfaz: mismos contratos que los HTTP (LSP). */
export function crearServiciosDePrueba(
  parcial: {
    seguridad?: Partial<SeguridadRepositorio>;
    equipo?: Partial<EquipoRepositorio>;
  } = {},
): Servicios {
  const almacen = new AlmacenSesion();
  const seguridad: SeguridadRepositorio = {
    ingresar: () => Promise.resolve({ ...SUPER_ADMIN, permisos: [...SUPER_ADMIN.permisos] }),
    cerrarSesion: () => {
      almacen.limpiar();
      return Promise.resolve();
    },
    obtenerPerfil: () =>
      Promise.resolve({
        ...SUPER_ADMIN.usuario,
        creadoEn: new Date('2024-03-10T12:00:00Z'),
        ultimoIngresoEn: new Date('2026-10-12T12:12:00Z'),
        debeCambiarContrasena: false,
        permisos: [...SUPER_ADMIN.permisos],
      }),
    cambiarContrasena: () => Promise.resolve(),
    ...parcial.seguridad,
  };
  // Como la implementación HTTP: un ingreso correcto deja los tokens en el almacén.
  const ingresar = seguridad.ingresar;
  seguridad.ingresar = async (usuario, contrasena) => {
    const sesion = await ingresar(usuario, contrasena);
    almacen.guardar({ acceso: 'a', refresco: 'r' });
    return sesion;
  };
  const equipo: EquipoRepositorio = {
    listar: () => Promise.resolve({ miembros: MIEMBROS, activos: 2 }),
    usuarioDisponible: () => Promise.resolve(true),
    agregar: (nuevo) =>
      Promise.resolve({
        id: '9',
        nombre: nuevo.nombre,
        usuario: nuevo.usuario,
        activo: true,
        esActual: false,
        ultimoIngresoEn: null,
      }),
    desactivar: () => Promise.resolve(),
    ...parcial.equipo,
  };
  return { almacen, seguridad, equipo };
}

export { ErrorApi };
