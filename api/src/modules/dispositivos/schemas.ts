import { z } from 'zod';
import { SENTIDOS } from './domain/sentido.js';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';

export const cuerpoDeLatido = z.strictObject({
  firmware: z.string().min(1).max(20),
  rssi: z.number().int().min(-200).max(100),
  puerta_abierta: z.boolean(),
  /** Si el lector QR responde por UART. Opcional: el firmware anterior no lo manda (ADR 0031 §18). */
  lector_responde: z.boolean().optional(),
  /**
   * Estado del sensor de puerta (ADR 0031 §18): `abierta`, `cerrada` o `sin_sensor` si la placa no lo tiene
   * conectado. Opcional: el firmware anterior no lo manda. Es diagnóstico; no decide nada.
   */
  sensor_puerta: z.enum(['abierta', 'cerrada', 'sin_sensor']).optional(),
});

export const respuestaDeConfiguracion = z.object({
  segundos_apertura: z.number().int(),
  zona_horaria: z.string(),
  ota: z.null(),
  /**
   * El sensor de puerta de esta placa (ADR 0031 §18). `instalado: false` (valor inicial) = la placa no lo lee y
   * informa `sin_sensor`. `nivel_abierto` es el nivel del pin cuando la puerta está ABIERTA; la polaridad real
   * del contacto está pendiente de confirmar en campo, por eso se configura aquí y no se compila.
   */
  sensor_puerta: z.object({
    instalado: z.boolean(),
    nivel_abierto: z.enum(['alto', 'bajo']),
  }),
  /**
   * Segundos que la placa espera ver la puerta abierta tras el pulso antes de dar la apertura por fallida
   * (`segundos_apertura` + margen). Solo importa con `sensor_puerta.instalado`.
   */
  espera_confirmacion_segundos: z.number().int(),
  /**
   * El interruptor de la apertura manual de la puerta (ADR 0035 §5). Con `false` la placa NO hace la petición larga
   * de órdenes (`GET /dispositivos/ordenes`); vuelve a leer esta configuración y el cambio le llega en un minuto.
   */
  apertura_manual: z.boolean(),
});

/** Habilitar o deshabilitar el sensor de puerta de una placa y fijar su polaridad (solo AGROCOM). */
export const cuerpoDeSensor = z.strictObject({
  instalado: z.boolean(),
  nivel_abierto: z.enum(['alto', 'bajo']),
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
  /**
   * Dónde está el lector de la placa (ADR 0035 §4): `entrada` (afuera), `salida` (adentro) o `ambos` (una sola placa,
   * por omisión). Una puerta lleva hasta una placa por lado y `ambos` no se mezcla con los otros (409).
   */
  sentido: z.enum(SENTIDOS).default('ambos'),
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
    /** Lo que informó el último latido sobre el sensor de puerta; `null` si no lo informa. */
    sensor_puerta: z.enum(['abierta', 'cerrada', 'sin_sensor']).nullable(),
    /** Configuración del sensor (`instalado`, `nivel_abierto`); `null` si no está vinculada. */
    sensor_configurado: z
      .object({ instalado: z.boolean(), nivel_abierto: z.enum(['alto', 'bajo']) })
      .nullable(),
    /** La puerta está en el grupo de «aperturas que fallan» (ADR 0031 §18). */
    apertura_fallida: z.boolean(),
    por_confirmar_hasta: z.string().nullable(),
    /**
     * La ubicación del lector que pidió el super admin mientras la placa espera el botón (ADR 0035 §4); `null` si
     * no hay una solicitud en curso. Al confirmarse pasa a `dispositivo.sentido`.
     */
    vinculo_sentido: z.enum(SENTIDOS).nullable(),
    dispositivo: z
      .object({
        id: z.string(),
        nombre: z.string(),
        /** Dónde está el lector: `entrada` (afuera), `salida` (adentro) o `ambos` (ADR 0035 §4). Campo aditivo. */
        sentido: z.enum(['entrada', 'salida', 'ambos']),
      })
      .nullable(),
    cuenta: z.object({ id: z.string(), codigo: z.string(), nombre: z.string() }).nullable(),
    puerta: z.object({ id: z.string(), nombre: z.string() }).nullable(),
  }),
);
