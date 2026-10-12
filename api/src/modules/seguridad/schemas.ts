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

export const cuerpoDeNuevoUsuario = z.object({ etiqueta: esquemaEtiqueta, rol_ids: esquemaRolIds });

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

export const cuerpoDeEdicionDeMiembro = z.object({ activo: z.literal(false) });

// --- Cuentas (administración por AGROCOM, web admin) ---

const esquemaEstadoDeSuscripcion = z.enum(['activa', 'por_vencer', 'vencida', 'suspendida']);

export const consultaDeCuentas = esquemaPaginacion.extend({
  busqueda: z.string().trim().max(100).default(''),
  estado: z.enum(['todas', 'activa', 'por_vencer', 'vencida', 'suspendida']).default('todas'),
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
  contacto_telefono: z
    .string()
    .trim()
    .regex(/^[0-9+() -]{6,30}$/),
  plan_id: esquemaId,
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  administrador_nombre: z.string().trim().min(1).max(MAX_ETIQUETA_DE_USUARIO),
});

export const respuestaDeCuentaCreada = z.object({
  cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }),
  administrador: z.object({ id: z.string(), etiqueta: z.string(), pin: z.string() }),
  suscripcion: z.object({ desde: esquemaFecha, hasta: esquemaFecha }),
});

export const parametrosDeCuenta = z.object({ id: esquemaId });

export const respuestaDeDetalleDeCuenta = z.object({
  cuenta: z.object({
    id: z.string(),
    codigo: z.string(),
    nombre: z.string(),
    activa: z.boolean(),
    cliente_desde: esquemaFecha,
  }),
  empresa: z
    .object({ nit: z.string(), ciudad: z.string(), contacto: z.string(), telefono: z.string() })
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

export const respuestaDePuertasDeCuenta = z.object({
  datos: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      puertas: z.array(
        z.object({
          id: z.string(),
          nombre: z.string(),
          dispositivo: z
            .object({
              id: z.string(),
              nombre: z.string(),
              en_linea: z.boolean(),
              ultimo_latido_at: esquemaFecha.nullable(),
            })
            .nullable(),
        }),
      ),
    }),
  ),
});
