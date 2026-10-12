import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import type { EstadoSuscripcion, MedioDePago, SuscripcionDeCuenta } from '../domain/suscripcion';
import type { SuscripcionesRepositorio } from './SuscripcionesRepositorio';

type EstadoDto = 'activa' | 'por_vencer' | 'vencida' | 'suspendida';

const ESTADO: Readonly<Record<EstadoDto, EstadoSuscripcion>> = {
  activa: 'activa',
  por_vencer: 'porVencer',
  vencida: 'vencida',
  suspendida: 'suspendida',
};

interface SuscripcionDto {
  cuenta: { id: string; codigo: string; nombre: string };
  suscripcion: {
    id: string;
    plan: { id: string; nombre: string; cupo_usuarios: number | null; precio_anual: number };
    desde: string;
    hasta: string;
    estado: EstadoDto;
    dias_restantes: number;
  };
  proximo_pago: 'pendiente' | 'sin_pagar' | null;
  pagos: {
    id: string;
    tipo: 'renovacion' | 'mejora_de_plan';
    plan: string;
    monto: number;
    fecha_pago: string;
    medio: MedioDePago;
    referencia: string;
    periodo_desde: string;
    periodo_hasta: string;
    registro: { id: string; nombre: string } | null;
  }[];
}

export function suscripcionDesdeDto(dto: SuscripcionDto): SuscripcionDeCuenta {
  return {
    cuenta: dto.cuenta,
    suscripcion: {
      id: dto.suscripcion.id,
      plan: {
        id: dto.suscripcion.plan.id,
        nombre: dto.suscripcion.plan.nombre,
        cupoUsuarios: dto.suscripcion.plan.cupo_usuarios,
        precioAnual: dto.suscripcion.plan.precio_anual,
      },
      desde: new Date(dto.suscripcion.desde),
      hasta: new Date(dto.suscripcion.hasta),
      estado: ESTADO[dto.suscripcion.estado],
      diasRestantes: dto.suscripcion.dias_restantes,
    },
    proximoPago:
      dto.proximo_pago === null
        ? null
        : dto.proximo_pago === 'pendiente'
          ? 'pendiente'
          : 'sinPagar',
    pagos: dto.pagos.map((pago) => ({
      id: pago.id,
      tipo: pago.tipo === 'renovacion' ? 'renovacion' : 'mejoraDePlan',
      plan: pago.plan,
      monto: pago.monto,
      fechaPago: pago.fecha_pago,
      medio: pago.medio,
      referencia: pago.referencia,
      periodoDesde: new Date(pago.periodo_desde),
      periodoHasta: new Date(pago.periodo_hasta),
      registro: pago.registro,
    })),
  };
}

/** Endpoints de suscripción de `/plataforma/cuentas/:id` (módulo `suscripciones` de la API). */
export function crearSuscripcionesHttp(cliente: ClienteHttp): SuscripcionesRepositorio {
  return {
    async obtener(cuentaId) {
      return suscripcionDesdeDto(
        await cliente.solicitar<SuscripcionDto>({
          metodo: 'GET',
          ruta: `/plataforma/cuentas/${cuentaId}/suscripcion`,
        }),
      );
    },
    async cambiarPlan(cuentaId, planId) {
      const dto = await cliente.solicitar<{
        plan: { id: string; nombre: string; cupo_usuarios: number | null };
        diferencia_precio: number;
      }>({
        metodo: 'PUT',
        ruta: `/plataforma/cuentas/${cuentaId}/suscripcion/plan`,
        cuerpo: { plan_id: planId },
      });
      return {
        plan: { id: dto.plan.id, nombre: dto.plan.nombre, cupoUsuarios: dto.plan.cupo_usuarios },
        diferenciaPrecio: dto.diferencia_precio,
      };
    },
    async suspender(cuentaId) {
      await cliente.solicitar({
        metodo: 'POST',
        ruta: `/plataforma/cuentas/${cuentaId}/suscripcion/suspension`,
      });
    },
    async reactivar(cuentaId) {
      await cliente.solicitar({
        metodo: 'POST',
        ruta: `/plataforma/cuentas/${cuentaId}/suscripcion/reactivacion`,
      });
    },
  };
}
