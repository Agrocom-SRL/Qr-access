import type { AlmacenSesion } from '../../../shared/api/almacenSesion';
import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { ErrorApi } from '../../../shared/api/errorApi';
import type { PerfilAdmin, SesionIniciada } from '../domain/sesion';
import type { SeguridadRepositorio } from './SeguridadRepositorio';

interface IngresoDto {
  acceso: string;
  refresco: string;
  usuario: { id: string; nombre: string | null; usuario: string };
  debe_cambiar_contrasena: boolean;
  permisos: string[];
}

interface PerfilDto {
  id: string;
  nombre: string | null;
  usuario: string;
  creado_at: string;
  ultimo_ingreso_at: string | null;
  debe_cambiar_contrasena: boolean;
  permisos: string[];
}

export function perfilDesdeDto(dto: PerfilDto): PerfilAdmin {
  return {
    id: dto.id,
    nombre: dto.nombre ?? dto.usuario,
    usuario: dto.usuario,
    creadoEn: new Date(dto.creado_at),
    ultimoIngresoEn: dto.ultimo_ingreso_at === null ? null : new Date(dto.ultimo_ingreso_at),
    debeCambiarContrasena: dto.debe_cambiar_contrasena,
    permisos: dto.permisos,
  };
}

/** Endpoints `/plataforma/sesiones` y `/plataforma/perfil` de la API (módulo `seguridad`). */
export function crearSeguridadHttp(
  cliente: ClienteHttp,
  sesion: AlmacenSesion,
): SeguridadRepositorio {
  /** Un solo intento por carga: el refresco rota y un segundo uso lo invalidaría (StrictMode monta dos veces). */
  let restauracion: Promise<SesionIniciada | null> | null = null;

  async function restaurarSesion(): Promise<SesionIniciada | null> {
    const refresco = sesion.refrescoRecordado();
    if (refresco === null) return null;
    try {
      const nuevos = await cliente.solicitar<{ acceso: string; refresco: string }>({
        metodo: 'POST',
        ruta: '/sesiones/refresco',
        cuerpo: { refresco },
      });
      sesion.guardar(nuevos);
      const perfil = perfilDesdeDto(
        await cliente.solicitar<PerfilDto>({ metodo: 'GET', ruta: '/plataforma/perfil' }),
      );
      return {
        usuario: { id: perfil.id, nombre: perfil.nombre, usuario: perfil.usuario },
        debeCambiarContrasena: perfil.debeCambiarContrasena,
        permisos: perfil.permisos,
      };
    } catch (error) {
      // Sin red el refresco sigue siendo válido: se conserva para el próximo intento.
      if (!(error instanceof ErrorApi) || error.status !== 0) sesion.limpiar();
      return null;
    }
  }

  return {
    restaurar() {
      restauracion ??= restaurarSesion();
      return restauracion;
    },

    async ingresar(usuario, contrasena) {
      const dto = await cliente.solicitar<IngresoDto>({
        metodo: 'POST',
        ruta: '/plataforma/sesiones',
        cuerpo: { usuario, contrasena },
      });
      // Los tokens quedan solo en memoria (ADR 0021) y nunca salen de esta capa.
      sesion.guardar({ acceso: dto.acceso, refresco: dto.refresco });
      const iniciada: SesionIniciada = {
        usuario: {
          id: dto.usuario.id,
          nombre: dto.usuario.nombre ?? dto.usuario.usuario,
          usuario: dto.usuario.usuario,
        },
        debeCambiarContrasena: dto.debe_cambiar_contrasena,
        permisos: dto.permisos,
      };
      return iniciada;
    },

    async cerrarSesion() {
      try {
        await cliente.solicitar({ metodo: 'DELETE', ruta: '/plataforma/sesiones/actual' });
      } finally {
        sesion.limpiar();
      }
    },

    async obtenerPerfil() {
      return perfilDesdeDto(
        await cliente.solicitar<PerfilDto>({ metodo: 'GET', ruta: '/plataforma/perfil' }),
      );
    },

    async cambiarContrasena(actual, nueva) {
      await cliente.solicitar({
        metodo: 'PUT',
        ruta: '/plataforma/perfil/contrasena',
        cuerpo: { actual, nueva },
      });
    },
  };
}
