import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import {
  POR_PAGINA_DE_INCIDENTES,
  type AccionPropuesta,
  type Incidente,
  type PersonaDeIncidente,
  type ReincidenciaDeResolucion,
  type RespuestaDeResolucion,
} from '../domain/incidente';
import type { IncidentesRepositorio, PedidoDeResolucion } from './IncidentesRepositorio';

interface PersonaDto {
  id: string;
  etiqueta: string | null;
}

interface IncidenteDto {
  id: string;
  usuario: PersonaDto;
  tipo: Incidente['tipo'];
  gravedad: Incidente['gravedad'];
  origen: Incidente['origen'];
  registrado_por: PersonaDto | null;
  descripcion: string | null;
  evidencia: {
    qr_ids: string[];
    evento_acceso_ids: string[];
    evento_limite_ids: string[];
  };
  estado: Incidente['estado'];
  resolucion: {
    resultado: NonNullable<Incidente['resolucion']>['resultado'];
    motivo: string | null;
    resuelto_por: PersonaDto;
    resuelta_at: string;
  } | null;
  ocurrido_at: string;
  created_at: string;
}

interface ReincidenciaDto {
  confirmados: number;
  minimo: number;
  ventana_dias: number;
  propuesta: AccionPropuesta | null;
  aplicada_automaticamente: boolean;
}

interface RespuestaDeResolucionDto {
  incidente: IncidenteDto;
  reincidencia: ReincidenciaDto | null;
}

function personaDesdeDto(dto: PersonaDto): PersonaDeIncidente {
  return { id: dto.id, etiqueta: dto.etiqueta };
}

export function incidenteDesdeDto(dto: IncidenteDto): Incidente {
  return {
    id: dto.id,
    usuario: personaDesdeDto(dto.usuario),
    tipo: dto.tipo,
    gravedad: dto.gravedad,
    origen: dto.origen,
    registradoPor: dto.registrado_por === null ? null : personaDesdeDto(dto.registrado_por),
    descripcion: dto.descripcion,
    evidencia: {
      qrIds: dto.evidencia.qr_ids,
      eventoAccesoIds: dto.evidencia.evento_acceso_ids,
      eventoLimiteIds: dto.evidencia.evento_limite_ids,
    },
    estado: dto.estado,
    resolucion:
      dto.resolucion === null
        ? null
        : {
            resultado: dto.resolucion.resultado,
            motivo: dto.resolucion.motivo,
            resueltoPor: personaDesdeDto(dto.resolucion.resuelto_por),
            resueltaEn: new Date(dto.resolucion.resuelta_at),
          },
    ocurridoEn: new Date(dto.ocurrido_at),
    creadoEn: new Date(dto.created_at),
  };
}

export function reincidenciaDesdeDto(dto: ReincidenciaDto | null): ReincidenciaDeResolucion | null {
  if (dto === null) return null;
  return {
    confirmados: dto.confirmados,
    minimo: dto.minimo,
    ventanaDias: dto.ventana_dias,
    propuesta: dto.propuesta,
    aplicadaAutomaticamente: dto.aplicada_automaticamente,
  };
}

/** Los endpoints de AGROCOM para los incidentes de una cuenta (`/plataforma/cuentas/{id}/incidentes`). */
export function crearIncidentesHttp(cliente: ClienteHttp): IncidentesRepositorio {
  return {
    async listar(cuentaId, filtros) {
      const dto = await cliente.solicitar<ListadoDto<IncidenteDto>>({
        metodo: 'GET',
        ruta: `/plataforma/cuentas/${encodeURIComponent(cuentaId)}/incidentes`,
        consulta: {
          pagina: filtros.pagina,
          por_pagina: POR_PAGINA_DE_INCIDENTES,
          // `todos` no se manda: la API filtra solo si el valor viene.
          tipo: filtros.tipo === 'todos' ? undefined : filtros.tipo,
          origen: filtros.origen === 'todos' ? undefined : filtros.origen,
          estado: filtros.estado === 'todos' ? undefined : filtros.estado,
        },
      });
      return paginadoDesde(dto, incidenteDesdeDto);
    },
    async resolver(cuentaId, incidenteId, pedido: PedidoDeResolucion) {
      const dto = await cliente.solicitar<RespuestaDeResolucionDto>({
        metodo: 'POST',
        ruta: `/plataforma/cuentas/${encodeURIComponent(cuentaId)}/incidentes/${encodeURIComponent(incidenteId)}/resolucion`,
        // Sin motivo no se manda la clave: la API la acepta ausente.
        cuerpo: { resultado: pedido.resultado, motivo: pedido.motivo },
      });
      const respuesta: RespuestaDeResolucion = {
        incidente: incidenteDesdeDto(dto.incidente),
        reincidencia: reincidenciaDesdeDto(dto.reincidencia),
      };
      return respuesta;
    },
  };
}
