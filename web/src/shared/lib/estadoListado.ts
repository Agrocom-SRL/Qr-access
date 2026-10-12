/** Los cinco aspectos que puede tener un listado (Panel Estados, PE1–PE5). */
export type EstadoListado = 'cargando' | 'error' | 'sinConexionTotal' | 'vacio' | 'datos';

interface Entrada {
  cargando: boolean;
  error: boolean;
  /** `undefined` mientras no hubo ninguna respuesta (ni caché). */
  cantidad: number | undefined;
  conexion: boolean;
}

/**
 * Decide qué mostrar. Con datos en caché y sin red se siguen mostrando (con banner); sin caché
 * y sin red es la pantalla completa PE5b. Un error con datos en caché también conserva la tabla.
 */
export function estadoListado({ cargando, error, cantidad, conexion }: Entrada): EstadoListado {
  if (cantidad !== undefined && cantidad > 0) return 'datos';
  if (!conexion) return 'sinConexionTotal';
  if (error) return 'error';
  if (cargando || cantidad === undefined) return 'cargando';
  return 'vacio';
}
