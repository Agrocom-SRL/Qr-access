import { AlmacenSesion } from '@/shared/api/almacenSesion';
import { ErrorApi } from '@/shared/api/errorApi';
import type { EquipoRepositorio } from '@/features/equipo';
import type { MiembroEquipo } from '@/features/equipo/domain/equipo';
import type { BitacoraRepositorio, EventoBitacora } from '@/features/bitacora';
import type { ResumenRepositorio } from '@/features/resumen';
import type { EstadisticasRepositorio, Estadisticas } from '@/features/estadisticas';
import type { PagosRepositorio } from '@/features/pagos';
import type { SuscripcionesRepositorio } from '@/features/suscripciones';
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
    'suscripciones.plan.crear',
    'suscripciones.plan.editar',
    'suscripciones.plan.eliminar',
    'seguridad.cuenta.ver',
    'seguridad.cuenta.crear',
    'seguridad.cuenta.cambiar_codigo',
    'seguridad.cuenta.editar',
    'seguridad.cuenta.eliminar',
    'organizacion.sitio.gestionar',
    'organizacion.puerta.gestionar',
    'seguridad.administrador.regenerar_pin',
    'suscripciones.suscripcion.ver',
    'suscripciones.suscripcion.editar',
    'suscripciones.pago.registrar',
    'suscripciones.cobranza.ver',
    'bitacora.registro.ver',
    'resumen.panel.ver',
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

/** Códigos que ya tienen dueña en los mocks. */
const OCUPADOS: Readonly<Record<string, string>> = {
  AGR: 'Agroindustrial Norte',
  FRO: 'Frigorífico Oriente',
};

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
    correo: 'carla@agroindustrialnorte.bo',
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
    direccion: 'Ruta 4 km 12' as string | null,
    zonaHoraria: 'America/La_Paz',
    activo: true,
    puertas: [
      {
        id: '1',
        nombre: 'Portón vehicular',
        segundosApertura: 5,
        activa: true,
        dispositivo: { id: '1', nombre: 'LECT-0042', enLinea: true, ultimaSenal: new Date() },
      },
      {
        id: '2',
        nombre: 'Depósito 2',
        segundosApertura: 8,
        activa: true,
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

export const SUSCRIPCION = {
  cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
  suscripcion: {
    id: '5',
    plan: { id: '1', nombre: '100 usuarios', cupoUsuarios: 100, precioAnual: 12000 },
    desde: new Date('2025-11-05T12:00:00Z'),
    hasta: new Date('2026-11-05T12:00:00Z'),
    estado: 'porVencer' as const,
    diasRestantes: 24,
  },
  proximoPago: 'pendiente' as const,
  pagos: [
    {
      id: '9',
      tipo: 'renovacion' as const,
      plan: '100 usuarios',
      monto: 12000,
      fechaPago: '2025-10-30',
      medio: 'transferencia' as const,
      referencia: 'TRF-884120',
      periodoDesde: new Date('2025-11-05T12:00:00Z'),
      periodoHasta: new Date('2026-11-05T12:00:00Z'),
      registro: { id: '1', nombre: 'Lucía Paz' },
    },
  ],
};

export const EVENTOS: EventoBitacora[] = [
  {
    id: '1',
    ocurridoEn: new Date(),
    usuario: { id: '1', nombre: 'Lucía Paz' },
    cuenta: { id: '2', codigo: 'FRO' },
    accion: 'creado' as const,
    codigo: 'pago.registrado',
    canal: 'panel' as const,
    antes: null,
    despues: { monto: 12000, referencia: 'TRF-1' },
  },
  {
    id: '2',
    ocurridoEn: new Date('2026-10-09T22:30:00Z'),
    usuario: { id: '3', nombre: 'Marco Suárez' },
    cuenta: { id: '1', codigo: 'AVC' },
    accion: 'actualizado' as const,
    codigo: 'suscripcion.plan_cambiado',
    canal: 'panel' as const,
    antes: { plan: '100 usuarios' },
    despues: { plan: '200 usuarios' },
  },
  {
    id: '3',
    ocurridoEn: new Date('2026-10-11T04:00:00Z'),
    usuario: null,
    cuenta: { id: '4', codigo: 'LAM' },
    accion: 'actualizado' as const,
    codigo: 'suscripcion.suspendida',
    canal: 'automatico' as const,
    antes: { estado: 'vigente' },
    despues: { estado: 'suspendida' },
  },
];

export const RESUMEN = {
  actualizadoEn: new Date('2026-10-12T14:42:00Z'),
  cuentas: { activas: 38, total: 42, porVencer: 5 },
  usuarios: { enUso: 5214, cupoVendido: 7650 },
  porVencer30: { cuentas: 5, monto: 100800 },
  ingresosEsperados: 812400,
  renovaciones: [
    {
      cuenta: { id: '1', codigo: 'SDE', nombre: 'Semillas del Este' },
      venceEl: new Date('2026-10-18T12:00:00Z'),
      diasRestantes: 6,
      monto: 12000,
      estado: 'porVencer' as const,
    },
    {
      cuenta: { id: '2', codigo: 'LAM', nombre: 'Lácteos Montero' },
      venceEl: new Date('2026-10-02T12:00:00Z'),
      diasRestantes: -10,
      monto: 21600,
      estado: 'vencida' as const,
    },
  ],
  ultimasAcciones: EVENTOS,
};

export const ESTADISTICAS: Estadisticas = {
  cobradoPorMes: Array.from({ length: 12 }, (_, i) => ({
    mes: `2026-${String(i + 1).padStart(2, '0')}`,
    monto: i === 9 ? 24_000 : 0,
    pagos: i === 9 ? 2 : 0,
  })),
  altasPorMes: Array.from({ length: 12 }, (_, i) => ({
    mes: `2026-${String(i + 1).padStart(2, '0')}`,
    cuentas: i === 9 ? 3 : 0,
  })),
  cuentasPorEstado: { activa: 30, porVencer: 5, vencida: 2, suspendida: 1, pendientePago: 2 },
  cuentasPorPlan: [
    { plan: '100 usuarios', cuentas: 24, cupoUsuarios: 100 },
    { plan: '200 usuarios', cuentas: 14, cupoUsuarios: 200 },
  ],
  accesosPorDia: Array.from({ length: 14 }, (_, i) => ({
    dia: `2026-10-${String(i + 1).padStart(2, '0')}`,
    permitidos: 10 + i,
    rechazados: i % 3,
  })),
};

export const COBRANZA = {
  totales: {
    porCobrar30: { monto: 100800, cuentas: 5 },
    porCobrar90: { monto: 298800, cuentas: 14 },
    vencidoSinPagar: { monto: 33600, cuentas: 2 },
    porActivar: { monto: 24000, cuentas: 2 },
    cobradoAnio: { anio: 2026, monto: 513600, pagos: 27 },
  },
  conteos: { d30: 5, d60: 9, d90: 14, vencidas: 2, pendientes: 2 },
  filas: [
    {
      cuenta: { id: '1', codigo: 'SDE', nombre: 'Semillas del Este' },
      plan: { id: '1', nombre: '100 usuarios', cupoUsuarios: 100 },
      monto: 12000,
      venceEl: new Date('2026-10-18T12:00:00Z'),
      diasRestantes: 6,
      pago: 'pendiente' as const,
      estado: 'porVencer' as const,
    },
  ],
};

/** Servicios en memoria para tests de interfaz: mismos contratos que los HTTP (LSP). */
export function crearServiciosDePrueba(
  parcial: {
    seguridad?: Partial<SeguridadRepositorio>;
    equipo?: Partial<EquipoRepositorio>;
    planes?: Partial<PlanesRepositorio>;
    cuentas?: Partial<CuentasRepositorio>;
    suscripciones?: Partial<SuscripcionesRepositorio>;
    pagos?: Partial<PagosRepositorio>;
    bitacora?: Partial<BitacoraRepositorio>;
    resumen?: Partial<ResumenRepositorio>;
    estadisticas?: Partial<EstadisticasRepositorio>;
  } = {},
): Servicios {
  const almacen = new AlmacenSesion();
  const seguridad: SeguridadRepositorio = {
    restaurar: () => Promise.resolve(null),
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
    crear: () => Promise.resolve(),
    editar: () => Promise.resolve(),
    retirar: () => Promise.resolve('retirado' as const),
    ...parcial.planes,
  };
  const cuentas: CuentasRepositorio = {
    listar: () =>
      Promise.resolve({
        elementos: CUENTAS,
        pagina: 1,
        porPagina: 10,
        total: CUENTAS.length,
        conteos: {
          todas: 42,
          activa: 33,
          porVencer: 5,
          vencida: 2,
          suspendida: 2,
          pendientePago: 0,
        },
      }),
    codigoDisponible: (codigo) =>
      Promise.resolve({
        formatoValido: codigo.length === 3,
        disponible: !(codigo in OCUPADOS),
        usadoPor: OCUPADOS[codigo] ?? null,
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
        estado: borrador.pago.modo === 'ahora' ? ('activa' as const) : ('pendientePago' as const),
      }),
    administradores: () =>
      Promise.resolve([
        {
          id: '11',
          etiqueta: 'Carla Méndez',
          pinGeneradoEn: new Date('2026-09-01T12:00:00Z'),
          ultimoIngresoEn: null,
        },
      ]),
    regenerarPin: () => Promise.resolve('AGR7K2Q'),
    cambiarCodigo: () => Promise.resolve(),
    obtener: () => Promise.resolve(DETALLE),
    editar: () => Promise.resolve(),
    eliminar: () => Promise.resolve(),
    sitiosYPuertas: () => Promise.resolve(SITIOS),
    crearSitio: () => Promise.resolve(),
    editarSitio: () => Promise.resolve(),
    eliminarSitio: () => Promise.resolve(),
    crearPuerta: () => Promise.resolve(),
    editarPuerta: () => Promise.resolve(),
    eliminarPuerta: () => Promise.resolve(),
    ...parcial.cuentas,
  };
  const suscripciones: SuscripcionesRepositorio = {
    obtener: () => Promise.resolve(SUSCRIPCION),
    cambiarPlan: () =>
      Promise.resolve({
        plan: { id: '2', nombre: '200 usuarios', cupoUsuarios: 200 },
        diferenciaPrecio: 9600,
      }),
    suspender: () => Promise.resolve(),
    reactivar: () => Promise.resolve(),
    ...parcial.suscripciones,
  };
  const pagos: PagosRepositorio = {
    registrar: () =>
      Promise.resolve({
        periodoDesde: new Date('2026-11-05T12:00:00Z'),
        periodoHasta: new Date('2027-11-05T12:00:00Z'),
        venceEl: new Date('2027-11-05T12:00:00Z'),
      }),
    cobranza: () => Promise.resolve(COBRANZA),
    ...parcial.pagos,
  };
  const bitacora: BitacoraRepositorio = {
    listar: () => Promise.resolve({ elementos: EVENTOS, pagina: 1, porPagina: 10, total: 184 }),
    cuentas: () => Promise.resolve([{ id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' }]),
    ...parcial.bitacora,
  };
  const resumen: ResumenRepositorio = {
    obtener: () => Promise.resolve(RESUMEN),
    ...parcial.resumen,
  };
  const estadisticas: EstadisticasRepositorio = {
    obtener: () => Promise.resolve(ESTADISTICAS),
    ...parcial.estadisticas,
  };
  return {
    almacen,
    seguridad,
    equipo,
    planes,
    cuentas,
    suscripciones,
    pagos,
    bitacora,
    resumen,
    estadisticas,
  };
}

export { ErrorApi };
