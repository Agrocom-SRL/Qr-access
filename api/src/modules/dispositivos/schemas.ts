import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';

export const cuerpoDeLatido = z.strictObject({
  firmware: z.string().min(1).max(20),
  rssi: z.number().int().min(-200).max(100),
  puerta_abierta: z.boolean(),
  /** Si el lector QR responde por UART. Opcional: el firmware anterior no lo manda (ADR 0031 §18). */
  lector_responde: z.boolean().optional(),
});

export const respuestaDeConfiguracion = z.object({
  segundos_apertura: z.number().int(),
  zona_horaria: z.string(),
  ota: z.null(),
});

/** El anuncio de una placa sin vínculo (ADR 0026 §2). La clave la sortea la placa. */
export const cuerpoDeAnuncio = z.strictObject({
  mac: z.string().min(11).max(17),
  clave: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  firmware: z.string().min(1).max(20),
});

export const respuestaDeAnuncio = z.discriminatedUnion('estado', [
  z.object({ estado: z.literal('detectada') }),
  z.object({ estado: z.literal('confirmar') }),
  z.object({ estado: z.literal('vinculado'), dispositivo_id: z.string() }),
]);

/** La placa avisa que alguien mantuvo pulsado su botón (ADR 0026 §4). */
export const cuerpoDeConfirmacion = z.strictObject({
  mac: z.string().min(11).max(17),
  clave: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
});

export const respuestaDeConfirmacion = z.object({
  estado: z.literal('vinculado'),
  dispositivo_id: z.string(),
});

export const parametrosDePlaca = z.object({ id: z.string().regex(/^\d+$/) });

export const cuerpoDeVinculo = z.strictObject({
  cuenta_id: z.string().regex(/^\d+$/),
  puerta_id: z.string().regex(/^\d+$/),
  nombre: z.string().trim().min(1).max(100),
});

/** Hasta cuándo espera la placa que alguien pulse su botón. */
export const respuestaDeVinculo = z.object({ por_confirmar_hasta: z.string() });

export const consultaDePlacas = esquemaPaginacion.extend({
  busqueda: z.string().trim().min(1).max(60).optional(),
  estado: z.enum(['detectada', 'por_confirmar', 'vinculada']).optional(),
  /** Para dar con las que fallan: las que dejaron de reportar. */
  conexion: z.enum(['en_linea', 'sin_conexion']).optional(),
});

export const respuestaDePlacas = esquemaListado(
  z.object({
    id: z.string(),
    mac: z.string(),
    estado: z.enum(['detectada', 'por_confirmar', 'vinculada']),
    firmware: z.string().nullable(),
    ip: z.string().nullable(),
    ultimo_contacto_at: z.string().nullable(),
    en_linea: z.boolean(),
    /**
     * Estado de la placa vinculada derivado del latido (ADR 0031 §18): `en_linea`, `sin_conexion` (entre 3 y 15
     * min, sin aviso), `caida_sostenida` (15 min) o `desaparecida` (2 h). `null` si no está vinculada o nunca
     * envió un latido. Campo aditivo: `en_linea` sigue valiendo igual.
     */
    estado_conexion: z
      .enum(['en_linea', 'sin_conexion', 'caida_sostenida', 'desaparecida'])
      .nullable(),
    /** Lo que informó el último latido sobre el lector QR; `null` si el firmware no lo informa. */
    lector_responde: z.boolean().nullable(),
    /** En línea pero sin ninguna lectura en la puerta en las últimas 24 h (marca informativa, sin aviso). */
    en_observacion: z.boolean(),
    por_confirmar_hasta: z.string().nullable(),
    dispositivo: z.object({ id: z.string(), nombre: z.string() }).nullable(),
    cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }).nullable(),
    puerta: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  }),
);
