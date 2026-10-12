/**
 * Descarga un texto como archivo (CSV de la cobranza). Antepone el BOM para que Excel lea las
 * tildes; sin `URL.createObjectURL` (tests, navegadores raros) no hace nada.
 */
export function descargarTexto(
  nombre: string,
  contenido: string,
  tipo = 'text/csv;charset=utf-8',
): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(new Blob(['﻿', contenido], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
