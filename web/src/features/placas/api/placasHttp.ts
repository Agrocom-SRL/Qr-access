import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import type {
  EstadoDeConexion,
  EstadoDePlaca,
  NivelAbierto,
  Placa,
  SensorDePuerta,
} from '../domain/placa';
import { POR_PAGINA_DE_PLACAS } from '../domain/placa';
import type { PlacasRepositorio } from './PlacasRepositorio';

interface PlacaDto {
  id: string;
  mac: string;
  estado: EstadoDePlaca;
  firmware: string | null;
  ip: string | null;
  ultimo_contacto_at: string | null;
  en_linea: boolean;
  estado_conexion: EstadoDeConexion | null;
  lector_responde: boolean | null;
  en_observacion: boolean;
  sensor_puerta: SensorDePuerta | null;
  sensor_configurado: { instalado: boolean; nivel_abierto: NivelAbierto } | null;
  apertura_fallida: boolean;
  por_confirmar_hasta: string | null;
  dispositivo: { id: string; nombre: string } | null;
  cuenta: { id: string; codigo: string; nombre: string } | null;
  puerta: { id: string; nombre: string } | null;
}

export function placaDesdeDto(dto: PlacaDto): Placa {
  return {
    id: dto.id,
    mac: dto.mac,
    estado: dto.estado,
    firmware: dto.firmware,
    ip: dto.ip,
    ultimoContactoEn: dto.ultimo_contacto_at === null ? null : new Date(dto.ultimo_contacto_at),
    enLinea: dto.en_linea,
    estadoConexion: dto.estado_conexion,
    lectorResponde: dto.lector_responde,
    enObservacion: dto.en_observacion,
    sensorPuerta: dto.sensor_puerta,
    sensorConfigurado:
      dto.sensor_configurado === null
        ? null
        : {
            instalado: dto.sensor_configurado.instalado,
            nivelAbierto: dto.sensor_configurado.nivel_abierto,
          },
    aperturaFallida: dto.apertura_fallida,
    porConfirmarHasta: dto.por_confirmar_hasta === null ? null : new Date(dto.por_confirmar_hasta),
    dispositivo: dto.dispositivo,
    cuenta: dto.cuenta,
    puerta: dto.puerta,
  };
}

/** Endpoints `/plataforma/placas` de la API (módulo `dispositivos`). */
export function crearPlacasHttp(cliente: ClienteHttp): PlacasRepositorio {
  return {
    async listar(filtros) {
      const parametros = new URLSearchParams({
        pagina: String(filtros.pagina),
        por_pagina: String(POR_PAGINA_DE_PLACAS),
      });
      if (filtros.busqueda !== '') parametros.set('busqueda', filtros.busqueda);
      if (filtros.estado !== 'todas') parametros.set('estado', filtros.estado);
      if (filtros.conexion !== 'todas') parametros.set('conexion', filtros.conexion);
      const dto = await cliente.solicitar<ListadoDto<PlacaDto>>({
        metodo: 'GET',
        ruta: `/plataforma/placas?${parametros.toString()}`,
      });
      return paginadoDesde(dto, placaDesdeDto);
    },
    async vincular(placaId, datos) {
      const respuesta = await cliente.solicitar<{ por_confirmar_hasta: string }>({
        metodo: 'POST',
        ruta: `/plataforma/placas/${placaId}/vincular`,
        cuerpo: { cuenta_id: datos.cuentaId, puerta_id: datos.puertaId, nombre: datos.nombre },
      });
      return { porConfirmarHasta: new Date(respuesta.por_confirmar_hasta) };
    },
    async cancelarVinculo(placaId) {
      await cliente.solicitar({
        metodo: 'POST',
        ruta: `/plataforma/placas/${placaId}/cancelar-vinculo`,
      });
    },
    async liberar(placaId) {
      await cliente.solicitar({ metodo: 'POST', ruta: `/plataforma/placas/${placaId}/liberar` });
    },
    async darDeBaja(placaId) {
      await cliente.solicitar({ metodo: 'DELETE', ruta: `/plataforma/placas/${placaId}` });
    },
    async configurarSensor(placaId, sensor) {
      await cliente.solicitar({
        metodo: 'PUT',
        ruta: `/plataforma/placas/${placaId}/sensor`,
        cuerpo: { instalado: sensor.instalado, nivel_abierto: sensor.nivelAbierto },
      });
    },
  };
}
