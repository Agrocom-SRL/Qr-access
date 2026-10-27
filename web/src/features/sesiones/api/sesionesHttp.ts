import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { plataformaConocida, type SesionDeUsuario } from '../domain/sesion';
import type { SesionesRepositorio } from './SesionesRepositorio';

interface SesionDto {
  id: string;
  plataforma: string | null;
  dispositivo: string | null;
  ip: string | null;
  iniciada_at: string;
  ultima_actividad_at: string;
  expira_at: string;
  actual: boolean;
}

export function sesionDesdeDto(dto: SesionDto): SesionDeUsuario {
  return {
    id: dto.id,
    plataforma: plataformaConocida(dto.plataforma),
    dispositivo: dto.dispositivo,
    ip: dto.ip,
    iniciadaEn: new Date(dto.iniciada_at),
    ultimaActividadEn: new Date(dto.ultima_actividad_at),
    expiraEn: new Date(dto.expira_at),
  };
}

/** Ruta de las sesiones de un usuario de una cuenta; los ids se codifican por seguridad. */
function rutaDeSesiones(cuentaId: string, usuarioId: string): string {
  const cuenta = encodeURIComponent(cuentaId);
  const usuario = encodeURIComponent(usuarioId);
  return `/plataforma/cuentas/${cuenta}/usuarios/${usuario}/sesiones`;
}

export function crearSesionesHttp(cliente: ClienteHttp): SesionesRepositorio {
  return {
    async listar(cuentaId, usuarioId) {
      const dto = await cliente.solicitar<{ datos: SesionDto[] }>({
        metodo: 'GET',
        ruta: rutaDeSesiones(cuentaId, usuarioId),
      });
      return dto.datos.map(sesionDesdeDto);
    },
    async cerrar(cuentaId, usuarioId, sesionId) {
      await cliente.solicitar({
        metodo: 'DELETE',
        ruta: `${rutaDeSesiones(cuentaId, usuarioId)}/${encodeURIComponent(sesionId)}`,
      });
    },
    async cerrarTodas(cuentaId, usuarioId) {
      const dto = await cliente.solicitar<{ cerradas: number }>({
        metodo: 'DELETE',
        ruta: rutaDeSesiones(cuentaId, usuarioId),
      });
      return dto.cerradas;
    },
  };
}
