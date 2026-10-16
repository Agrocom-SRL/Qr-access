import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import type {
  AccionBitacora,
  CanalBitacora,
  EventoBitacora,
  ValoresDeEvento,
} from '../domain/evento';
import type { BitacoraRepositorio } from './BitacoraRepositorio';

interface EventoDto {
  id: string;
  ocurrido_at: string;
  usuario: { id: string; nombre: string } | null;
  cuenta: { id: string; codigo: string } | null;
  accion: AccionBitacora;
  codigo: string;
  canal: CanalBitacora;
  antes: ValoresDeEvento | null;
  despues: ValoresDeEvento | null;
}

export function eventoDesdeDto(dto: EventoDto): EventoBitacora {
  return {
    id: dto.id,
    ocurridoEn: new Date(dto.ocurrido_at),
    usuario: dto.usuario,
    cuenta: dto.cuenta,
    accion: dto.accion,
    codigo: dto.codigo,
    canal: dto.canal,
    antes: dto.antes,
    despues: dto.despues,
  };
}

/** Endpoint `/plataforma/bitacora` de la API (módulo `bitacora`). */
export function crearBitacoraHttp(cliente: ClienteHttp): BitacoraRepositorio {
  return {
    async listar(filtros, porPagina) {
      const dto = await cliente.solicitar<ListadoDto<EventoDto>>({
        metodo: 'GET',
        ruta: '/plataforma/bitacora',
        consulta: {
          cuenta_id: filtros.cuentaId ?? undefined,
          accion: filtros.accion ?? undefined,
          desde: filtros.desde,
          hasta: filtros.hasta,
          pagina: filtros.pagina,
          por_pagina: porPagina,
        },
      });
      return paginadoDesde(dto, eventoDesdeDto);
    },
    async cuentas() {
      const dto = await cliente.solicitar<
        ListadoDto<{ id: string; codigo: string; nombre: string }>
      >({
        metodo: 'GET',
        ruta: '/plataforma/cuentas',
        consulta: { por_pagina: 100 },
      });
      return dto.datos.map(({ id, codigo, nombre }) => ({ id, codigo, nombre }));
    },
  };
}
