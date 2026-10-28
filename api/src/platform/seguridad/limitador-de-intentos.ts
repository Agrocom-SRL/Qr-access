export interface OpcionesDelLimitador {
  /** Fallos seguidos que disparan un bloqueo. */
  readonly maxFallos: number;
  /** Duración del primer bloqueo; cada bloqueo siguiente dura el doble. */
  readonly bloqueoBaseSegundos: number;
  readonly bloqueoMaximoSegundos: number;
  /** Milisegundos desde la época; se inyecta para probar sin esperar. */
  readonly reloj?: () => number;
  /** Claves que se recuerdan a la vez (por omisión 50 000). */
  readonly maxRegistros?: number;
}

interface Registro {
  fallos: number;
  bloqueos: number;
  bloqueadoHasta: number;
  ultimaActividad: number;
}

const OLVIDO_MS = 24 * 3_600_000;
const TOPE_DE_REGISTROS = 50_000;

/**
 * Límite de intentos con bloqueo creciente (ADR 0018 §4), en memoria: vale para una sola
 * instancia de la API, que es V1. Con varias instancias hay que moverlo a Redis o a la base.
 * Un acierto borra el historial de esa clave; un bloqueo no se levanta con un acierto.
 */
export class LimitadorDeIntentos {
  private readonly registros = new Map<string, Registro>();
  private readonly reloj: () => number;
  private readonly tope: number;

  constructor(private readonly opciones: OpcionesDelLimitador) {
    this.reloj = opciones.reloj ?? Date.now;
    this.tope = opciones.maxRegistros ?? TOPE_DE_REGISTROS;
  }

  /** Segundos que faltan para poder reintentar; `0` si no está bloqueada. */
  segundosDeBloqueo(clave: string): number {
    const registro = this.registros.get(clave);
    if (registro === undefined) return 0;
    return Math.max(0, Math.ceil((registro.bloqueadoHasta - this.reloj()) / 1000));
  }

  /** Cuenta un fallo; devuelve `true` si este fallo dispara un bloqueo. */
  registrarFallo(clave: string): boolean {
    const ahora = this.reloj();
    this.depurar(ahora);
    const registro = this.registros.get(clave) ?? {
      fallos: 0,
      bloqueos: 0,
      bloqueadoHasta: 0,
      ultimaActividad: ahora,
    };
    registro.ultimaActividad = ahora;
    registro.fallos += 1;
    let disparaBloqueo = false;
    if (registro.fallos >= this.opciones.maxFallos) {
      const segundos = Math.min(
        this.opciones.bloqueoBaseSegundos * 2 ** registro.bloqueos,
        this.opciones.bloqueoMaximoSegundos,
      );
      registro.bloqueos += 1;
      registro.fallos = 0;
      registro.bloqueadoHasta = ahora + segundos * 1000;
      disparaBloqueo = true;
    }
    // Se reinserta al final: el orden del mapa es el de actividad y el más viejo queda primero.
    this.registros.delete(clave);
    this.registros.set(clave, registro);
    this.acotar();
    return disparaBloqueo;
  }

  registrarExito(clave: string): void {
    this.registros.delete(clave);
  }

  /**
   * Tope duro: si tras depurar sigue lleno (todo activo), cae la clave menos reciente. Preferible
   * a crecer sin límite; quien inunde con claves distintas solo logra que se olvide a los más viejos.
   */
  private acotar(): void {
    while (this.registros.size > this.tope) {
      const masAntigua = this.registros.keys().next();
      if (masAntigua.done === true) return;
      this.registros.delete(masAntigua.value);
    }
  }

  /** Olvida lo inactivo para que un atacante no llene la memoria con claves distintas. */
  private depurar(ahora: number): void {
    if (this.registros.size < this.tope) return;
    for (const [clave, registro] of this.registros) {
      if (ahora - registro.ultimaActividad > OLVIDO_MS && registro.bloqueadoHasta < ahora) {
        this.registros.delete(clave);
      }
    }
  }
}
