import type { Pool } from 'mysql2/promise';
import { estaEnLinea } from './domain/en-linea.js';
import { RepositorioDeDispositivos } from './repository.js';

export { crearAutenticadorDeDispositivo } from './autenticador.js';

/** Lo que otros módulos pueden saber del dispositivo de una puerta (HU-09). */
export interface DispositivoDePuerta {
  readonly id: string;
  readonly puertaId: string;
  readonly nombre: string;
  readonly enLinea: boolean;
  readonly ultimoLatidoAt: Date | null;
}

export interface ServicioDeDispositivos {
  /** `puertaId -> dispositivo en servicio` de la cuenta del contexto; una puerta sin lector no figura. */
  porPuerta(puertaIds: readonly string[], ahora: Date): Promise<Map<string, DispositivoDePuerta>>;
}

export function crearServicioDeDispositivos(pool: Pool): ServicioDeDispositivos {
  const dispositivos = new RepositorioDeDispositivos(pool);
  return {
    async porPuerta(puertaIds, ahora) {
      const filas = await dispositivos.listarEnServicioPorPuertas(puertaIds);
      return new Map(
        filas.map((fila) => [
          fila.puerta_id,
          {
            id: fila.id,
            puertaId: fila.puerta_id,
            nombre: fila.nombre,
            enLinea: estaEnLinea(fila.ultimo_latido_at, ahora),
            ultimoLatidoAt: fila.ultimo_latido_at,
          },
        ]),
      );
    },
  };
}
