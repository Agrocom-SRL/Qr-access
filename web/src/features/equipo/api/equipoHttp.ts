import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import type { ListadoDto } from '../../../shared/api/tipos';
import type { MiembroEquipo } from '../domain/equipo';
import type { EquipoRepositorio } from './EquipoRepositorio';

interface MiembroDto {
  id: string;
  nombre: string | null;
  usuario: string;
  activo: boolean;
  es_actual: boolean;
  ultimo_ingreso_at: string | null;
}

export function miembroDesdeDto(dto: MiembroDto): MiembroEquipo {
  return {
    id: dto.id,
    nombre: dto.nombre ?? dto.usuario,
    usuario: dto.usuario,
    activo: dto.activo,
    esActual: dto.es_actual,
    ultimoIngresoEn: dto.ultimo_ingreso_at === null ? null : new Date(dto.ultimo_ingreso_at),
  };
}

/** Endpoints `/plataforma/equipo` de la API (módulo `seguridad`). */
export function crearEquipoHttp(cliente: ClienteHttp): EquipoRepositorio {
  return {
    async listar() {
      const dto = await cliente.solicitar<ListadoDto<MiembroDto> & { activos: number }>({
        metodo: 'GET',
        ruta: '/plataforma/equipo',
        consulta: { por_pagina: 100 },
      });
      return { miembros: dto.datos.map(miembroDesdeDto), activos: dto.activos };
    },

    async usuarioDisponible(usuario) {
      const dto = await cliente.solicitar<{ disponible: boolean }>({
        metodo: 'GET',
        ruta: '/plataforma/equipo/usuario-disponible',
        consulta: { usuario },
      });
      return dto.disponible;
    },

    async agregar(nuevo) {
      return miembroDesdeDto(
        await cliente.solicitar<MiembroDto>({
          metodo: 'POST',
          ruta: '/plataforma/equipo',
          cuerpo: {
            nombre: nuevo.nombre,
            usuario: nuevo.usuario,
            contrasena_temporal: nuevo.contrasenaTemporal,
          },
        }),
      );
    },

    async desactivar(id) {
      await cliente.solicitar({
        metodo: 'PATCH',
        ruta: `/plataforma/equipo/${id}`,
        cuerpo: { activo: false },
      });
    },
  };
}
