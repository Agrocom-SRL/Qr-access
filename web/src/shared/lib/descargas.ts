/**
 * Baja un archivo que el panel arma en memoria (el CSV de una exportación). La URL temporal existe solo
 * durante el clic y se revoca enseguida: el contenido no queda en la página ni en ningún estado.
 * Sin `URL.createObjectURL` (jsdom, navegadores muy viejos) no hace nada, como `descargarExcel`.
 */
export function descargarArchivo(nombre: string, contenido: Blob): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
