import type { Pool } from 'mysql2/promise';
import { conBloqueoDeTarea } from '../../platform/db/bloqueo-de-tarea.js';
import { enTransaccionSobre } from '../../platform/db/transaccion.js';
import { crearServicioDeAvisos, type AvisoAgrupado } from '../notificaciones/contracts.js';
import { RepositorioDeAvisosDeSenal } from './repository.js';

export type ResultadoDeEntrega = 'avisada' | 'ya_estaba' | 'ocupada';

export interface EntregaDeSenal {
  /** El tipo de la señal, para la constancia (`uso_masivo`, `bolsa.aviso`, `flujo.atipico`...). */
  readonly tipo: string;
  readonly usuarioId: string | null;
  /** Lo que identifica el hecho y el día: repetirla no vuelve a avisar (ADR 0030 §5). */
  readonly claveUnica: string;
  /** Los avisos a dejar en la cola; vacío = solo dejar la constancia (una señal de gravedad baja no se avisa). */
  readonly avisos: readonly AvisoAgrupado[];
  readonly ahora: Date;
}

/**
 * Lleva una señal a la bandeja UNA sola vez: la constancia (`avisos_de_senal`) y los avisos que van a la cola (outbox)
 * se escriben en la MISMA transacción, así que o quedan los dos o ninguno. Corre dentro de la cuenta del contexto.
 *
 * Mismo patrón que el detector de aperturas (ADR 0032 §1): quien llama ya hizo todas sus lecturas con el pool; acá solo
 * se toma el bloqueo de la cuenta (`GET_LOCK`, sin esperar) y, con esa misma conexión, se escribe en una transacción
 * corta, sin bloquear filas de negocio. Si otra pasada tiene el bloqueo, se salta y la próxima lo reintenta. Si la
 * constancia ya estaba (otra instancia se adelantó), no se encola nada.
 */
export async function llevarABandeja(
  pool: Pool,
  cuentaId: string,
  entrega: EntregaDeSenal,
): Promise<ResultadoDeEntrega> {
  const constancias = new RepositorioDeAvisosDeSenal(pool);
  const avisos = crearServicioDeAvisos(pool);
  const resultado = await conBloqueoDeTarea(pool, `senales:${cuentaId}`, (conexion) =>
    enTransaccionSobre(conexion, async (tx) => {
      const nueva = await constancias.registrar(tx, {
        tipo: entrega.tipo,
        usuarioId: entrega.usuarioId,
        claveUnica: entrega.claveUnica,
      });
      if (!nueva) return 'ya_estaba' as const;
      for (const aviso of entrega.avisos) await avisos.encolar(tx, aviso, entrega.ahora);
      return 'avisada' as const;
    }),
  );
  return resultado.obtenido ? resultado.valor : 'ocupada';
}
