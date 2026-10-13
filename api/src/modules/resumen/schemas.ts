import { z } from 'zod';
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
    }),
  ),
});
