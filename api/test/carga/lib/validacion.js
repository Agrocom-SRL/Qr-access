// La validación desde la placa (ADR 0009, ADR 0032). Este módulo reproduce la regla de la puerta sin
// decidir nada: abriría solo con un 200 y `abrir: true` del servidor; cualquier otra respuesta es falla segura.
import { pedir, leer } from './http.js';
import { respuestasNoValidas, validacionesAbren, rechazos, primerosUsosRechazados } from './metricas.js';

/**
 * Valida un QR con la credencial del dispositivo (invariante 5). Devuelve:
 *  - `valida`: la respuesta tiene la forma que la placa entiende (200, `abrir` booleano, `evento_id`);
 *  - `abre`: la placa abriría (valida y `abrir: true`).
 * Cuenta las respuestas no válidas por `endpoint`, para que una caída bajo carga sea visible.
 */
export function validarQr(dispositivo, texto, tags, { primerUso = false } = {}) {
  const res = pedir(
    'POST',
    '/dispositivos/validaciones',
    { token: texto, leido_en: new Date().toISOString() },
    { tags, dispositivo },
  );
  const cuerpo = leer(res);
  const valida =
    res.status === 200 &&
    cuerpo !== null &&
    typeof cuerpo.abrir === 'boolean' &&
    typeof cuerpo.evento_id === 'string';
  const abre = valida && cuerpo.abrir === true;

  if (!valida) respuestasNoValidas.add(1, { endpoint: tags.endpoint, status: String(res.status) });
  if (abre) validacionesAbren.add(1, { endpoint: tags.endpoint });
  else if (valida) rechazos.add(1, { endpoint: tags.endpoint, motivo: cuerpo.motivo_code });
  if (primerUso && !abre) {
    primerosUsosRechazados.add(1, { endpoint: tags.endpoint, motivo: valida ? cuerpo.motivo_code : String(res.status) });
  }
  return { res, cuerpo, valida, abre };
}
