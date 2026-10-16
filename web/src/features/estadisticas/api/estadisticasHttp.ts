import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import type { Estadisticas } from '../domain/estadisticas';
import type { EstadisticasRepositorio } from './EstadisticasRepositorio';

interface EstadisticasDto {
  cobrado_por_mes: { mes: string; monto: number; pagos: number }[];
  altas_por_mes: { mes: string; cuentas: number }[];
  cuentas_por_estado: {
    activa: number;
    por_vencer: number;
    vencida: number;
    suspendida: number;
    pendiente_pago: number;
  };
  cuentas_por_plan: { plan: string; cuentas: number; cupo_usuarios: number | null }[];
  accesos_por_dia: { dia: string; permitidos: number; rechazados: number }[];
}

/** Endpoint `/plataforma/estadisticas` de la API (módulo `resumen`). */
export function crearEstadisticasHttp(cliente: ClienteHttp): EstadisticasRepositorio {
  return {
    async obtener() {
      const dto = await cliente.solicitar<EstadisticasDto>({
        metodo: 'GET',
        ruta: '/plataforma/estadisticas',
      });
      return {
        cobradoPorMes: dto.cobrado_por_mes,
        altasPorMes: dto.altas_por_mes,
        cuentasPorEstado: {
          activa: dto.cuentas_por_estado.activa,
          porVencer: dto.cuentas_por_estado.por_vencer,
          vencida: dto.cuentas_por_estado.vencida,
          suspendida: dto.cuentas_por_estado.suspendida,
          pendientePago: dto.cuentas_por_estado.pendiente_pago,
        },
        cuentasPorPlan: dto.cuentas_por_plan.map((p) => ({
          plan: p.plan,
          cuentas: p.cuentas,
          cupoUsuarios: p.cupo_usuarios,
        })),
        accesosPorDia: dto.accesos_por_dia,
      } satisfies Estadisticas;
    },
  };
}
