import { AlmacenSesion } from '@/shared/api/almacenSesion';
import { ErrorApi } from '@/shared/api/errorApi';
import type { EquipoRepositorio } from '@/features/equipo';
import type { MiembroEquipo } from '@/features/equipo/domain/equipo';
import type { CuentasRepositorio } from '@/features/cuentas';
import type { PlanesRepositorio } from '@/features/planes';
import type { SeguridadRepositorio } from '@/features/seguridad';
import type { Servicios } from '@/app/providers/crearServicios';

export const SUPER_ADMIN = {
  usuario: { id: '1', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
  debeCambiarContrasena: false,
  permisos: [
    'seguridad.equipo.ver',
    'seguridad.equipo.crear',
    'seguridad.equipo.desactivar',
    'suscripciones.plan.ver',
    'suscripciones.plan.editar',
    'seguridad.cuenta.ver',
    'seguridad.cuenta.crear',
  ],
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

export const PLANES = [
  {
    id: '1',
    nombre: '100 usuarios',
    cupoUsuarios: 100,
    precioAnual: 12000,
    cuentas: 21,
    usuariosEnUso: 1604,
  },
  {
    id: '2',
    nombre: '200 usuarios',
    cupoUsuarios: 200,
    precioAnual: 21600,
    cuentas: 14,
    usuariosEnUso: 2140,
  },
  {
    id: '3',
    nombre: '350 usuarios',
    cupoUsuarios: 350,
    precioAnual: 33600,
    cuentas: 7,
    usuariosEnUso: 1470,
  },
];

export const CUENTAS = [
  {
    id: '1',
    codigo: 'AGR',
    nombre: 'Agroindustrial Norte',
    plan: { id: '1', nombre: '100 usuarios', cupoUsuarios: 100 },
    usuariosActivos: 87,
    venceEl: new Date('2026-11-05T12:00:00Z'),
    estado: 'porVencer' as const,
  },
  {
    id: '2',
    codigo: 'FRO',
    nombre: 'Frigorífico Oriente',
    plan: { id: '2', nombre: '200 usuarios', cupoUsuarios: 200 },
    usuariosActivos: 164,
    venceEl: new Date('2027-03-22T12:00:00Z'),
    estado: 'activa' as const,
  },
];

export const DETALLE = {
  cuenta: {
    id: '1',
    codigo: 'AGR',
    nombre: 'Agroindustrial Norte',
    activa: true,
    clienteDesde: new Date('2024-11-05T12:00:00Z'),
  },
  empresa: {
    nit: '1023456021',
    ciudad: 'Santa Cruz de la Sierra',
    contacto: 'Carla Méndez',
    telefono: '3 342 1180',
  },
  suscripcion: {
    id: '5',
    plan: { id: '1', nombre: '100 usuarios', cupoUsuarios: 100, precioAnual: 12000 },
    desde: new Date('2025-11-05T12:00:00Z'),
    hasta: new Date('2026-11-05T12:00:00Z'),
    estado: 'porVencer' as const,
    diasRestantes: 24,
  },
  uso: {
    usuariosActivos: 87,
    sitios: 2,
    puertas: 5,
    dispositivosSinConexion: 2,
    administradores: 2,
  },
};

export const SITIOS = [
  {
    id: '1',
    nombre: 'Planta Warnes',
    puertas: [
      {
        id: '1',
        nombre: 'Portón vehicular',
        dispositivo: { id: '1', nombre: 'LECT-0042', enLinea: true, ultimaSenal: new Date() },
      },
      {
        id: '2',
        nombre: 'Depósito 2',
        dispositivo: {
          id: '2',
          nombre: 'LECT-0051',
          enLinea: false,
          ultimaSenal: new Date(Date.now() - 2 * 3_600_000),
        },
      },
    ],
  },
];

/** Servicios en memoria para tests de interfaz: mismos contratos que los HTTP (LSP). */
export function crearServiciosDePrueba(
  parcial: {
    seguridad?: Partial<SeguridadRepositorio>;
    equipo?: Partial<EquipoRepositorio>;
    planes?: Partial<PlanesRepositorio>;
    cuentas?: Partial<CuentasRepositorio>;
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
  const planes: PlanesRepositorio = {
    listar: () => Promise.resolve(PLANES),
    guardarPrecios: () => Promise.resolve(),
    ...parcial.planes,
  };
  const cuentas: CuentasRepositorio = {
    listar: () =>
      Promise.resolve({
        elementos: CUENTAS,
        pagina: 1,
        porPagina: 10,
        total: CUENTAS.length,
        conteos: { todas: 42, activa: 33, porVencer: 5, vencida: 2, suspendida: 2 },
      }),
    codigoDisponible: (codigo) =>
      Promise.resolve({
        formatoValido: codigo.length === 3,
        disponible: codigo !== 'AGR',
        usadoPor: codigo === 'AGR' ? 'Agroindustrial Norte' : null,
        sugerencias: ['AGU', 'AGY', 'GUA'],
      }),
    crear: (borrador) =>
      Promise.resolve({
        cuenta: { id: '77', codigo: borrador.empresa.codigo, nombre: borrador.empresa.razonSocial },
        administrador: {
          id: '88',
          etiqueta: borrador.vigencia.administradorNombre,
          pin: 'AGU9F4M',
        },
      }),
    obtener: () => Promise.resolve(DETALLE),
    sitiosYPuertas: () => Promise.resolve(SITIOS),
    ...parcial.cuentas,
  };
  return { almacen, seguridad, equipo, planes, cuentas };
}

export { ErrorApi };
