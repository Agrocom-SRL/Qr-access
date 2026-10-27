/** Todas las cachés cortas del proceso, para poder vaciarlas juntas (los tests lo hacen al reiniciar la base). */
const registro = new Set<CacheCorta<unknown>>();

/** Vacía todas las cachés cortas del proceso. */
export function vaciarCachesCortas(): void {
  for (const cache of registro) cache.vaciar();
}

interface Entrada<V> {
  readonly expiraMs: number;
  readonly valor: V;
}

/**
 * Caché en memoria de vida corta, POR PROCESO, para vistas de plataforma que recorren todas las cuentas y que el
 * panel de AGROCOM vuelve a pedir al ordenar o paginar (ADR 0030 §5, ola W12).
 *
 * - Invalida solo por tiempo: pasado `ttlMs` desde que se calculó, el valor se vuelve a calcular. No hay escritura
 *   que la invalide; por eso solo sirve para datos que toleran segundos de atraso (aquí, aperturas y consumo).
 * - NUNCA para datos de UNA cuenta: no separa por cuenta. Solo para vistas de plataforma, que ya ven todas.
 * - El reloj es un parámetro (`ahoraMs`): quien llama pasa su `ahora`, así los tests no esperan segundos reales.
 * - Una carga en curso se comparte entre las peticiones simultáneas (una sola consulta cara); si falla, el error no
 *   se guarda y la siguiente petición reintenta.
 */
export class CacheCorta<V> {
  private readonly entradas = new Map<string, Entrada<V>>();
  private readonly enCurso = new Map<string, Promise<V>>();

  constructor(private readonly ttlMs: number) {
    registro.add(this);
  }

  /** El valor vigente de `clave`, o el que devuelva `calcular` (que queda guardado `ttlMs`). */
  async obtener(clave: string, ahoraMs: number, calcular: () => Promise<V>): Promise<V> {
    const guardada = this.entradas.get(clave);
    if (
      guardada !== undefined &&
      ahoraMs < guardada.expiraMs &&
      ahoraMs >= guardada.expiraMs - this.ttlMs
    ) {
      return guardada.valor;
    }
    this.entradas.delete(clave);
    const cargando = this.enCurso.get(clave);
    if (cargando !== undefined) return cargando;
    const carga = calcular()
      .then((valor) => {
        this.expulsarVencidas(ahoraMs);
        this.entradas.set(clave, { expiraMs: ahoraMs + this.ttlMs, valor });
        return valor;
      })
      .finally(() => this.enCurso.delete(clave));
    this.enCurso.set(clave, carga);
    return carga;
  }

  vaciar(): void {
    this.entradas.clear();
    this.enCurso.clear();
  }

  /** Cuántas claves guardadas hay (para los tests). */
  get tamano(): number {
    return this.entradas.size;
  }

  /** Las claves son pocas (una por ventana pedida), pero no se acumulan entradas muertas. */
  private expulsarVencidas(ahoraMs: number): void {
    for (const [clave, entrada] of this.entradas) {
      if (ahoraMs >= entrada.expiraMs) this.entradas.delete(clave);
    }
  }
}
