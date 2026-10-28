import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';
import { PLATAFORMAS } from './domain/sesion.js';

export const esquemaId = z.string().regex(/^\d{1,19}$/);
const esquemaFecha = z.string();

const esquemaRol = z.object({ id: z.string(), nombre: z.string() });

/** Los estados que se guardan (ADR 0033 §1); «eliminado» es el soft delete y no se lista. */
export const esquemaEstado = z.enum(['activo', 'restringido', 'suspendido']);
const esquemaOrigenDeEstado = z.enum(['usuario', 'superior', 'cuenta']);

/** Por qué se restringe o se suspende: obligatorio y corto (`estado_motivo` es VARCHAR(200)). */
export const MAX_MOTIVO_DE_ESTADO = 200;
export const cuerpoDeCambioDeEstado = z.strictObject({
  motivo: z.string().trim().min(1).max(MAX_MOTIVO_DE_ESTADO),
});

/**
 * De dónde entra quien inicia sesión (ADR 0030 §4.1), todo opcional (un cliente anterior sigue entrando).
 * `instalacion_id` es un identificador ALEATORIO que la app genera y guarda localmente (16 a 64 caracteres
 * URL-safe, por ejemplo un UUID): nunca el IMEI, el identificador de publicidad ni otra huella del aparato.
 */
const camposDeOrigenDeSesion = {
  instalacion_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,64}$/)
    .optional(),
  plataforma: z.enum(PLATAFORMAS).optional(),
  /** Nombre corto del aparato o navegador; no es dato personal ni sensible. */
  dispositivo: z.string().trim().min(1).max(60).optional(),
};

export const cuerpoDeIngreso = z.strictObject({
  pin: z.string().min(1).max(32),
  ...camposDeOrigenDeSesion,
});

export const esquemaSesionAbierta = z.object({
  id: z.string(),
  plataforma: z.enum(PLATAFORMAS).nullable(),
  dispositivo: z.string().nullable(),
  ip: z.string().nullable(),
  iniciada_at: esquemaFecha,
  ultima_actividad_at: esquemaFecha,
  expira_at: esquemaFecha,
  actual: z.boolean(),
});
export const respuestaListadoDeSesiones = esquemaListado(esquemaSesionAbierta);
export const respuestaDeSesionesCerradas = z.object({ cerradas: z.number().int() });
export const parametrosDeSesion = z.object({ id: esquemaId });
export const parametrosDeSesionDeUsuario = z.object({ id: esquemaId, sesionId: esquemaId });
export const parametrosDeSesionDeUsuarioDeCuenta = z.object({
  id: esquemaId,
  usuarioId: esquemaId,
  sesionId: esquemaId,
});

/**
 * El refresco va en el cuerpo para la app nativa; un cliente de navegador lo recibe en una cookie
 * `HttpOnly` y el cuerpo no lo trae (ADR 0033 §5).
 */
const refrescoEnElCuerpo = z.string().optional();

export const respuestaDeIngreso = z.object({
  acceso: z.string(),
  refresco: refrescoEnElCuerpo,
  usuario: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  roles: z.array(esquemaRol),
  rol_activo_id: z.string().nullable(),
});

/** Sin `refresco`, un cliente de navegador lo presenta en su cookie. */
export const cuerpoDeRefresco = z.strictObject({ refresco: z.string().min(1).max(256).optional() });

export const respuestaDeRefresco = z.object({ acceso: z.string(), refresco: refrescoEnElCuerpo });

export const respuestaDeSesionActual = z.object({
  usuario: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  roles: z.array(esquemaRol),
  rol_activo: esquemaRol.nullable(),
  permisos: z.array(z.string()),
  suscripcion: z.object({ plan: z.string(), hasta: esquemaFecha }).nullable(),
  estado: z.enum(['activo', 'restringido']),
  estado_origen: esquemaOrigenDeEstado.nullable(),
});

/** Largo de `usuarios.etiqueta`. */
export const MAX_ETIQUETA_DE_USUARIO = 80;
/** Tope máximo que puede fijar AGROCOM para los Miembros de un Titular. */
const MAX_MIEMBROS_POR_TITULAR = 500;
/** Largo de `unidades.nombre`. */
const MAX_NOMBRE_DE_UNIDAD = 80;

export const esquemaUsuario = z.object({
  id: z.string(),
  etiqueta: z.string().nullable(),
  activo: z.boolean(),
  estado: esquemaEstado,
  estado_efectivo: esquemaEstado,
  estado_origen: esquemaOrigenDeEstado.nullable(),
  estado_motivo: z.string().nullable(),
  estado_desde: esquemaFecha.nullable(),
  estado_impuesto_por: z.string().nullable(),
  roles: z.array(esquemaRol),
  unidad: z.object({ id: z.string(), nombre: z.string(), sitio_id: z.string() }).nullable(),
  pin_generado_at: esquemaFecha.nullable(),
  ultimo_ingreso_at: esquemaFecha.nullable(),
  created_at: esquemaFecha,
});

export const respuestaListadoDeUsuarios = esquemaListado(esquemaUsuario);

export const respuestaDeEstadoDeUsuario = esquemaUsuario.pick({
  id: true,
  estado: true,
  estado_efectivo: true,
  estado_origen: true,
  estado_motivo: true,
  estado_desde: true,
  estado_impuesto_por: true,
});

const esquemaEtiqueta = z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO);
/** Un usuario tiene un solo rol (ADR 0028 §2): la lista se conserva por compatibilidad, con exactamente uno. */
const esquemaRolIds = z.array(esquemaId).length(1);

/** Los 4 caracteres finales del PIN elegidos por el administrador: `A`–`Z` y `0`–`9`, sin distinguir mayúsculas. */
const esquemaSufijoDePin = z
  .string()
  .regex(/^[A-Za-z0-9]{4}$/)
  .transform((sufijo) => sufijo.toUpperCase());

/** La unidad de un Titular (ADR 0028): en qué propiedad está y cómo se llama ("Casa 12"). */
const esquemaUnidadNueva = z.strictObject({
  sitio_id: esquemaId,
  nombre: z.string().trim().min(1).max(MAX_NOMBRE_DE_UNIDAD),
});

export const cuerpoDeNuevoUsuario = z.strictObject({
  etiqueta: esquemaEtiqueta,
  rol_ids: esquemaRolIds,
  sufijo: esquemaSufijoDePin.optional(),
  /** Obligatoria al crear un Titular y prohibida para los demás niveles. */
  unidad: esquemaUnidadNueva.optional(),
});

/** Regenerar el PIN: sin cuerpo (lo sortea el servidor) o con el sufijo elegido. */
export const cuerpoDeRegeneracionDePin = z.strictObject({ sufijo: esquemaSufijoDePin.optional() });

/**
 * Lo que una persona edita de sí misma: su nombre. No es estricto a propósito: los tests de
 * perfil mandan `id` de otro usuario y exigen que se ignore (mass assignment); pasarlo a 400
 * cambia el contrato (ADR 0005) y queda para una decisión aparte.
 */
export const cuerpoDeMiPerfil = z.object({ etiqueta: esquemaEtiqueta });

export const respuestaDeMiPerfil = z.object({ id: z.string(), etiqueta: z.string() });

/** El PIN en claro va solo acá, una vez (ADR 0018 §3). */
export const respuestaDeUsuarioCreado = esquemaUsuario.extend({ pin: z.string() });

/** Solo el nombre se edita (no estricto: un `rol_ids` de más se ignora, ver `cuerpoDeMiPerfil`): el rol define el nivel en el árbol y no cambia (ADR 0028 §2). */
export const cuerpoDeEdicionDeUsuario = z.object({ etiqueta: esquemaEtiqueta });

export const parametrosDeUsuario = z.object({ id: esquemaId });

/** `?confirmar=true`: acepta la baja en cascada de lo que cuelga del usuario (ADR 0028 §7). */
export const consultaDeBaja = z.object({
  confirmar: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true'),
});

export const respuestaDeCupo = z.object({
  usados: z.number(),
  maximo: z.number().nullable(),
  porcentaje: z.number().nullable(),
  aviso: z.enum(['cerca_del_limite', 'limite_alcanzado']).nullable(),
  max_miembros_por_titular: z.number(),
});

export const respuestaDePinGenerado = z.object({ pin: z.string(), pin_generado_at: esquemaFecha });

export const respuestaListadoDeRoles = z.object({ datos: z.array(esquemaRol) });

// --- Equipo AGROCOM (super admin, web admin) ---

export const cuerpoDeIngresoDePlataforma = z.strictObject({
  usuario: z.string().min(1).max(60),
  contrasena: z.string().min(1).max(128),
  ...camposDeOrigenDeSesion,
});

export const respuestaDeIngresoDePlataforma = z.object({
  acceso: z.string(),
  refresco: refrescoEnElCuerpo,
  usuario: z.object({ id: z.string(), nombre: z.string().nullable(), usuario: z.string() }),
  debe_cambiar_contrasena: z.boolean(),
  permisos: z.array(z.string()),
});

export const respuestaDePerfilDePlataforma = z.object({
  id: z.string(),
  nombre: z.string().nullable(),
  usuario: z.string(),
  creado_at: esquemaFecha,
  ultimo_ingreso_at: esquemaFecha.nullable(),
  debe_cambiar_contrasena: z.boolean(),
  permisos: z.array(z.string()),
});

export const cuerpoDeCambioDeContrasena = z.strictObject({
  actual: z.string().min(1).max(128),
  nueva: z.string().min(1).max(128),
});

const esquemaMiembroDelEquipo = z.object({
  id: z.string(),
  nombre: z.string().nullable(),
  usuario: z.string(),
  activo: z.boolean(),
  estado: esquemaEstado,
  es_actual: z.boolean(),
  ultimo_ingreso_at: esquemaFecha.nullable(),
  created_at: esquemaFecha,
});

export const respuestaDelEquipo = esquemaListado(esquemaMiembroDelEquipo).extend({
  activos: z.number().int(),
});

export const respuestaDeMiembroCreado = esquemaMiembroDelEquipo;

export const cuerpoDeNuevoMiembro = z.strictObject({
  nombre: z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO),
  usuario: z.string().min(1).max(60),
  contrasena_temporal: z.string().min(1).max(128),
});

export const consultaDeUsuarioDisponible = z.object({ usuario: z.string().max(60).default('') });
export const respuestaDeUsuarioDisponible = z.object({ disponible: z.boolean() });

const esquemaNombreDePersona = z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO);

/** Cambiar el nombre, reactivar (`activo: true`) o desactivar (`activo: false`); al menos una cosa. */
export const cuerpoDeEdicionDeMiembro = z
  .strictObject({
    nombre: esquemaNombreDePersona.optional(),
    activo: z.boolean().optional(),
    /** Por qué se desactiva (con `activo: false`); sin él se guarda un motivo por defecto. */
    motivo: cuerpoDeCambioDeEstado.shape.motivo.optional(),
  })
  .refine((cuerpo) => cuerpo.nombre !== undefined || cuerpo.activo !== undefined);

export const cuerpoDeEdicionDePerfil = z.strictObject({ nombre: esquemaNombreDePersona });

// --- Cuentas (administración por AGROCOM, web admin) ---

/** Un texto opcional con formato: vacío o ausente = sin dato (null); si viene, cumple el patrón. */
function opcionalConFormato(patron: RegExp) {
  return z
    .string()
    .trim()
    .nullish()
    .transform((valor) => (valor === undefined || valor === null || valor === '' ? null : valor))
    .refine((valor) => valor === null || patron.test(valor));
}

const esquemaTelefono = opcionalConFormato(/^[0-9+() -]{6,30}$/);
const esquemaNit = opcionalConFormato(/^[0-9A-Za-z.-]{4,20}$/);
/** El correo de la persona responsable; vacío o ausente = sin correo. */
const esquemaCorreo = z
  .union([z.literal(''), z.email().max(120)])
  .nullish()
  .transform((correo) =>
    correo === undefined || correo === null || correo === '' ? null : correo,
  );

const esquemaEstadoDeSuscripcion = z.enum([
  'activa',
  'por_vencer',
  'vencida',
  'suspendida',
  'pendiente_pago',
]);

export const consultaDeCuentas = esquemaPaginacion.extend({
  busqueda: z.string().trim().max(100).default(''),
  estado: z
    .enum(['todas', 'activa', 'por_vencer', 'vencida', 'suspendida', 'pendiente_pago'])
    .default('todas'),
});

const esquemaCuentaListada = z.object({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  /** El estado de la cuenta; `estado` (abajo) es el de su suscripción. */
  cuenta_estado: esquemaEstado,
  plan: z
    .object({ id: z.string(), nombre: z.string(), cupo_usuarios: z.number().int().nullable() })
    .nullable(),
  usuarios_activos: z.number().int(),
  vence_el: esquemaFecha.nullable(),
  estado: esquemaEstadoDeSuscripcion,
});

export const respuestaDeCuentas = esquemaListado(esquemaCuentaListada).extend({
  conteos: z.object({
    todas: z.number().int(),
    activa: z.number().int(),
    por_vencer: z.number().int(),
    vencida: z.number().int(),
    suspendida: z.number().int(),
    pendiente_pago: z.number().int(),
  }),
});

export const consultaDeCodigoDeCuenta = z.object({
  codigo: z.string().max(10).default(''),
  razon_social: z.string().max(150).default(''),
});

export const respuestaDeCodigoDeCuenta = z.object({
  formato_valido: z.boolean(),
  disponible: z.boolean(),
  usado_por: z.string().nullable(),
  sugerencias: z.array(z.string()),
});

export const cuerpoDeNuevaCuenta = z.strictObject({
  razon_social: z.string().trim().min(1).max(150),
  codigo: z.string().min(1).max(10),
  nit: esquemaNit,
  ciudad: z.string().trim().min(1).max(80),
  contacto_nombre: z.string().trim().min(1).max(120),
  contacto_apellido: z.string().trim().min(1).max(120),
  contacto_telefono: esquemaTelefono,
  contacto_correo: esquemaCorreo,
  plan_id: esquemaId,
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  administrador_nombre: z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO),
  /** El primer pago, si ya se cobró: la cuenta nace activa. Sin él, nace pendiente de pago. */
  pago: z
    .strictObject({
      monto: z.number().positive().max(99_999_999),
      fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      medio: z.enum(['transferencia', 'qr', 'efectivo']),
      referencia: z.string().trim().max(80).default(''),
      // Una transferencia o un pago por QR exigen comprobante (ADR 0024).
      comprobante_id: esquemaId.optional(),
    })
    .superRefine((pago, ctx) => {
      if (pago.medio === 'efectivo') return;
      if (pago.comprobante_id === undefined) {
        ctx.addIssue({ code: 'custom', path: ['comprobante_id'], message: 'requerido' });
      }
    })
    .optional(),
});

/** Lo que se puede corregir de una cuenta ya creada; el código tiene su propia ruta (ADR 0023). */
export const cuerpoDeEdicionDeCuenta = z.strictObject({
  razon_social: z.string().trim().min(1).max(150),
  nit: esquemaNit,
  ciudad: z.string().trim().min(1).max(80),
  contacto_nombre: z.string().trim().min(1).max(120),
  contacto_apellido: z.string().trim().min(1).max(120),
  contacto_telefono: esquemaTelefono,
  contacto_correo: esquemaCorreo,
  /** Cuántos Miembros puede tener cada Titular (ADR 0028 §6); sin él, no cambia. */
  max_miembros_por_titular: z.number().int().min(1).max(MAX_MIEMBROS_POR_TITULAR).optional(),
});

export const respuestaDeCuentaCreada = z.object({
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  administrador: z.object({ id: z.string(), etiqueta: z.string(), pin: z.string() }),
  suscripcion: z.object({
    desde: esquemaFecha,
    hasta: esquemaFecha,
    estado: esquemaEstadoDeSuscripcion,
  }),
});

export const parametrosDeCuenta = z.object({ id: esquemaId });

/** Un usuario de una cuenta vista por AGROCOM: `id` es la cuenta y `usuarioId`, el usuario. */
export const parametrosDeUsuarioDeCuenta = z.object({ id: esquemaId, usuarioId: esquemaId });

/** Para borrar una cuenta hay que repetir su código: así no se borra otra por error. */
export const cuerpoDeBajaDeCuenta = z.strictObject({ codigo: z.string().trim().min(1).max(10) });

export const respuestaDeDetalleDeCuenta = z.object({
  cuenta: z.object({
    id: z.string(),
    codigo: z.string(),
    nombre: z.string(),
    activa: z.boolean(),
    estado: esquemaEstado,
    estado_motivo: z.string().nullable(),
    estado_desde: esquemaFecha.nullable(),
    estado_impuesto_por: z.string().nullable(),
    cliente_desde: esquemaFecha,
    max_miembros_por_titular: z.number().int(),
  }),
  empresa: z
    .object({
      nit: z.string().nullable(),
      ciudad: z.string(),
      contacto: z.string(),
      contacto_nombre: z.string(),
      contacto_apellido: z.string(),
      telefono: z.string().nullable(),
      correo: z.string().nullable(),
    })
    .nullable(),
  suscripcion: z
    .object({
      id: z.string(),
      plan: z.object({
        id: z.string(),
        nombre: z.string(),
        cupo_usuarios: z.number().int().nullable(),
        precio_anual: z.number(),
      }),
      desde: esquemaFecha,
      hasta: esquemaFecha,
      estado: esquemaEstadoDeSuscripcion,
      dias_restantes: z.number().int(),
    })
    .nullable(),
  uso: z.object({
    usuarios_activos: z.number().int(),
    sitios: z.number().int(),
    puertas: z.number().int(),
    dispositivos_sin_conexion: z.number().int(),
    administradores: z.number().int(),
  }),
});

const esquemaLectorDePuerta = z.object({
  id: z.string(),
  nombre: z.string(),
  en_linea: z.boolean(),
  ultimo_latido_at: esquemaFecha.nullable(),
});

/** Sitios con todas sus puertas y lectores: lo que se gestiona desde la plataforma (A05c). */
export const respuestaDeEstructuraDeCuenta = z.object({
  datos: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      direccion: z.string().nullable(),
      zona_horaria: z.string(),
      activo: z.boolean(),
      puertas: z.array(
        z.object({
          id: z.string(),
          nombre: z.string(),
          segundos_apertura: z.number().int(),
          activa: z.boolean(),
          dispositivo: esquemaLectorDePuerta.nullable(),
        }),
      ),
    }),
  ),
});

const esquemaNombreDeSitio = z.string().trim().min(1).max(120);
const esquemaDireccion = z
  .string()
  .trim()
  .max(255)
  .transform((texto) => (texto === '' ? null : texto));

export const cuerpoDeNuevoSitio = z.strictObject({
  nombre: esquemaNombreDeSitio,
  direccion: esquemaDireccion.nullish().transform((d) => d ?? null),
  zona_horaria: z.string().trim().min(1).max(64).default('America/La_Paz'),
});

export const cuerpoDeEdicionDeSitio = z.strictObject({
  nombre: esquemaNombreDeSitio.optional(),
  direccion: esquemaDireccion.nullable().optional(),
  zona_horaria: z.string().trim().min(1).max(64).optional(),
  activo: z.boolean().optional(),
});

export const cuerpoDeNuevaPuerta = z.strictObject({
  nombre: z.string().trim().min(1).max(120),
  segundos_apertura: z.number().int().min(1).max(30).default(5),
});

export const cuerpoDeEdicionDePuerta = z.strictObject({
  nombre: z.string().trim().min(1).max(120).optional(),
  segundos_apertura: z.number().int().min(1).max(30).optional(),
  activa: z.boolean().optional(),
});

export const parametrosDeSitio = z.object({ id: esquemaId, sitioId: esquemaId });
export const parametrosDePuerta = z.object({ id: esquemaId, puertaId: esquemaId });
export const respuestaDeCreado = z.object({ id: z.string() });

export const respuestaDeSuscripcionDeCuenta = z.object({
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  suscripcion: z.object({
    id: z.string(),
    plan: z.object({
      id: z.string(),
      nombre: z.string(),
      cupo_usuarios: z.number().int().nullable(),
      precio_anual: z.number(),
    }),
    desde: esquemaFecha,
    hasta: esquemaFecha,
    estado: esquemaEstadoDeSuscripcion,
    dias_restantes: z.number().int(),
  }),
  proximo_pago: z.enum(['pendiente', 'sin_pagar', 'por_activar']).nullable(),
  pagos: z.array(
    z.object({
      id: z.string(),
      tipo: z.enum(['alta', 'renovacion', 'mejora_de_plan']),
      plan: z.string(),
      monto: z.number(),
      fecha_pago: z.string(),
      medio: z.enum(['transferencia', 'qr', 'efectivo']),
      referencia: z.string(),
      banco: z.string().nullable(),
      cuenta_destino: z.string().nullable(),
      comprobante_id: z.string().nullable(),
      periodo_desde: esquemaFecha,
      periodo_hasta: esquemaFecha,
      registro: z.object({ id: z.string(), nombre: z.string() }).nullable(),
    }),
  ),
});

const esquemaTotal = z.object({ monto: z.number(), cuentas: z.number().int() });

export const consultaDeCobranza = z.object({
  ventana: z.enum(['d30', 'd60', 'd90', 'vencidas', 'pendientes']).default('d30'),
  busqueda: z.string().trim().max(100).default(''),
});

export const respuestaDeCobranza = z.object({
  totales: z.object({
    por_cobrar_30: esquemaTotal,
    por_cobrar_90: esquemaTotal,
    vencido_sin_pagar: esquemaTotal,
    por_activar: esquemaTotal,
    cobrado_anio: z.object({ anio: z.number().int(), monto: z.number(), pagos: z.number().int() }),
  }),
  conteos: z.object({
    d30: z.number().int(),
    d60: z.number().int(),
    d90: z.number().int(),
    vencidas: z.number().int(),
    pendientes: z.number().int(),
  }),
  datos: z.array(
    z.object({
      cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
      plan: z.object({
        id: z.string(),
        nombre: z.string(),
        cupo_usuarios: z.number().int().nullable(),
      }),
      monto: z.number(),
      vence_el: esquemaFecha,
      dias_restantes: z.number().int(),
      pago: z.enum(['pendiente', 'sin_pagar', 'por_activar']),
      estado: esquemaEstadoDeSuscripcion,
    }),
  ),
});

export const cuerpoDeCambioDeCodigo = z.strictObject({ codigo: z.string().min(1).max(10) });
export const respuestaDeCambioDeCodigo = z.object({ codigo: z.string() });

export const parametrosDeAdministrador = z.object({ id: esquemaId, usuarioId: esquemaId });

export const respuestaDeAdministradores = z.object({
  datos: z.array(
    z.object({
      id: z.string(),
      etiqueta: z.string().nullable(),
      pin_generado_at: esquemaFecha.nullable(),
      ultimo_ingreso_at: esquemaFecha.nullable(),
    }),
  ),
});

/** Alta de otro Administrador en una cuenta (solo AGROCOM, ADR 0028). */
export const cuerpoDeNuevoAdministrador = z.strictObject({
  etiqueta: esquemaEtiqueta,
  sufijo: esquemaSufijoDePin.optional(),
});

/** El PIN en claro va solo acá, una vez (ADR 0018 §3). */
export const respuestaDeAdministradorCreado = z.object({
  id: z.string(),
  etiqueta: z.string(),
  pin: z.string(),
});

export const respuestaDeJerarquiaDeCuenta = z.object({
  administradores: z.array(
    z.object({
      id: z.string(),
      etiqueta: z.string().nullable(),
      guardias: z.array(z.object({ id: z.string(), etiqueta: z.string().nullable() })),
      titulares: z.array(
        z.object({
          id: z.string(),
          etiqueta: z.string().nullable(),
          unidad: z.string().nullable(),
          miembros: z.number().int(),
        }),
      ),
    }),
  ),
});

/** Mover un Guardia o un Titular (con su unidad y sus Miembros) a otro Administrador (ADR 0028 §7). */
export const cuerpoDeReasignacion = z.strictObject({
  usuario_id: esquemaId,
  administrador_id: esquemaId,
});

const esquemaUsuarioConUso = z.object({
  id: z.string(),
  etiqueta: z.string().nullable(),
  rol: z.string().nullable(),
  unidad: z.string().nullable(),
  qr_generados: z.number().int(),
  qr_usados: z.number().int(),
  max_qr_en_un_dia: z.number().int(),
  ultimo_qr_at: esquemaFecha.nullable(),
  inactivo: z.boolean(),
  ruidoso: z.boolean(),
});

const esquemaTitularConMiembros = z.object({
  id: z.string(),
  etiqueta: z.string().nullable(),
  unidad: z.string().nullable(),
  miembros: z.number().int(),
  tope: z.number().int(),
  porcentaje: z.number().int(),
  cerca_del_tope: z.boolean(),
});

/** Uso de los usuarios: informativo, con umbrales fijos (ADR 0028). */
export const respuestaDeEstadisticasDeUsuarios = z.object({
  ventana_dias: z.number().int(),
  umbral_inactivo_dias: z.number().int(),
  umbral_ruidoso_por_dia: z.number().int(),
  resumen: z.object({
    usuarios: z.number().int(),
    inactivos: z.number().int(),
    ruidosos: z.number().int(),
    titulares_cerca_del_tope: z.number().int(),
  }),
  usuarios: z.array(esquemaUsuarioConUso),
  titulares: z.array(esquemaTitularConMiembros),
});

export const respuestaDeEstadisticasDeCuenta = respuestaDeEstadisticasDeUsuarios.extend({
  ramas: z.array(
    z.object({ id: z.string(), etiqueta: z.string().nullable(), usuarios: z.number().int() }),
  ),
});
