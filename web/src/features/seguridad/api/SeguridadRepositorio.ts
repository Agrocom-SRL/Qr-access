import type { PerfilAdmin, SesionIniciada } from '../domain/sesion';

/** Lo que `application` necesita de la API de seguridad; HTTP, mocks o caché lo implementan (LSP). */
export interface SeguridadRepositorio {
  ingresar: (usuario: string, contrasena: string) => Promise<SesionIniciada>;
  /** Recupera la sesión con el refresco que recuerda la pestaña; `null` si no hay o ya no vale. */
  restaurar: () => Promise<SesionIniciada | null>;
  cerrarSesion: () => Promise<void>;
  obtenerPerfil: () => Promise<PerfilAdmin>;
  cambiarContrasena: (actual: string, nueva: string) => Promise<void>;
}
