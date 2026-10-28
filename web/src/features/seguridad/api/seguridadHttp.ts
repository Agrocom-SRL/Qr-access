import type { AlmacenSesion } from '../../../shared/api/almacenSesion';
import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { ErrorApi } from '../../../shared/api/errorApi';
import type { PerfilAdmin, SesionIniciada } from '../domain/sesion';
import type { SeguridadRepositorio } from './SeguridadRepositorio';

/**
 * El refresco no viene en el cuerpo: la API lo deja en la cookie `HttpOnly` del navegador (ADR 0033 §5),
 * así que este DTO solo trae el acceso.
 */
interface IngresoDto {
  acceso: string;
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

  /**
   * Sin cookie válida la API responde 401 y no hay sesión. No se puede saber antes si la hay (la cookie
   * es `HttpOnly`), así que siempre se pregunta al arrancar.
   */
  async function restaurarSesion(): Promise<SesionIniciada | null> {
    try {
      const { acceso } = await cliente.solicitar<{ acceso: string }>({
        metodo: 'POST',
        ruta: '/sesiones/refresco',
        cuerpo: {},
      });
      sesion.guardar(acceso);
      const perfil = perfilDesdeDto(
        await cliente.solicitar<PerfilDto>({ metodo: 'GET', ruta: '/plataforma/perfil' }),
      );
      return {
        usuario: { id: perfil.id, nombre: perfil.nombre, usuario: perfil.usuario },
        debeCambiarContrasena: perfil.debeCambiarContrasena,
        permisos: perfil.permisos,
      };
    } catch (error) {
      // Sin red la cookie sigue siendo válida: la API no la tocó y el próximo intento la usa.
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
      // El acceso queda solo en memoria (ADR 0021) y nunca sale de esta capa.
      sesion.guardar(dto.acceso);
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

    async cambiarNombre(nombre) {
      await cliente.solicitar({
        metodo: 'PATCH',
        ruta: '/plataforma/perfil',
        cuerpo: { nombre: nombre.trim() },
      });
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
