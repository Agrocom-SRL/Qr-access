import { z } from 'zod';
import { esquemaListado } from '../../platform/http/paginacion.js';

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
