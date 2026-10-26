import { AlmacenSesion } from '@/shared/api/almacenSesion';
import { ErrorApi } from '@/shared/api/errorApi';
import type { EquipoRepositorio } from '@/features/equipo';
import type { MiembroEquipo } from '@/features/equipo/domain/equipo';
import type { BitacoraRepositorio, EventoBitacora } from '@/features/bitacora';
import type { EventosRepositorio } from '@/features/eventos';
import type { ResumenRepositorio } from '@/features/resumen';
import type { EstadisticasRepositorio, Estadisticas } from '@/features/estadisticas';
import type { PagosRepositorio } from '@/features/pagos';
import type { SuscripcionesRepositorio } from '@/features/suscripciones';
import type { CuentasRepositorio } from '@/features/cuentas';
import type { EstadisticasDeUsuarios, RamaDeAdministrador } from '@/features/cuentas/domain/cuenta';
import type { PlacasRepositorio, Placa } from '@/features/placas';
import type { CobroRepositorio, CuentaDeCobro } from '@/features/cobro';
import type { PlanesRepositorio } from '@/features/planes';
import type { SeguridadRepositorio } from '@/features/seguridad';
import type { Servicios } from '@/app/providers/crearServicios';

export const CUENTAS_DE_COBRO: readonly CuentaDeCobro[] = [
  {
    id: '1',
    metodo: 'transferencia',
    banco: 'Banco Unión',
    titular: 'AGROCOM S.R.L.',
    numeroCuenta: '10000123456',
    tipoCuenta: 'corriente',
    imagenId: null,
    nota: null,
    activo: true,
  },
  {
    id: '2',
    metodo: 'qr',
    banco: 'Banco Mercantil Santa Cruz',
    titular: null,
    numeroCuenta: null,
    tipoCuenta: null,
    imagenId: '50',
    nota: 'Vale para cualquier banco',
    activo: true,
  },
];

export const SUPER_ADMIN = {
  usuario: { id: '1', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
  debeCambiarContrasena: false,
  permisos: [
    'seguridad.equipo.ver',
    'seguridad.equipo.crear',
    'seguridad.equipo.editar',
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
    'seguridad.administrador.crear',
    'seguridad.administrador.reasignar',
    'suscripciones.suscripcion.ver',
    'suscripciones.suscripcion.editar',
    'suscripciones.pago.registrar',
    'suscripciones.cobranza.ver',
    'suscripciones.cobro.ver',
    'suscripciones.cobro.crear',
    'suscripciones.cobro.editar',
    'suscripciones.cobro.eliminar',
    'bitacora.registro.ver',
    'resumen.panel.ver',
    'dispositivos.placa.ver',
    'dispositivos.placa.registrar',
    'dispositivos.placa.vincular',
    'dispositivos.placa.liberar',
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
    maxMiembrosPorTitular: 10,
  },
  empresa: {
    nit: '1023456021',
    ciudad: 'Santa Cruz de la Sierra',
    contacto: 'Carla Méndez',
    contactoNombre: 'Carla',
    contactoApellido: 'Méndez',
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

/** El árbol de la cuenta de ejemplo: dos Administradores, uno con un Titular y un Guardia. */
export const JERARQUIA: readonly RamaDeAdministrador[] = [
  {
    id: '11',
    etiqueta: 'Carla Méndez',
    guardias: [{ id: '21', etiqueta: 'Portería norte' }],
    titulares: [{ id: '31', etiqueta: 'Jorge Rivero', unidad: 'Casa 12', miembros: 3 }],
  },
  { id: '12', etiqueta: 'Rosa Vaca', guardias: [], titulares: [] },
];

/** El uso de los usuarios de la cuenta de ejemplo: un inactivo, un ruidoso y un Titular cerca del tope. */
export const ESTADISTICAS_DE_USUARIOS: EstadisticasDeUsuarios = {
  ventanaDias: 30,
  umbralInactivoDias: 30,
  umbralRuidosoPorDia: 10,
  usuarios: [
    {
      id: '31',
      etiqueta: 'Jorge Rivero',
      rol: 'Titular',
      unidad: 'Casa 12',
      qrGenerados: 40,
      qrUsados: 2,
      maxQrEnUnDia: 14,
      ultimoQrEn: null,
      inactivo: false,
      ruidoso: true,
    },
    {
      id: '41',
      etiqueta: 'Marta Soliz',
      rol: 'Miembro',
      unidad: null,
      qrGenerados: 0,
      qrUsados: 0,
      maxQrEnUnDia: 0,
      ultimoQrEn: null,
      inactivo: true,
      ruidoso: false,
    },
    {
      id: '42',
      etiqueta: 'Luis Peña',
      rol: 'Guardia',
      unidad: null,
      qrGenerados: 0,
      qrUsados: 0,
      maxQrEnUnDia: 0,
      ultimoQrEn: new Date('2026-09-02T15:00:00Z'),
      inactivo: true,
      ruidoso: false,
    },
  ],
  titulares: [
    {
      id: '31',
      etiqueta: 'Jorge Rivero',
      unidad: 'Casa 12',
      miembros: 9,
      tope: 10,
      porcentaje: 90,
      cercaDelTope: true,
    },
    {
      id: '32',
      etiqueta: 'Rosa Vaca',
      unidad: 'Casa 3',
      miembros: 1,
      tope: 10,
      porcentaje: 10,
      cercaDelTope: false,
    },
  ],
  ramas: [
    { id: '11', etiqueta: 'Carla Méndez', usuarios: 5 },
    { id: '12', etiqueta: 'Rosa Vaca', usuarios: 0 },
  ],
};

export const PLACAS: Placa[] = [
  {
    id: '1',
    mac: 'AA:BB:CC:00:11:22',
    estado: 'vinculada',
    firmware: '1.4.0',
    ip: '192.168.1.40',
    ultimoContactoEn: new Date(),
    enLinea: true,
    porConfirmarHasta: null,
    dispositivo: { id: '7', nombre: 'Portón vehicular' },
    cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
    puerta: { id: '1', nombre: 'Portón vehicular' },
  },
  {
    id: '2',
    mac: 'AA:BB:CC:00:11:33',
    estado: 'detectada',
    firmware: '1.4.0',
    ip: '192.168.1.41',
    ultimoContactoEn: new Date(),
    enLinea: true,
    porConfirmarHasta: null,
    dispositivo: null,
    cuenta: null,
    puerta: null,
  },
  {
    id: '3',
    mac: 'AA:BB:CC:00:11:44',
    estado: 'por_confirmar',
    firmware: '1.4.0',
    ip: '192.168.1.42',
    ultimoContactoEn: new Date(),
    enLinea: true,
    porConfirmarHasta: new Date(Date.now() + 5 * 60_000),
    dispositivo: null,
    cuenta: null,
    puerta: null,
  },
];

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
      comprobanteId: '77',
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
  dispositivos: {
    enLinea: 1,
    sinConexion: 1,
    lista: [
      {
        id: '2',
        nombre: 'Controlador portón',
        puerta: 'Portón norte',
        cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
        firmware: '1.0.0',
        enLinea: false,
        ultimoLatidoEn: new Date('2026-10-12T10:00:00Z'),
      },
      {
        id: '1',
        nombre: 'Controlador principal',
        puerta: 'Puerta principal',
        cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
        firmware: '1.0.0',
        enLinea: true,
        ultimoLatidoEn: new Date('2026-10-12T14:41:00Z'),
      },
    ],
  },
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
    cobro?: Partial<CobroRepositorio>;
    placas?: Partial<PlacasRepositorio>;
    eventos?: Partial<EventosRepositorio>;
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
    cambiarNombre: () => Promise.resolve(),
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
    reactivar: () => Promise.resolve(),
    renombrar: () => Promise.resolve(),
    ...parcial.equipo,
  };
  const cobro: CobroRepositorio = {
    listar: () => Promise.resolve(CUENTAS_DE_COBRO),
    crear: () => Promise.resolve(),
    editar: () => Promise.resolve(),
    cambiarActivo: () => Promise.resolve(),
    eliminar: () => Promise.resolve(),
    verImagen: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })),
    ...parcial.cobro,
  };
  const planes: PlanesRepositorio = {
    listar: () => Promise.resolve(PLANES),
    crear: () => Promise.resolve(),
    editar: () => Promise.resolve(),
    retirar: () => Promise.resolve('retirado' as const),
    ...parcial.planes,
  };
  const placas: PlacasRepositorio = {
    listar: () =>
      Promise.resolve({ elementos: PLACAS, pagina: 1, porPagina: 10, total: PLACAS.length }),
    vincular: () => Promise.resolve({ porConfirmarHasta: new Date(Date.now() + 10 * 60_000) }),
    cancelarVinculo: () => Promise.resolve(),
    liberar: () => Promise.resolve(),
    darDeBaja: () => Promise.resolve(),
    ...parcial.placas,
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
    crearAdministrador: (_cuentaId, datos) =>
      Promise.resolve({ id: '99', etiqueta: datos.etiqueta, pin: 'AGR9X8Z' }),
    jerarquia: () => Promise.resolve(JERARQUIA),
    estadisticasDeUsuarios: () => Promise.resolve(ESTADISTICAS_DE_USUARIOS),
    reasignar: () => Promise.resolve(),
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
    verComprobante: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })),
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
  const eventos: EventosRepositorio = {
    listar: () => Promise.resolve({ elementos: [], pagina: 1, porPagina: 15, total: 0 }),
    cuentas: () => Promise.resolve([{ id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' }]),
    ...parcial.eventos,
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
    cobro,
    placas,
    cuentas,
    suscripciones,
    pagos,
    bitacora,
    eventos,
    resumen,
    estadisticas,
  };
}

export { ErrorApi };
