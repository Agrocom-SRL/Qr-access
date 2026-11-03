/**
 * Despertador en memoria para peticiones largas (ADR 0035 §2, ADR 0032 §1): quien espera NO ocupa una conexión de la
 * base, solo una suscripción a una clave; quien produce el hecho (una orden de apertura nueva) llama a `despertar`
 * DESPUÉS del COMMIT y los que esperan esa clave vuelven a consultar la base, que sigue siendo el árbitro.
 *
 * Vale para UNA instancia de la API (como el rate limit en memoria). Con más instancias o tras un reinicio una señal
 * se pierde: por eso quien espera además consulta por sondeo cada pocos segundos. Una señal nunca decide nada por
 * sí sola: solo hace que se mire antes.
 */
export class NotificadorPorClave {
  private readonly suscripciones = new Map<string, Set<Suscripcion>>();

  /**
   * Se suscribe a `clave` ANTES de consultar la base: una señal que llegue entre la consulta y la espera no se
   * pierde (queda marcada y la siguiente espera termina al instante). `señal` aborta la espera (desconexión).
   * Quien se suscribe debe llamar a `cerrar` (en un `finally`).
   */
  suscribir(clave: string, señal?: AbortSignal): Suscripcion {
    const suscripcion = new Suscripcion(señal, () => {
      const grupo = this.suscripciones.get(clave);
      grupo?.delete(suscripcion);
      if (grupo?.size === 0) this.suscripciones.delete(clave);
    });
    const grupo = this.suscripciones.get(clave) ?? new Set<Suscripcion>();
    grupo.add(suscripcion);
    this.suscripciones.set(clave, grupo);
    return suscripcion;
  }

  /** Avisa a todos los que esperan `clave` que miren la base. Devuelve cuántos había. */
  despertar(clave: string): number {
    const grupo = this.suscripciones.get(clave);
    if (grupo === undefined) return 0;
    for (const suscripcion of [...grupo]) suscripcion.señalar();
    return grupo.size;
  }

  /** Cuántos esperan `clave` ahora (para comprobar que una espera cortada se limpia). */
  cantidad(clave: string): number {
    return this.suscripciones.get(clave)?.size ?? 0;
  }
}

/** La espera de UNA petición larga sobre una clave. */
export class Suscripcion {
  private señalada = false;
  private despertarla: (() => void) | null = null;

  constructor(
    private readonly aborto: AbortSignal | undefined,
    private readonly alCerrar: () => void,
  ) {}

  /** Marca la señal y suelta la espera en curso, si la hay. */
  señalar(): void {
    this.señalada = true;
    this.despertarla?.();
  }

  /**
   * Espera una señal, el vencimiento de `ms` o el aborto de la petición, lo que ocurra primero. Si ya hubo una
   * señal desde la última espera, termina enseguida. No lanza nunca: quien llama revisa su propia `señal`.
   */
  esperar(ms: number): Promise<void> {
    if (this.señalada || this.aborto?.aborted === true) {
      this.señalada = false;
      return Promise.resolve();
    }
    return new Promise<void>((resolver) => {
      const terminar = (): void => {
        clearTimeout(temporizador);
        this.aborto?.removeEventListener('abort', terminar);
        this.despertarla = null;
        this.señalada = false;
        resolver();
      };
      const temporizador = setTimeout(terminar, Math.max(0, ms));
      this.aborto?.addEventListener('abort', terminar, { once: true });
      this.despertarla = terminar;
    });
  }

  /** Deja de esperar y libera la clave. Idempotente. */
  cerrar(): void {
    this.despertarla?.();
    this.alCerrar();
  }
}
