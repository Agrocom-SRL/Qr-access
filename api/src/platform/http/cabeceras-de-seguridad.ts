import type { FastifyInstance, FastifyReply } from 'fastify';

/**
 * Cabeceras de toda respuesta de la API (ADR 0033 §2).
 *
 * - `Cache-Control: no-store` y `Vary: Authorization`: nada de lo que devuelve la API se
 *   guarda en una caché compartida, ni siquiera un error o un 404. Una URL con sufijo
 *   estático (`/x.js`) no es motivo para que un proxy la trate como un archivo cacheable.
 * - `nosniff`, `Referrer-Policy` y `Permissions-Policy`: la API solo sirve JSON; el navegador
 *   no debe adivinar otro tipo ni exponer nada.
 *
 * HSTS y la CSP las pone el proxy (NPMplus), no la API.
 */
export const CABECERAS_DE_SEGURIDAD: Readonly<Record<string, string>> = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/**
 * Registra el hook `onSend` raíz: corre para toda respuesta, también las de error y las del
 * 404, y como se registra antes que las rutas lo heredan todos los plugins hijos.
 */
export function registrarCabecerasDeSeguridad(app: FastifyInstance): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    aplicarCabecerasDeSeguridad(reply);
    return payload;
  });
}

/**
 * Pone las cabeceras en una respuesta. Se usa también en `frameworkErrors` (URL mal formada),
 * que responde antes de enrutar y no pasa por los hooks.
 */
export function aplicarCabecerasDeSeguridad(reply: FastifyReply): void {
  for (const [nombre, valor] of Object.entries(CABECERAS_DE_SEGURIDAD)) {
    void reply.header(nombre, valor);
  }
  // `Vary` se acumula: no se pisa lo que otro plugin (p. ej. CORS) haya puesto.
  const actual = reply.getHeader('vary');
  const valores = (Array.isArray(actual) ? actual.join(',') : String(actual ?? ''))
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');
  if (!valores.some((v) => v.toLowerCase() === 'authorization' || v === '*')) {
    valores.push('Authorization');
  }
  void reply.header('vary', valores.join(', '));
}
