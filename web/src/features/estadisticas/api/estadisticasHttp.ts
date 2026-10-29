import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import type { AperturaManual } from '../domain/aperturaManual';
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

interface AperturaManualDto {
  dias: number;
  ordenadas: number;
  rechazadas: number;
  por_qr: number;
  usuarios: number;
  cuentas_que_la_usaron: number;
  ejecucion: { ejecutadas: number; fallidas: number; sin_confirmacion: number };
  por_puerta: AperturaManual['porPuerta'][number][];
  por_cuenta: AperturaManual['porCuenta'][number][];
  por_dia: AperturaManual['porDia'][number][];
  por_hora: AperturaManual['porHora'][number][];
  configuracion: {
    puertas: number;
    habilitadas: number;
    disponibles: number;
    cuentas: number;
    cuentas_con_modo_activo: number;
  };
}

/** Endpoints `/plataforma/estadisticas` y `/plataforma/apertura-manual` de la API (módulo `resumen`). */
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
    async aperturaManual() {
      const dto = await cliente.solicitar<AperturaManualDto>({
        metodo: 'GET',
        ruta: '/plataforma/apertura-manual',
      });
      return {
        dias: dto.dias,
        ordenadas: dto.ordenadas,
        rechazadas: dto.rechazadas,
        porQr: dto.por_qr,
        usuarios: dto.usuarios,
        cuentasQueLaUsaron: dto.cuentas_que_la_usaron,
        ejecucion: {
          ejecutadas: dto.ejecucion.ejecutadas,
          fallidas: dto.ejecucion.fallidas,
          sinConfirmacion: dto.ejecucion.sin_confirmacion,
        },
        porPuerta: dto.por_puerta,
        porCuenta: dto.por_cuenta,
        porDia: dto.por_dia,
        porHora: dto.por_hora,
        configuracion: {
          puertas: dto.configuracion.puertas,
          habilitadas: dto.configuracion.habilitadas,
          disponibles: dto.configuracion.disponibles,
          cuentas: dto.configuracion.cuentas,
          cuentasConModoActivo: dto.configuracion.cuentas_con_modo_activo,
        },
      } satisfies AperturaManual;
    },
  };
}
