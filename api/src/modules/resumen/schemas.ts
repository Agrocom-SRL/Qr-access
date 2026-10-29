import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';
import { esquemaEventoDeBitacora } from '../bitacora/contracts.js';

const esquemaCuenta = z.object({ id: z.string(), codigo: z.string(), nombre: z.string() });

export const respuestaDeResumen = z.object({
  actualizado_at: z.string(),
  cuentas: z.object({
    activas: z.number().int(),
    total: z.number().int(),
    por_vencer: z.number().int(),
  }),
  usuarios: z.object({ en_uso: z.number().int(), cupo_vendido: z.number().int() }),
  por_vencer_30: z.object({ cuentas: z.number().int(), monto: z.number() }),
  ingresos_esperados: z.object({ monto: z.number() }),
  renovaciones: z.array(
    z.object({
      cuenta: esquemaCuenta,
      vence_el: z.string(),
      dias_restantes: z.number().int(),
      monto: z.number(),
      estado: z.enum(['activa', 'por_vencer', 'vencida', 'suspendida', 'pendiente_pago']),
    }),
  ),
  dispositivos: z.object({
    en_linea: z.number().int(),
    sin_conexion: z.number().int(),
    lista: z.array(
      z.object({
        id: z.string(),
        nombre: z.string(),
        puerta: z.string(),
        cuenta: esquemaCuenta,
        firmware: z.string().nullable(),
        en_linea: z.boolean(),
        ultimo_latido_at: z.string().nullable(),
      }),
    ),
  }),
  ultimas_acciones: z.array(esquemaEventoDeBitacora),
});

const esquemaMes = z.string().regex(/^\d{4}-\d{2}$/);

/** Las series de las gráficas del Resumen y de Cobranza. */
export const respuestaDeEstadisticas = z.object({
  cobrado_por_mes: z.array(
    z.object({ mes: esquemaMes, monto: z.number(), pagos: z.number().int() }),
  ),
  altas_por_mes: z.array(z.object({ mes: esquemaMes, cuentas: z.number().int() })),
  cuentas_por_estado: z.object({
    activa: z.number().int(),
    por_vencer: z.number().int(),
    vencida: z.number().int(),
    suspendida: z.number().int(),
    pendiente_pago: z.number().int(),
  }),
  cuentas_por_plan: z.array(
    z.object({
      plan: z.string(),
      cuentas: z.number().int(),
      cupo_usuarios: z.number().int().nullable(),
    }),
  ),
  accesos_por_dia: z.array(
    z.object({
      dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      permitidos: z.number().int(),
      rechazados: z.number().int(),
      repeticiones_permitidas: z.number().int(),
      repeticiones_rechazadas: z.number().int(),
    }),
  ),
});

const esquemaFechaDeFiltro = z.iso.datetime({ offset: true }).transform((texto) => new Date(texto));

/** Filtros de los accesos de la plataforma: cuenta, resultado y ventana `[desde, hasta)`. */
export const consultaDeEventosDePlataforma = esquemaPaginacion.extend({
  cuenta_id: z
    .string()
    .regex(/^\d{1,19}$/)
    .optional(),
  resultado: z.enum(['permitido', 'rechazado']).optional(),
  /** Solo los accesos cuya orden de abrir terminó así (ADR 0031 §18); `fallida` muestra las aperturas que fallan. */
  ejecucion: z.enum(['ejecutada', 'fallida', 'sin_confirmacion']).optional(),
  desde: esquemaFechaDeFiltro.optional(),
  hasta: esquemaFechaDeFiltro.optional(),
});

export const respuestaDeEventosDePlataforma = esquemaListado(
  z.object({
    id: z.string(),
    ocurrido_at: z.string(),
    resultado: z.enum(['permitido', 'rechazado']),
    motivo_code: z.string(),
    cuenta: esquemaCuenta,
    puerta: z.object({ id: z.string(), nombre: z.string(), sitio: z.string() }),
    dispositivo: z.string().nullable(),
    qr_etiqueta: z.string().nullable(),
    /** Qué pasó con la orden de abrir; `null` en un rechazo o mientras la placa no informa. */
    ejecucion: z.enum(['ejecutada', 'fallida', 'sin_confirmacion']).nullable(),
    /** Por qué (`puerta_abrio`, `puerta_no_abrio`, `puerta_no_cerro`, `rele_no_accionado`, `sin_sensor`, `sin_respuesta`). */
    ejecucion_causa: z.string().nullable(),
    repeticiones_permitidas: z.number().int(),
    repeticiones_rechazadas: z.number().int(),
  }),
);

/** Cómo se usó la apertura manual (ADR 0035) en los últimos días, para el panel de plataforma. */
export const respuestaDeAperturaManual = z.object({
  /** Cuántos días mira la ventana (hoy incluido). */
  dias: z.number().int(),
  ordenadas: z.number().int(),
  rechazadas: z.number().int(),
  /** Aperturas por QR permitidas en la misma ventana, para comparar los dos caminos. */
  por_qr: z.number().int(),
  usuarios: z.number().int(),
  cuentas_que_la_usaron: z.number().int(),
  ejecucion: z.object({
    ejecutadas: z.number().int(),
    fallidas: z.number().int(),
    sin_confirmacion: z.number().int(),
  }),
  por_puerta: z.array(
    z.object({
      cuenta: esquemaCuenta,
      puerta: z.object({ id: z.string(), nombre: z.string(), sitio: z.string() }),
      total: z.number().int(),
      rechazadas: z.number().int(),
    }),
  ),
  por_cuenta: z.array(
    z.object({
      cuenta: esquemaCuenta,
      total: z.number().int(),
      rechazadas: z.number().int(),
      usuarios: z.number().int(),
    }),
  ),
  /** Un elemento por cada día de la ventana, con ceros donde no hubo aperturas. */
  por_dia: z.array(
    z.object({ dia: z.string(), ordenadas: z.number().int(), rechazadas: z.number().int() }),
  ),
  /** Las 24 horas del día local (0–23) con ceros donde no hubo aperturas. */
  por_hora: z.array(z.object({ hora: z.number().int(), total: z.number().int() })),
  configuracion: z.object({
    puertas: z.number().int(),
    habilitadas: z.number().int(),
    /** Habilitadas y con al menos una placa en servicio: las que de verdad ofrecen el botón. */
    disponibles: z.number().int(),
    cuentas: z.number().int(),
    cuentas_con_modo_activo: z.number().int(),
  }),
});
