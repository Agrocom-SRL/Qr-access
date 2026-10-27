/**
 * Dispositivos conectados de un usuario de una cuenta (ADR 0030 §4.1). AGROCOM solo los ve y los cierra:
 * tener varias sesiones nunca se bloquea, así que la interfaz no juzga por el número de sesiones.
 */

export const PLATAFORMAS_DE_SESION = ['android', 'ios', 'web'] as const;
export type PlataformaDeSesion = (typeof PLATAFORMAS_DE_SESION)[number];

/** Permisos de ámbito plataforma (ADR 0030 §4.1, `db/seeds/01_catalogo.sql`). La API es la que decide. */
export const PERMISO_VER_SESIONES = 'seguridad.sesion_cuenta.ver';
export const PERMISO_CERRAR_SESIONES = 'seguridad.sesion_cuenta.cerrar';

export interface SesionDeUsuario {
  id: string;
  /** `null` cuando la sesión no informó su plataforma. */
  plataforma: PlataformaDeSesion | null;
  /** Nombre que manda el cliente: texto libre acotado. Se muestra siempre como texto plano. */
  dispositivo: string | null;
  ip: string | null;
  iniciadaEn: Date;
  ultimaActividadEn: Date;
  expiraEn: Date;
}

/** La persona cuyas sesiones se ven: su id y la etiqueta que muestra la API. */
export interface UsuarioConSesiones {
  id: string;
  etiqueta: string | null;
}

/** Una plataforma que la API no conoce no se inventa: se trata como desconocida. */
export function plataformaConocida(valor: string | null): PlataformaDeSesion | null {
  return PLATAFORMAS_DE_SESION.find((plataforma) => plataforma === valor) ?? null;
}
