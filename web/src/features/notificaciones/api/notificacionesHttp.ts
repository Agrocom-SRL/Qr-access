import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import {
  CAUSAS_DE_APERTURA,
  type AccionPropuesta,
  type BolsaDeAviso,
  type FlujoDeAviso,
  type PropuestaDeIncidente,
  type SenalDeUso,
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
    senal?: {
      tipo: SenalDeUso['tipo'];
      usuario_id: string;
      usuario_etiqueta: string | null;
      gravedad: SenalDeUso['gravedad'];
      incidente_id: string | null;
      dia: string;
      valor: number;
      umbral: number;
    };
    bolsa?: { mes: string; dia: string; usado: number | null; tope: number | null };
    flujo?: {
      dia: string;
      aperturas: number;
      usuarios_activos: number;
      por_usuario: number;
      umbral_por_usuario: number;
      base: number | null;
    };
    propuesta?: {
      accion: AccionPropuesta;
      usuario_id: string;
      usuario_etiqueta: string | null;
      incidente_id: string;
      incidente_tipo: string;
      confirmados: number;
      minimo: number;
      ventana_dias: number;
      aplicada_automaticamente: boolean;
    };
  };
  novedad_at: string;
  creada_at: string;
}

/** Una causa que el panel no conoce no se muestra: no se inventa un texto para ella. */
function causaConocida(texto: string | null | undefined): CausaDeApertura | null {
  return CAUSAS_DE_APERTURA.find((causa) => causa === texto) ?? null;
}

/** Lo que mide una señal de uso, como lo manda la API (sin secretos). */
function senalDesdeDto(dto: NonNullable<NotificacionDto['datos']['senal']>): SenalDeUso {
  return {
    tipo: dto.tipo,
    usuarioId: dto.usuario_id,
    usuarioEtiqueta: dto.usuario_etiqueta,
    gravedad: dto.gravedad,
    incidenteId: dto.incidente_id,
    dia: dto.dia,
    valor: dto.valor,
    umbral: dto.umbral,
  };
}

/** La propuesta de un incidente, tal cual la manda la API: sin tokens ni IP, solo ids y recuentos. */
function propuestaDesdeDto(
  dto: NonNullable<NotificacionDto['datos']['propuesta']>,
): PropuestaDeIncidente {
  return {
    accion: dto.accion,
    usuarioId: dto.usuario_id,
    usuarioEtiqueta: dto.usuario_etiqueta,
    incidenteId: dto.incidente_id,
    incidenteTipo: dto.incidente_tipo,
    confirmados: dto.confirmados,
    minimo: dto.minimo,
    ventanaDias: dto.ventana_dias,
    aplicadaAutomaticamente: dto.aplicada_automaticamente,
  };
}

export function notificacionDesdeDto(dto: NotificacionDto): Notificacion {
  const bolsa = dto.datos.bolsa;
  const flujo = dto.datos.flujo;
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
    senal: dto.datos.senal ? senalDesdeDto(dto.datos.senal) : undefined,
    bolsa: bolsa
      ? ({
          mes: bolsa.mes,
          dia: bolsa.dia,
          usado: bolsa.usado,
          tope: bolsa.tope,
        } satisfies BolsaDeAviso)
      : undefined,
    flujo: flujo
      ? ({
          dia: flujo.dia,
          aperturas: flujo.aperturas,
          usuariosActivos: flujo.usuarios_activos,
          porUsuario: flujo.por_usuario,
          umbralPorUsuario: flujo.umbral_por_usuario,
          base: flujo.base,
        } satisfies FlujoDeAviso)
      : undefined,
    propuesta: dto.datos.propuesta ? propuestaDesdeDto(dto.datos.propuesta) : undefined,
    novedadEn: new Date(dto.novedad_at),
    creadaEn: new Date(dto.creada_at),
  };
}

/** Endpoints `/plataforma/notificaciones` de la API (módulo `notificaciones`, solo super admin). */
export function crearNotificacionesHttp(cliente: ClienteHttp): NotificacionesRepositorio {
  return {
    async listar(filtro, pagina, tipo) {
      const dto = await cliente.solicitar<ListadoDto<NotificacionDto>>({
        metodo: 'GET',
        ruta: '/plataforma/notificaciones',
        consulta: {
          estado: filtro,
          pagina,
          por_pagina: POR_PAGINA_DE_NOTIFICACIONES,
          tipo,
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
