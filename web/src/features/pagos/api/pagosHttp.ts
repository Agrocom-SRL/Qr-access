import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import type { Cobranza, EstadoDeCuenta, FilaDeCobranza } from '../domain/pago';
import type { PagosRepositorio } from './PagosRepositorio';

type EstadoDto = 'activa' | 'por_vencer' | 'vencida' | 'suspendida';

const ESTADO: Readonly<Record<EstadoDto, EstadoDeCuenta>> = {
  activa: 'activa',
  por_vencer: 'porVencer',
  vencida: 'vencida',
  suspendida: 'suspendida',
};

interface Total {
  monto: number;
  cuentas: number;
}

interface CobranzaDto {
  totales: {
    por_cobrar_30: Total;
    por_cobrar_90: Total;
    vencido_sin_pagar: Total;
    cobrado_anio: { anio: number; monto: number; pagos: number };
  };
  conteos: { d30: number; d60: number; d90: number; vencidas: number };
  datos: {
    cuenta: { id: string; codigo: string; nombre: string };
    plan: { id: string; nombre: string; cupo_usuarios: number | null };
    monto: number;
    vence_el: string;
    dias_restantes: number;
    pago: 'pendiente' | 'sin_pagar';
    estado: EstadoDto;
  }[];
}

export function cobranzaDesdeDto(dto: CobranzaDto): Cobranza {
  return {
    totales: {
      porCobrar30: dto.totales.por_cobrar_30,
      porCobrar90: dto.totales.por_cobrar_90,
      vencidoSinPagar: dto.totales.vencido_sin_pagar,
      cobradoAnio: dto.totales.cobrado_anio,
    },
    conteos: dto.conteos,
    filas: dto.datos.map((fila): FilaDeCobranza => ({
      cuenta: fila.cuenta,
      plan: { id: fila.plan.id, nombre: fila.plan.nombre, cupoUsuarios: fila.plan.cupo_usuarios },
      monto: fila.monto,
      venceEl: new Date(fila.vence_el),
      diasRestantes: fila.dias_restantes,
      pago: fila.pago === 'pendiente' ? 'pendiente' : 'sinPagar',
      estado: ESTADO[fila.estado],
    })),
  };
}

/** Endpoints `/plataforma/cobranza` y `/plataforma/cuentas/:id/pagos` (módulo `suscripciones` y `seguridad` de la API). */
export function crearPagosHttp(cliente: ClienteHttp): PagosRepositorio {
  return {
    async registrar(cuentaId, tipo, pago) {
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
