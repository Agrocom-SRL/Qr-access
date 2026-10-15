import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';

export const esquemaId = z.string().regex(/^\d{1,19}$/);
const esquemaFecha = z.string();

const esquemaRol = z.object({ id: z.string(), nombre: z.string() });

export const cuerpoDeIngreso = z.object({ pin: z.string().min(1).max(32) });

export const respuestaDeIngreso = z.object({
  acceso: z.string(),
  refresco: z.string(),
  usuario: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  roles: z.array(esquemaRol),
  rol_activo_id: z.string().nullable(),
});

export const cuerpoDeRefresco = z.object({ refresco: z.string().min(1).max(256) });

export const respuestaDeRefresco = z.object({ acceso: z.string(), refresco: z.string() });

export const cuerpoDeRolActivo = z.object({ rol_id: esquemaId });

export const respuestaDeRolActivo = z.object({ acceso: z.string() });

export const respuestaDeSesionActual = z.object({
  usuario: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  roles: z.array(esquemaRol),
  rol_activo: esquemaRol.nullable(),
  permisos: z.array(z.string()),
  suscripcion: z.object({ plan: z.string(), hasta: esquemaFecha }).nullable(),
});

/** Largo de `usuarios.etiqueta`. */
export const MAX_ETIQUETA_DE_USUARIO = 80;
export const MAX_ROLES_POR_USUARIO = 20;

export const esquemaUsuario = z.object({
  id: z.string(),
  etiqueta: z.string().nullable(),
  activo: z.boolean(),
  roles: z.array(esquemaRol),
  pin_generado_at: esquemaFecha.nullable(),
  ultimo_ingreso_at: esquemaFecha.nullable(),
  created_at: esquemaFecha,
});

export const respuestaListadoDeUsuarios = esquemaListado(esquemaUsuario);

const esquemaEtiqueta = z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO);
const esquemaRolIds = z.array(esquemaId).min(1).max(MAX_ROLES_POR_USUARIO);

/** Los 4 caracteres finales del PIN elegidos por el administrador: `A`–`Z` y `0`–`9`, sin distinguir mayúsculas. */
const esquemaSufijoDePin = z
  .string()
  .regex(/^[A-Za-z0-9]{4}$/)
  .transform((sufijo) => sufijo.toUpperCase());

export const cuerpoDeNuevoUsuario = z.object({
  etiqueta: esquemaEtiqueta,
  rol_ids: esquemaRolIds,
  sufijo: esquemaSufijoDePin.optional(),
});

/** Regenerar el PIN: sin cuerpo (lo sortea el servidor) o con el sufijo elegido. */
export const cuerpoDeRegeneracionDePin = z.object({ sufijo: esquemaSufijoDePin.optional() });

/** Lo que una persona edita de sí misma: su nombre. */
export const cuerpoDeMiPerfil = z.object({ etiqueta: esquemaEtiqueta });

export const respuestaDeMiPerfil = z.object({ id: z.string(), etiqueta: z.string() });

/** El PIN en claro va solo acá, una vez (ADR 0018 §3). */
export const respuestaDeUsuarioCreado = esquemaUsuario.extend({ pin: z.string() });

export const cuerpoDeEdicionDeUsuario = z
  .object({ etiqueta: esquemaEtiqueta.optional(), rol_ids: esquemaRolIds.optional() })
  .refine((cuerpo) => cuerpo.etiqueta !== undefined || cuerpo.rol_ids !== undefined, {
    message: 'sin_cambios',
  });

export const parametrosDeUsuario = z.object({ id: esquemaId });

export const respuestaDePinGenerado = z.object({ pin: z.string(), pin_generado_at: esquemaFecha });

export const respuestaListadoDeRoles = z.object({ datos: z.array(esquemaRol) });

// --- Equipo AGROCOM (super admin, web admin) ---

export const cuerpoDeIngresoDePlataforma = z.object({
  usuario: z.string().min(1).max(60),
  contrasena: z.string().min(1).max(128),
});

export const respuestaDeIngresoDePlataforma = z.object({
  acceso: z.string(),
  refresco: z.string(),
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

export const cuerpoDeCambioDeContrasena = z.object({
  actual: z.string().min(1).max(128),
  nueva: z.string().min(1).max(128),
});

const esquemaMiembroDelEquipo = z.object({
  id: z.string(),
  nombre: z.string().nullable(),
  usuario: z.string(),
  activo: z.boolean(),
  es_actual: z.boolean(),
  ultimo_ingreso_at: esquemaFecha.nullable(),
  created_at: esquemaFecha,
});

export const respuestaDelEquipo = esquemaListado(esquemaMiembroDelEquipo).extend({
  activos: z.number().int(),
});

export const respuestaDeMiembroCreado = esquemaMiembroDelEquipo;

export const cuerpoDeNuevoMiembro = z.object({
  nombre: z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO),
  usuario: z.string().min(1).max(60),
  contrasena_temporal: z.string().min(1).max(128),
});

export const consultaDeUsuarioDisponible = z.object({ usuario: z.string().max(60).default('') });
export const respuestaDeUsuarioDisponible = z.object({ disponible: z.boolean() });

const esquemaNombreDePersona = z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO);

/** Cambiar el nombre, reactivar (`activo: true`) o desactivar (`activo: false`); al menos una cosa. */
export const cuerpoDeEdicionDeMiembro = z
  .object({ nombre: esquemaNombreDePersona.optional(), activo: z.boolean().optional() })
  .refine((cuerpo) => cuerpo.nombre !== undefined || cuerpo.activo !== undefined);

export const cuerpoDeEdicionDePerfil = z.object({ nombre: esquemaNombreDePersona });

// --- Cuentas (administración por AGROCOM, web admin) ---

const esquemaTelefono = z
  .string()
  .trim()
  .regex(/^[0-9+() -]{6,30}$/);
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

export const cuerpoDeNuevaCuenta = z.object({
  razon_social: z.string().trim().min(1).max(150),
  codigo: z.string().min(1).max(10),
  nit: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z.-]{4,20}$/),
  ciudad: z.string().trim().min(1).max(80),
  contacto_nombre: z.string().trim().min(1).max(120),
  contacto_telefono: esquemaTelefono,
  contacto_correo: esquemaCorreo,
  plan_id: esquemaId,
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  administrador_nombre: z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO),
  /** El primer pago, si ya se cobró: la cuenta nace activa. Sin él, nace pendiente de pago. */
  pago: z
    .object({
      monto: z.number().positive().max(99_999_999),
      fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      medio: z.enum(['transferencia', 'deposito', 'efectivo']),
      referencia: z.string().trim().min(1).max(80),
      // Una transferencia o un depósito exigen banco, cuenta y comprobante (ADR 0024).
      banco: z.string().trim().min(1).max(60).optional(),
      cuenta_destino: z.string().trim().min(1).max(60).optional(),
      comprobante_id: esquemaId.optional(),
    })
    .superRefine((pago, ctx) => {
      if (pago.medio === 'efectivo') return;
      for (const campo of ['banco', 'cuenta_destino', 'comprobante_id'] as const) {
        if (pago[campo] === undefined) {
          ctx.addIssue({ code: 'custom', path: [campo], message: 'requerido' });
        }
      }
    })
    .optional(),
});

/** Lo que se puede corregir de una cuenta ya creada; el código tiene su propia ruta (ADR 0023). */
export const cuerpoDeEdicionDeCuenta = z.object({
  razon_social: z.string().trim().min(1).max(150),
  nit: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z.-]{4,20}$/),
  ciudad: z.string().trim().min(1).max(80),
  contacto_nombre: z.string().trim().min(1).max(120),
  contacto_telefono: esquemaTelefono,
  contacto_correo: esquemaCorreo,
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

/** Para borrar una cuenta hay que repetir su código: así no se borra otra por error. */
export const cuerpoDeBajaDeCuenta = z.object({ codigo: z.string().trim().min(1).max(10) });

export const respuestaDeDetalleDeCuenta = z.object({
  cuenta: z.object({
    id: z.string(),
    codigo: z.string(),
    nombre: z.string(),
    activa: z.boolean(),
    cliente_desde: esquemaFecha,
  }),
  empresa: z
    .object({
      nit: z.string(),
      ciudad: z.string(),
      contacto: z.string(),
      telefono: z.string(),
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

export const cuerpoDeNuevoSitio = z.object({
  nombre: esquemaNombreDeSitio,
  direccion: esquemaDireccion.nullish().transform((d) => d ?? null),
  zona_horaria: z.string().trim().min(1).max(64).default('America/La_Paz'),
});

export const cuerpoDeEdicionDeSitio = z.object({
  nombre: esquemaNombreDeSitio.optional(),
  direccion: esquemaDireccion.nullable().optional(),
  zona_horaria: z.string().trim().min(1).max(64).optional(),
  activo: z.boolean().optional(),
});

export const cuerpoDeNuevaPuerta = z.object({
  nombre: z.string().trim().min(1).max(120),
  segundos_apertura: z.number().int().min(1).max(30).default(5),
});

export const cuerpoDeEdicionDePuerta = z.object({
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
      medio: z.enum(['transferencia', 'deposito', 'efectivo']),
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

export const cuerpoDeCambioDeCodigo = z.object({ codigo: z.string().min(1).max(10) });
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
