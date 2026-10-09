import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { RepositorioDePuertas } from '../repository.js';

export interface PuertaListada {
  id: string;
  nombre: string;
  sitio: { id: string; nombre: string };
}

/** Las puertas activas de la cuenta del contexto, con su sitio. */
export async function ejecutar(
  pool: Pool,
  paginacion: Paginacion,
): Promise<Listado<PuertaListada>> {
  const repositorio = new RepositorioDePuertas(pool);
  const { limite, desplazamiento } = limiteDe(paginacion);
  const [filas, total] = await Promise.all([
    repositorio.listarActivas(limite, desplazamiento),
    repositorio.contarActivas(),
  ]);
  return armarListado(
    filas.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      sitio: { id: fila.sitio_id, nombre: fila.sitio_nombre },
    })),
    paginacion,
    total,
  );
}
