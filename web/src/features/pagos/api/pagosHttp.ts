import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { subirComprobante } from '../../../shared/api/comprobantes';
import { requiereRespaldo } from '../domain/pago';
import type { Cobranza, FilaDeCobranza } from '../domain/pago';
import { ESTADO_DESDE_DTO, type EstadoDto } from '../../../shared/api/estados';
import type { PagosRepositorio } from './PagosRepositorio';

const PAGO_DESDE_DTO = {
  pendiente: 'pendiente',
  sin_pagar: 'sinPagar',
  por_activar: 'porActivar',
} as const;

interface Total {
  monto: number;
  cuentas: number;
}

interface CobranzaDto {
  totales: {
    por_cobrar_30: Total;
    por_cobrar_90: Total;
    vencido_sin_pagar: Total;
    por_activar: Total;
    cobrado_anio: { anio: number; monto: number; pagos: number };
  };
  conteos: { d30: number; d60: number; d90: number; vencidas: number; pendientes: number };
  datos: {
    cuenta: { id: string; codigo: string; nombre: string };
    plan: { id: string; nombre: string; cupo_usuarios: number | null };
    monto: number;
    vence_el: string;
    dias_restantes: number;
    pago: 'pendiente' | 'sin_pagar' | 'por_activar';
    estado: EstadoDto;
  }[];
}

export function cobranzaDesdeDto(dto: CobranzaDto): Cobranza {
  return {
    totales: {
      porCobrar30: dto.totales.por_cobrar_30,
      porCobrar90: dto.totales.por_cobrar_90,
      vencidoSinPagar: dto.totales.vencido_sin_pagar,
      porActivar: dto.totales.por_activar,
      cobradoAnio: dto.totales.cobrado_anio,
    },
    conteos: dto.conteos,
    filas: dto.datos.map((fila): FilaDeCobranza => ({
      cuenta: fila.cuenta,
      plan: { id: fila.plan.id, nombre: fila.plan.nombre, cupoUsuarios: fila.plan.cupo_usuarios },
      monto: fila.monto,
      venceEl: new Date(fila.vence_el),
      diasRestantes: fila.dias_restantes,
      pago: PAGO_DESDE_DTO[fila.pago],
      estado: ESTADO_DESDE_DTO[fila.estado],
    })),
  };
}

/** Endpoints `/plataforma/cobranza` y `/plataforma/cuentas/:id/pagos` (módulo `suscripciones` y `seguridad` de la API). */
export function crearPagosHttp(cliente: ClienteHttp): PagosRepositorio {
  return {
    async registrar(cuentaId, tipo, pago) {
      // El comprobante se sube primero y el pago lo referencia por su id (ADR 0024).
      const comprobanteId =
        requiereRespaldo(pago.medio) && pago.comprobante
          ? await subirComprobante(cliente, pago.comprobante)
          : undefined;
      const dto = await cliente.solicitar<{
        periodo_desde: string;
        periodo_hasta: string;
        vence_el: string;
      }>({
        metodo: 'POST',
        ruta: `/plataforma/cuentas/${cuentaId}/pagos`,
        cuerpo: {
          tipo,
          monto: pago.monto,
          fecha_pago: pago.fechaPago,
          medio: pago.medio,
          referencia: pago.referencia.trim(),
          ...(comprobanteId === undefined ? {} : { comprobante_id: comprobanteId }),
        },
      });
      return {
        periodoDesde: new Date(dto.periodo_desde),
        periodoHasta: new Date(dto.periodo_hasta),
        venceEl: new Date(dto.vence_el),
      };
    },

    async cobranza(consulta) {
      return cobranzaDesdeDto(
        await cliente.solicitar<CobranzaDto>({
          metodo: 'GET',
          ruta: '/plataforma/cobranza',
          consulta,
        }),
      );
    },
  };
}
