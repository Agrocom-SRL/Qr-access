import type { Pool } from 'mysql2/promise';
import { crearServicioDeDispositivos } from '../../dispositivos/contracts.js';
import { RepositorioDePuertas } from '../repository.js';

export interface PuertaConAperturaManual {
  readonly id: string;
  readonly nombre: string;
  readonly sitio: { readonly id: string; readonly nombre: string };
  /** El administrador la encendió en esta puerta. */
  readonly habilitada: boolean;
  /** `habilitada` y al menos una placa en servicio: lo que la app ofrece en el botón de abrir. */
  readonly disponible: boolean;
  /** Tiene al menos una placa en servicio; sin placa no hay nada que encender (ADR 0035 §5). */
  readonly tiene_placa: boolean;
  /** `en_linea` si alguna de sus placas reportó hace poco; sin placa, `sin_conexion`. Solo informativo. */
  readonly conexion: 'en_linea' | 'sin_conexion';
}

/**
 * Las puertas de la cuenta del contexto con su estado de apertura manual (ADR 0035 §5). Con `verTodas` (quien
 * configura, el Administrador) salen todas las activas, con o sin placa, para que la pantalla muestre «Sin placa»;
 * si no, solo las `disponible`, que es lo que la app muestra en el botón. La autoridad sigue siendo la API:
 * abrir una puerta no disponible se rechaza igual con 409.
 */
export async function ejecutar(
  pool: Pool,
  opciones: { readonly verTodas: boolean },
  ahora: Date = new Date(),
): Promise<PuertaConAperturaManual[]> {
  const puertas = await new RepositorioDePuertas(pool).listarActivasSinPaginar();
  const placas = await crearServicioDeDispositivos(pool).placasPorPuerta(
    puertas.map((puerta) => puerta.id),
    ahora,
  );
  const lista = puertas.map((puerta): PuertaConAperturaManual => {
    const deLaPuerta = placas.get(puerta.id);
    const tienePlaca = deLaPuerta !== undefined && deLaPuerta.enServicio > 0;
    const habilitada = puerta.apertura_manual === 1;
    return {
      id: puerta.id,
      nombre: puerta.nombre,
      sitio: { id: puerta.sitio_id, nombre: puerta.sitio_nombre },
      habilitada,
      disponible: habilitada && tienePlaca,
      tiene_placa: tienePlaca,
      conexion: deLaPuerta !== undefined && deLaPuerta.enLinea > 0 ? 'en_linea' : 'sin_conexion',
    };
  });
  return opciones.verTodas ? lista : lista.filter((puerta) => puerta.disponible);
}
