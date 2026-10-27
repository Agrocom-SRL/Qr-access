import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import {
  CAUSAS_DE_APERTURA,
  POR_PAGINA_DE_NOTIFICACIONES,
  type CausaDeApertura,
  type Notificacion,
  type Severidad,
  type TipoDeNotificacion,
} from '../domain/notificacion';
import type { NotificacionesRepositorio } from './NotificacionesRepositorio';

interface PlacaDto {
  dispositivo_id: string;
  puerta_id: string;
  puerta_nombre: string;
  desde: string | null;
  fallos?: number;
  causa?: string | null;
}

interface NotificacionDto {
  id: string;
  tipo: TipoDeNotificacion;
  severidad: Severidad;
  cuenta_id: string;
  leida: boolean;
  resuelta: boolean;
  datos: {
    cuenta: { id: string; codigo: string; nombre: string };
    sitio: { id: string; nombre: string } | null;
    placas: PlacaDto[];
  };
  novedad_at: string;
  creada_at: string;
}

/** Una causa que el panel no conoce no se muestra: no se inventa un texto para ella. */
function causaConocida(texto: string | null | undefined): CausaDeApertura | null {
  return CAUSAS_DE_APERTURA.find((causa) => causa === texto) ?? null;
}

export function notificacionDesdeDto(dto: NotificacionDto): Notificacion {
  return {
    id: dto.id,
    tipo: dto.tipo,
    severidad: dto.severidad,
    cuenta: dto.datos.cuenta,
    sitio: dto.datos.sitio,
    leida: dto.leida,
    placas: dto.datos.placas.map((placa) => ({
      dispositivoId: placa.dispositivo_id,
      puertaId: placa.puerta_id,
      puertaNombre: placa.puerta_nombre,
      desde: placa.desde === null ? null : new Date(placa.desde),
      fallos: placa.fallos ?? null,
      causa: causaConocida(placa.causa),
    })),
    novedadEn: new Date(dto.novedad_at),
    creadaEn: new Date(dto.creada_at),
  };
}

/** Endpoints `/plataforma/notificaciones` de la API (módulo `notificaciones`, solo super admin). */
export function crearNotificacionesHttp(cliente: ClienteHttp): NotificacionesRepositorio {
  return {
    async listar(filtro, pagina) {
      const dto = await cliente.solicitar<ListadoDto<NotificacionDto>>({
        metodo: 'GET',
        ruta: '/plataforma/notificaciones',
        consulta: {
          estado: filtro,
          pagina,
          por_pagina: POR_PAGINA_DE_NOTIFICACIONES,
        },
      });
      return paginadoDesde(dto, notificacionDesdeDto);
    },
    async noLeidas() {
      const dto = await cliente.solicitar<{ no_leidas: number }>({
        metodo: 'GET',
        ruta: '/plataforma/notificaciones/contador',
      });
      return dto.no_leidas;
    },
    async leer(id) {
      await cliente.solicitar({ metodo: 'POST', ruta: `/plataforma/notificaciones/${id}/leer` });
    },
    async descartar(id) {
      await cliente.solicitar({
        metodo: 'POST',
        ruta: `/plataforma/notificaciones/${id}/descartar`,
      });
    },
    async leerTodas() {
      const dto = await cliente.solicitar<{ marcadas: number }>({
        metodo: 'POST',
        ruta: '/plataforma/notificaciones/leer-todas',
      });
      return dto.marcadas;
    },
  };
}
