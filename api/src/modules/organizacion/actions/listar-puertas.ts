import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { aIsoONulo } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeDispositivos } from '../../dispositivos/contracts.js';
import { RepositorioDePuertas } from '../repository.js';

export interface DispositivoListado {
  id: string;
  nombre: string;
  en_linea: boolean;
  ultimo_latido_at: string | null;
}

export interface PuertaListada {
  id: string;
  nombre: string;
  sitio: { id: string; nombre: string };
  /** Su lector en servicio y si está en línea; `null` si la puerta no tiene lector. */
  dispositivo: DispositivoListado | null;
}

/** Las puertas activas de la cuenta del contexto, con su sitio y el estado de su lector (HU-09). */
export async function ejecutar(
  pool: Pool,
  paginacion: Paginacion,
  ahora: Date = new Date(),
): Promise<Listado<PuertaListada>> {
  const repositorio = new RepositorioDePuertas(pool);
  const { limite, desplazamiento } = limiteDe(paginacion);
  const [filas, total] = await Promise.all([
    repositorio.listarActivas(limite, desplazamiento),
    repositorio.contarActivas(),
  ]);
  const dispositivos = await crearServicioDeDispositivos(pool).porPuerta(
    filas.map((fila) => fila.id),
    ahora,
  );
  return armarListado(
    filas.map((fila) => {
      const dispositivo = dispositivos.get(fila.id);
      return {
        id: fila.id,
        nombre: fila.nombre,
        sitio: { id: fila.sitio_id, nombre: fila.sitio_nombre },
        dispositivo:
          dispositivo === undefined
            ? null
            : {
                id: dispositivo.id,
                nombre: dispositivo.nombre,
                en_linea: dispositivo.enLinea,
                ultimo_latido_at: aIsoONulo(dispositivo.ultimoLatidoAt),
              },
      };
    }),
    paginacion,
    total,
  );
}
