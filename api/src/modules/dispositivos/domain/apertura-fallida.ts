/**
 * Cuándo una puerta cuenta como «de las que fallan al abrir» (ADR 0031 §18, ola W10). Puro: no toca la base.
 * Una apertura FALLA si la placa informó `fallida` o si, teniendo sensor, no contestó a tiempo (`sin_respuesta`).
 * Solo se juzgan los dispositivos con el sensor habilitado por AGROCOM (`sensor_instalado = 1`): sin sensor no se sabe
 * si la puerta abrió y no se inventa ni un éxito ni una falla.
 *
 * Límite que no se puede cerrar desde el servidor: `ejecutada` lo informa la propia placa con SU sensor. Una placa
 * con el sensor trabado, mal cableado o un firmware que miente puede decir que abrió sin que la puerta se moviera.
 * El detector solo atrapa lo que la placa admite (`fallida`) o calla (`sin_respuesta`).
 */

/** Lo mínimo de la ejecución de una apertura que este juicio necesita. */
export interface EjecucionParaJuzgar {
  readonly eventoId: string;
  readonly dispositivoId: string;
  readonly resultado: 'ejecutada' | 'fallida' | 'sin_confirmacion';
  readonly causa: string;
  /** Hora del servidor en que se registró. */
  readonly registradaAt: Date;
}

export interface UmbralesDeApertura {
  /** Fallas dentro de la ventana que hacen falta para abrir el aviso (un caso aislado no avisa). */
  readonly fallidasMinimo: number;
  readonly ventanaSegundos: number;
}

export interface FallaDeDispositivo {
  readonly dispositivoId: string;
  /** Fallas seguidas en la ventana (desde la última apertura ejecutada, si la hubo). */
  readonly fallos: number;
  /** Causa de la última falla. */
  readonly ultimaCausa: string;
  /** Cuándo se registró la primera de esas fallas. */
  readonly desde: Date;
}

/** Falla en sí: lo que la placa dice `fallida` o la falta de respuesta. Vale para cualquier dispositivo. */
export function esFalla(ejecucion: Pick<EjecucionParaJuzgar, 'resultado' | 'causa'>): boolean {
  return (
    ejecucion.resultado === 'fallida' ||
    (ejecucion.resultado === 'sin_confirmacion' && ejecucion.causa === 'sin_respuesta')
  );
}

/**
 * Falla de un dispositivo CON sensor habilitado. Si la placa informa `sin_sensor` pese a tener el sensor habilitado,
 * se trata como `sin_respuesta` (cuenta como falla): una placa que no ve el contacto que debería ver no confirma
 * nada (cableado caído, configuración desfasada). Se prefirió esto a rechazar el informe con 409, que el firmware
 * no sabría resolver y dejaría el hecho sin registrar. El informe se guarda tal cual lo dijo la placa.
 */
function esFallaConSensor(ejecucion: Pick<EjecucionParaJuzgar, 'resultado' | 'causa'>): boolean {
  return (
    esFalla(ejecucion) ||
    (ejecucion.resultado === 'sin_confirmacion' && ejecucion.causa === 'sin_sensor')
  );
}

/**
 * Los dispositivos que hoy fallan: los que tienen al menos `fallidasMinimo` fallas en la ventana, contadas
 * desde su última apertura `ejecutada` (si la puerta volvió a abrir, el problema se dio por superado). Orden
 * cronológico por hora de registro y, a igual hora, por id del evento. Las ejecuciones de un dispositivo que no está
 * en `conSensor` (sensor no habilitado) se ignoran por completo.
 */
export function dispositivosQueFallan(
  ejecuciones: readonly EjecucionParaJuzgar[],
  ahora: Date,
  umbrales: UmbralesDeApertura,
  conSensor: ReadonlySet<string>,
): Map<string, FallaDeDispositivo> {
  const inicio = ahora.getTime() - umbrales.ventanaSegundos * 1000;
  const porDispositivo = new Map<string, EjecucionParaJuzgar[]>();
  for (const ejecucion of ejecuciones) {
    if (!conSensor.has(ejecucion.dispositivoId)) continue;
    const instante = ejecucion.registradaAt.getTime();
    if (instante <= inicio || instante > ahora.getTime()) continue;
    porDispositivo.set(ejecucion.dispositivoId, [
      ...(porDispositivo.get(ejecucion.dispositivoId) ?? []),
      ejecucion,
    ]);
  }
  const resultado = new Map<string, FallaDeDispositivo>();
  for (const [dispositivoId, propias] of porDispositivo) {
    const ordenadas = [...propias].sort(
      (a, b) =>
        a.registradaAt.getTime() - b.registradaAt.getTime() ||
        Number(a.eventoId) - Number(b.eventoId),
    );
    const ultimaEjecutada = ordenadas.map((e) => e.resultado).lastIndexOf('ejecutada');
    const fallas = ordenadas.slice(ultimaEjecutada + 1).filter(esFallaConSensor);
    const primera = fallas[0];
    const ultima = fallas[fallas.length - 1];
    if (primera === undefined || ultima === undefined || fallas.length < umbrales.fallidasMinimo) {
      continue;
    }
    resultado.set(dispositivoId, {
      dispositivoId,
      fallos: fallas.length,
      ultimaCausa: ultima.causa,
      desde: primera.registradaAt,
    });
  }
  return resultado;
}

/** Cuánto hacia atrás se buscan aperturas que quedaron sin informe (más viejas ya no aportan nada al aviso). */
export const BUSQUEDA_DE_APERTURAS_SIN_INFORME_HORAS = 24;

/** Tope de constancias `sin_respuesta` que se dejan por cuenta y por pasada (el resto, en la siguiente). */
export const TOPE_DE_CONSTANCIAS_POR_PASADA = 500;

/** Tope de filas de ejecución que se leen por cuenta y pasada; la ventana de una puerta nunca se acerca. */
export const TOPE_DE_EJECUCIONES_LEIDAS = 20_000;

/** Claves de grupo: un aviso por sitio, como los de placa. */
export function claveDeGrupoDeApertura(sitioId: string): string {
  return `apertura.fallida:sitio:${sitioId}`;
}
