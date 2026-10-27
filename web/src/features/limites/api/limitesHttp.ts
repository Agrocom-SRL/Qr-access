import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import {
  POR_PAGINA_DE_CONSUMO,
  type ConsumoDeCuenta,
  type DetalleDeConsumo,
  type EstadoDeBolsa,
  type FiltrosDeConsumo,
  type ListadoDeConsumo,
} from '../domain/consumo';
import type { LimitesRepositorio } from './LimitesRepositorio';

interface ConsumoDto {
  cuenta: { id: string; codigo: string; nombre: string; estado: string };
  plan: string | null;
  usado: number;
  tope: number | null;
  porcentaje: number | null;
  estado: EstadoDeBolsa;
  origen_del_tope: 'excepcion' | 'plan' | 'general' | null;
  aviso_at: string | null;
  superada_at: string | null;
}

interface DetalleDto extends ConsumoDto {
  mes: string;
  desde: string;
  aviso_porcentaje: number;
  serie: { dia: string; generados: number }[];
}

interface ListadoConsumoDto extends ListadoDto<ConsumoDto> {
  meta: ListadoDto<ConsumoDto>['meta'] & {
    mes: string;
    aviso_porcentaje: number;
    por_estado: Record<EstadoDeBolsa, number>;
  };
}

/** Un instante opcional de la API (ISO UTC) como `Date`, o `null` si no hubo marca. */
function fechaONula(texto: string | null): Date | null {
  return texto === null ? null : new Date(texto);
}

export function consumoDesdeDto(dto: ConsumoDto): ConsumoDeCuenta {
  return {
    cuenta: { id: dto.cuenta.id, codigo: dto.cuenta.codigo, nombre: dto.cuenta.nombre },
    plan: dto.plan,
    usado: dto.usado,
    tope: dto.tope,
    porcentaje: dto.porcentaje,
    estado: dto.estado,
    origenDelTope: dto.origen_del_tope,
    avisoEn: fechaONula(dto.aviso_at),
    superadaEn: fechaONula(dto.superada_at),
  };
}

/** El panel pide la bolsa del mes en la URL; el filtro `todos` no se envía (la API no lo conoce). */
function consultaDeConsumo(filtros: FiltrosDeConsumo) {
  return {
    pagina: filtros.pagina,
    por_pagina: POR_PAGINA_DE_CONSUMO,
    estado: filtros.estado === 'todos' ? undefined : filtros.estado,
    buscar: filtros.buscar.trim() === '' ? undefined : filtros.buscar.trim(),
    orden: filtros.orden,
    sentido: filtros.sentido,
  };
}

/** Endpoints `/plataforma/consumo-de-bolsa` y `/plataforma/cuentas/{id}/consumo-de-bolsa` (módulo `senales`). */
export function crearLimitesHttp(cliente: ClienteHttp): LimitesRepositorio {
  return {
    async listarConsumo(filtros) {
      const dto = await cliente.solicitar<ListadoConsumoDto>({
        metodo: 'GET',
        ruta: '/plataforma/consumo-de-bolsa',
        consulta: consultaDeConsumo(filtros),
      });
      const listado: ListadoDeConsumo = {
        ...paginadoDesde(dto, consumoDesdeDto),
        mes: dto.meta.mes,
        avisoPorcentaje: dto.meta.aviso_porcentaje,
        porEstado: dto.meta.por_estado,
      };
      return listado;
    },
    async consumoDeCuenta(cuentaId) {
      const dto = await cliente.solicitar<DetalleDto>({
        metodo: 'GET',
        ruta: `/plataforma/cuentas/${cuentaId}/consumo-de-bolsa`,
      });
      const detalle: DetalleDeConsumo = {
        ...consumoDesdeDto(dto),
        mes: dto.mes,
        desde: new Date(dto.desde),
        avisoPorcentaje: dto.aviso_porcentaje,
        serie: dto.serie,
      };
      return detalle;
    },
  };
}
