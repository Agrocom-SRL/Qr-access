import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Almacenamiento } from './almacenamiento.js';

/** Almacén en una carpeta del disco (el volumen `archivos` del docker compose). */
export class AlmacenamientoEnDisco implements Almacenamiento {
  private readonly raiz: string;

  constructor(raiz: string) {
    this.raiz = resolve(raiz);
  }

  async guardar(ruta: string, contenido: Buffer): Promise<void> {
    const destino = this.dentroDelAlmacen(ruta);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, contenido);
  }

  leer(ruta: string): Promise<Buffer> {
    return readFile(this.dentroDelAlmacen(ruta));
  }

  /** Las rutas las genera el servidor, pero igual se descarta cualquier salida de la carpeta del almacén. */
  private dentroDelAlmacen(ruta: string): string {
    const destino = resolve(this.raiz, ruta);
    if (!destino.startsWith(this.raiz + sep)) throw new Error('Ruta fuera del almacén');
    return destino;
  }
}
