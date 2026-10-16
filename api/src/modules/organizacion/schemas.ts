import { z } from 'zod';
import { esquemaListado } from '../../platform/http/paginacion.js';

/** Lector en servicio de la puerta; `null` cuando la puerta todavía no tiene uno (HU-08). */
export const esquemaDispositivoDePuerta = z.object({
  id: z.string(),
  nombre: z.string(),
  /** Reportó un latido hace menos de `LATIDO_MAXIMO_SEGUNDOS` (HU-09). */
  en_linea: z.boolean(),
  ultimo_latido_at: z.string().nullable(),
});

export const esquemaPuerta = z.object({
  id: z.string(),
  nombre: z.string(),
  sitio: z.object({ id: z.string(), nombre: z.string() }),
  dispositivo: esquemaDispositivoDePuerta.nullable(),
});

export const esquemaListadoDePuertas = esquemaListado(esquemaPuerta);

// --- Gestión de sitios y puertas por el administrador de la cuenta (HU-07) ---

const esquemaIdDeRuta = z.string().regex(/^\d{1,19}$/);
const esquemaNombre = z.string().trim().min(1).max(120);
const esquemaDireccion = z
  .string()
  .trim()
  .max(255)
  .transform((texto) => (texto === '' ? null : texto));

export const respuestaDeEstructura = z.object({
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
          dispositivo: esquemaDispositivoDePuerta.nullable(),
        }),
      ),
    }),
  ),
});

export const cuerpoDeNuevoSitio = z.object({
  nombre: esquemaNombre,
  direccion: esquemaDireccion.nullish().transform((d) => d ?? null),
  zona_horaria: z.string().trim().min(1).max(64).default('America/La_Paz'),
});

export const cuerpoDeEdicionDeSitio = z.object({
  nombre: esquemaNombre.optional(),
  direccion: esquemaDireccion.nullable().optional(),
  zona_horaria: z.string().trim().min(1).max(64).optional(),
  activo: z.boolean().optional(),
});

export const cuerpoDeNuevaPuerta = z.object({
  nombre: esquemaNombre,
  segundos_apertura: z.number().int().min(1).max(30).default(5),
});

export const cuerpoDeEdicionDePuerta = z.object({
  nombre: esquemaNombre.optional(),
  segundos_apertura: z.number().int().min(1).max(30).optional(),
  activa: z.boolean().optional(),
});

export const parametrosDeSitio = z.object({ sitioId: esquemaIdDeRuta });
export const parametrosDePuerta = z.object({ puertaId: esquemaIdDeRuta });
export const respuestaDeCreado = z.object({ id: z.string() });

export const parametrosDeUsuario = z.object({ usuarioId: esquemaIdDeRuta });

/** Puertas asignadas a un usuario: `todas` o una lista de puertas (nunca las dos cosas). */
export const esquemaPuertasAsignadas = z.object({
  todas: z.boolean(),
  puerta_ids: z.array(esquemaIdDeRuta).max(500),
});
