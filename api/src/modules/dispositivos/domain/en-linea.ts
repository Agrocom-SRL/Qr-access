/**
 * El firmware manda un latido cada 60 s (`PERIODO_LATIDO_MS`). Con tres períodos sin noticias
 * se da por perdida la conexión: un latido tardío por WiFi flojo no debe parpadear el estado.
 */
export const LATIDO_MAXIMO_SEGUNDOS = 180;

/** ¿El dispositivo reportó hace poco? Sin latido alguno, nunca estuvo en línea (HU-09). */
export function estaEnLinea(ultimoLatidoAt: Date | null, ahora: Date): boolean {
  if (ultimoLatidoAt === null) return false;
  return ahora.getTime() - ultimoLatidoAt.getTime() <= LATIDO_MAXIMO_SEGUNDOS * 1000;
}
