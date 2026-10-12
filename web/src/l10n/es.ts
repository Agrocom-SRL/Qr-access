/** Textos de la interfaz en español con tuteo (ADR 0013 y 0021). Ningún componente lleva texto literal. */
export const es = {
  appTitulo: 'AGROCOM Acceso',
  appSubtitulo: 'Administración de la plataforma',
  ingresoTitulo: 'Ingresa a tu cuenta',
  ingresoUsuario: 'Usuario',
  ingresoContrasena: 'Contraseña',
  ingresoBoton: 'Ingresar',
  temaClaro: 'Tema claro',
  temaOscuro: 'Tema oscuro',
} as const;

export type Textos = typeof es;
