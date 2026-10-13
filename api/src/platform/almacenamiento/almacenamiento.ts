/**
 * Dónde viven los archivos que sube la plataforma (ADR 0024). La base guarda solo la ruta relativa;
 * el contenido va fuera de la base y fuera del contenedor (un volumen en local, compatible con S3
 * en producción), y nunca se sirve desde una carpeta pública: lo entrega la API con su autorización.
 */
export interface Almacenamiento {
  /** Guarda `contenido` en `ruta` (relativa al almacén). Sobrescribe si ya existía. */
  guardar(ruta: string, contenido: Buffer): Promise<void>;
  /** Devuelve el contenido de `ruta`; falla si no existe. */
  leer(ruta: string): Promise<Buffer>;
}
