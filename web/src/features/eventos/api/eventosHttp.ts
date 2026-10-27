import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import {
  causaDeEjecucion,
  type EjecucionDeEvento,
  type EventoDeAcceso,
  type ResultadoDeEvento,
} from '../domain/evento';
import type { EventosRepositorio } from './EventosRepositorio';

interface EventoDto {
  id: string;
  ocurrido_at: string;
  resultado: ResultadoDeEvento;
  motivo_code: string;
  cuenta: { id: string; codigo: string; nombre: string };
  puerta: { id: string; nombre: string; sitio: string };
  dispositivo: string | null;
  qr_etiqueta: string | null;
  ejecucion: EjecucionDeEvento | null;
  ejecucion_causa: string | null;
}

/** La Paz no cambia de hora: UTC−4 todo el año (igual que las estadísticas de la API). */
const DESFASE_DE_LA_PLATAFORMA = '-04:00';
const DIA_MS = 86_400_000;

/** Inicio del día `aaaa-mm-dd` en la zona de la plataforma, como instante con desfase. */
function inicioDelDia(dia: string): string {
  return `${dia}T00:00:00${DESFASE_DE_LA_PLATAFORMA}`;
}

/** El "hasta" de la pantalla incluye el día elegido; la API lo toma como límite exclusivo. */
function inicioDelDiaSiguiente(dia: string): string {
  const siguiente = new Date(new Date(inicioDelDia(dia)).getTime() + DIA_MS);
  return siguiente.toISOString();
}

export function eventoDesdeDto(dto: EventoDto): EventoDeAcceso {
  return {
    id: dto.id,
    ocurridoEn: new Date(dto.ocurrido_at),
    resultado: dto.resultado,
    motivoCode: dto.motivo_code,
    cuenta: dto.cuenta,
    puerta: dto.puerta,
    dispositivo: dto.dispositivo,
    qrEtiqueta: dto.qr_etiqueta,
    ejecucion: dto.ejecucion,
    ejecucionCausa: causaDeEjecucion(dto.ejecucion_causa),
  };
}

/** Endpoint `/plataforma/lecturas` de la API (módulo `resumen`). */
export function crearEventosHttp(cliente: ClienteHttp): EventosRepositorio {
  return {
    async listar(filtros, porPagina) {
      const dto = await cliente.solicitar<ListadoDto<EventoDto>>({
        metodo: 'GET',
        ruta: '/plataforma/lecturas',
        consulta: {
          cuenta_id: filtros.cuentaId ?? undefined,
          resultado: filtros.resultado === 'todos' ? undefined : filtros.resultado,
          ejecucion: filtros.ejecucion === 'todas' ? undefined : filtros.ejecucion,
          desde: filtros.desde === '' ? undefined : inicioDelDia(filtros.desde),
          hasta: filtros.hasta === '' ? undefined : inicioDelDiaSiguiente(filtros.hasta),
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
