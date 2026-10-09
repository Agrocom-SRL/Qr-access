export interface OpcionesDelLimitador {
  /** Fallos seguidos que disparan un bloqueo. */
  readonly maxFallos: number;
  /** Duración del primer bloqueo; cada bloqueo siguiente dura el doble. */
  readonly bloqueoBaseSegundos: number;
  readonly bloqueoMaximoSegundos: number;
  /** Milisegundos desde la época; se inyecta para probar sin esperar. */
  readonly reloj?: () => number;
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

  constructor(private readonly opciones: OpcionesDelLimitador) {
    this.reloj = opciones.reloj ?? Date.now;
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
    this.registros.set(clave, registro);
    return disparaBloqueo;
  }

  registrarExito(clave: string): void {
    this.registros.delete(clave);
  }

  /** Olvida lo inactivo para que un atacante no llene la memoria con claves distintas. */
  private depurar(ahora: number): void {
    if (this.registros.size < TOPE_DE_REGISTROS) return;
    for (const [clave, registro] of this.registros) {
      if (ahora - registro.ultimaActividad > OLVIDO_MS && registro.bloqueadoHasta < ahora) {
        this.registros.delete(clave);
      }
    }
  }
}
