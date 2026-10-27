import type { Pool } from 'mysql2/promise';
import { crearTareasDeDispositivos } from './modules/dispositivos/contracts.js';
import { crearTareasDeNotificaciones } from './modules/notificaciones/contracts.js';

/** Una tarea que corre sola cada cierto tiempo. */
export interface Tarea {
  readonly nombre: string;
  readonly cadaMs: number;
  ejecutar(ahora: Date, registrarError: (error: unknown) => void): Promise<unknown>;
}

/**
 * El único registro de tareas periódicas (como `modulos.ts` para las rutas). Cada una es una función con el reloj
 * inyectado, así los tests la llaman directamente con la hora que quieran y no esperan a ningún temporizador.
 */
export function crearTareas(pool: Pool): readonly Tarea[] {
  const dispositivos = crearTareasDeDispositivos(pool);
  const notificaciones = crearTareasDeNotificaciones(pool);
  return [
    // Detecta placas caídas, desaparecidas o con el lector mudo y encola los avisos (ADR 0031 §18).
    {
      nombre: 'estado-de-placas',
      cadaMs: 60_000,
      ejecutar: (ahora, registrarError) =>
        dispositivos.evaluarEstadoDePlacas(ahora, registrarError),
    },
    // Entrega lo que está en la cola (outbox) a las bandejas (ADR 0030 §6).
    {
      nombre: 'entrega-de-notificaciones',
      cadaMs: 15_000,
      ejecutar: (ahora, registrarError) => notificaciones.entregarPendientes(ahora, registrarError),
    },
    // Retención de notificaciones y mensajes ya resueltos.
    {
      nombre: 'depuracion-de-notificaciones',
      cadaMs: 3_600_000,
      ejecutar: (ahora, registrarError) => notificaciones.depurar(ahora, registrarError),
    },
  ];
}

/**
 * Cuántas tareas pueden estar corriendo a la vez. Cada una retiene a lo sumo UNA conexión del pool de la app (lee
 * antes de bloquear y, con el bloqueo, trabaja sobre esa misma conexión), así que el detector, el entregador y la
 * depuración nunca ocupan el pool entero ni dejan sin conexión a las peticiones de los usuarios (ADR 0032 §1).
 */
export const TAREAS_SIMULTANEAS = 2;

/** Un semáforo mínimo: `adquirir` espera turno y devuelve cómo liberarlo. */
export function crearLimitadorDeConcurrencia(maximo: number): () => Promise<() => void> {
  let enCurso = 0;
  const esperando: (() => void)[] = [];
  return async () => {
    if (enCurso >= maximo) await new Promise<void>((resolver) => esperando.push(resolver));
    else enCurso += 1;
    return () => {
      // Con alguien esperando, el cupo pasa directo a él.
      const siguiente = esperando.shift();
      if (siguiente === undefined) enCurso -= 1;
      else siguiente();
    };
  };
}

export interface Programacion {
  detener(): void;
}

/**
 * Programa las tareas: cada una corre cada `cadaMs`, nunca dos pasadas de la misma a la vez (si una tarda más
 * que su período, la siguiente espera) y nunca más de `simultaneas` tareas distintas a la vez. Un fallo se registra
 * sin tumbar el servidor ni las demás. Los temporizadores no mantienen vivo el proceso.
 */
export function programarTareas(
  tareas: readonly Tarea[],
  registrar: (nombre: string, error: unknown) => void,
  simultaneas: number = TAREAS_SIMULTANEAS,
): Programacion {
  const adquirir = crearLimitadorDeConcurrencia(simultaneas);
  const temporizadores = tareas.map((tarea) => {
    let enCurso = false;
    const temporizador = setInterval(() => {
      if (enCurso) return;
      enCurso = true;
      void adquirir().then((liberar) =>
        Promise.resolve()
          .then(() =>
            tarea.ejecutar(new Date(), (error) => {
              registrar(tarea.nombre, error);
            }),
          )
          .catch((error: unknown) => {
            registrar(tarea.nombre, error);
          })
          .finally(() => {
            liberar();
            enCurso = false;
          }),
      );
    }, tarea.cadaMs);
    temporizador.unref();
    return temporizador;
  });
  return {
    detener() {
      for (const temporizador of temporizadores) clearInterval(temporizador);
    },
  };
}
