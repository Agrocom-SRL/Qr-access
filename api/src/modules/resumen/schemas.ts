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
      estado: z.enum(['activa', 'por_vencer', 'vencida', 'suspendida']),
    }),
  ),
  ultimas_acciones: z.array(esquemaEventoDeBitacora),
});
