import type { SesionDeUsuario } from '../domain/sesion';

/** Lo que `application` necesita de las sesiones de un usuario de una cuenta (solo super admin). */
export interface SesionesRepositorio {
  listar: (cuentaId: string, usuarioId: string) => Promise<SesionDeUsuario[]>;
  /** Cierra una sesión. La API no anula los QR por esta vía: solo cierra esa sesión. */
  cerrar: (cuentaId: string, usuarioId: string, sesionId: string) => Promise<void>;
  /** Cierra todas las sesiones del usuario y anula sus QR vigentes; devuelve cuántas cerró. */
  cerrarTodas: (cuentaId: string, usuarioId: string) => Promise<number>;
}
