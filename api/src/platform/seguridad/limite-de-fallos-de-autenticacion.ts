export interface OpcionesDelLimiteDeFallos {
  /** Fallos de autenticación por IP y por ventana a partir de los cuales la IP se bloquea. */
  readonly maxFallos: number;
  readonly ventanaMs?: number;
  /** Cuántas IP se recuerdan a la vez; llena, se descarta la más antigua. */
  readonly maxIps?: number;
  /** Milisegundos desde la época; se inyecta para probar sin esperar. */
  readonly reloj?: () => number;
}

interface Ventana {
  inicio: number;
  fallos: number;
}

const VENTANA_POR_OMISION_MS = 60_000;
const MAX_IPS_POR_OMISION = 20_000;
/** Cuánto vale haber autenticado bien un dispositivo desde una IP para seguir verificándolo. */
const MEMORIA_DE_ACIERTOS_MS = 15 * 60_000;
const MAX_ACIERTOS = 10_000;

/**
 * Tope de autenticaciones FALLIDAS por IP (ADR 0030 §3.2, ADR 0033): sin él, quien adivina
 * credenciales de dispositivo o JWT solo se topa con el costo del hash, no con un 429, porque
 * el 401 sale antes del rate limit por principal. Cuenta solo los fallos (un acierto nunca
 * consume) en una ventana fija; pasado el tope, esa IP recibe 429 SIN verificar su credencial.
 *
 * Los dispositivos que ya autenticaron bien desde esa IP en los últimos 15 minutos se siguen
 * verificando aunque la IP esté bloqueada: así una IP compartida (varias placas de un sitio
 * tras un mismo NAT) no se queda sin servicio por un tercero que adivina. En memoria y
 * acotado: vale para una sola instancia (V1); con más, sale a Redis o a la base.
 */
export class LimiteDeFallosDeAutenticacion {
  private readonly ventanas = new Map<string, Ventana>();
  private readonly aciertos = new Map<string, number>();
  private readonly ventanaMs: number;
  private readonly maxIps: number;
  private readonly reloj: () => number;

  constructor(private readonly opciones: OpcionesDelLimiteDeFallos) {
    this.ventanaMs = opciones.ventanaMs ?? VENTANA_POR_OMISION_MS;
    this.maxIps = opciones.maxIps ?? MAX_IPS_POR_OMISION;
    this.reloj = opciones.reloj ?? Date.now;
  }

  /** Segundos que faltan para que la IP deje de estar bloqueada; `0` si no lo está. */
  segundosDeBloqueo(ip: string): number {
    const ventana = this.ventanas.get(ip);
    if (ventana === undefined) return 0;
    const restante = ventana.inicio + this.ventanaMs - this.reloj();
    if (restante <= 0 || ventana.fallos < this.opciones.maxFallos) return 0;
    return Math.ceil(restante / 1000);
  }

  /** Cuenta un fallo de autenticación de esa IP. */
  registrarFallo(ip: string): void {
    const ahora = this.reloj();
    const actual = this.ventanas.get(ip);
    const vigente = actual !== undefined && ahora - actual.inicio < this.ventanaMs;
    const ventana: Ventana = vigente ? actual : { inicio: ahora, fallos: 0 };
    ventana.fallos += 1;
    // Se reinserta al final: el orden del mapa es el de actividad y el más viejo es el primero.
    this.ventanas.delete(ip);
    this.ventanas.set(ip, ventana);
    acotar(this.ventanas, this.maxIps);
  }

  /** Recuerda que ese dispositivo autenticó bien desde esa IP. */
  registrarAcierto(ip: string, dispositivoId: string): void {
    const clave = `${ip}|${dispositivoId}`;
    this.aciertos.delete(clave);
    this.aciertos.set(clave, this.reloj());
    acotar(this.aciertos, MAX_ACIERTOS);
  }

  /** ¿Autenticó bien este dispositivo desde esta IP hace poco? */
  esDispositivoConocido(ip: string, dispositivoId: string): boolean {
    const cuando = this.aciertos.get(`${ip}|${dispositivoId}`);
    return cuando !== undefined && this.reloj() - cuando < MEMORIA_DE_ACIERTOS_MS;
  }
}

/** Descarta las entradas más antiguas hasta quedar dentro del tope (memoria acotada). */
function acotar(mapa: Map<string, unknown>, tope: number): void {
  while (mapa.size > tope) {
    const masAntigua = mapa.keys().next();
    if (masAntigua.done === true) return;
    mapa.delete(masAntigua.value);
  }
}
