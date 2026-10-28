import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorDeDominio } from '../errores/error-de-dominio.js';

/**
 * Refresco de la sesión en cookie `HttpOnly` para los clientes de navegador (ADR 0033 §5).
 *
 * El navegador no puede guardar un secreto a salvo de un XSS, así que el refresco viaja en una cookie
 * que JavaScript no lee. La app nativa y el firmware siguen con el cuerpo de la petición: no son
 * navegadores y no tienen CSRF.
 *
 * Un cliente de navegador se anuncia con `X-Requested-With: agrocom-panel` o `agrocom-app`. Es una
 * cabecera propia: una página ajena no puede enviarla sin un permiso CORS que esta API no da, y eso es
 * una de las tres capas contra CSRF (las otras: `SameSite=Strict` y la comprobación de `Origin`).
 * Panel y app web comparten dominio, así que cada uno tiene su cookie: ingresar en uno no cierra el otro.
 */
export type ClienteWeb = 'panel' | 'app';

const VALORES_DE_LA_CABECERA: Readonly<Record<string, ClienteWeb>> = {
  'agrocom-panel': 'panel',
  'agrocom-app': 'app',
};

/** El prefijo `__Host-` obliga a `Secure`, `Path=/` y ningún `Domain`: la cookie no se fija desde un subdominio. */
const NOMBRE_DE_LA_COOKIE: Readonly<Record<ClienteWeb, string>> = {
  panel: '__Host-refresco-panel',
  app: '__Host-refresco-app',
};

const SEGUNDOS_POR_DIA = 86_400;

/** El cliente de navegador que hace la petición, o `null` si es la app nativa u otro cliente. */
export function clienteWebDe(request: FastifyRequest): ClienteWeb | null {
  const valor = request.headers['x-requested-with'];
  return typeof valor === 'string' ? (VALORES_DE_LA_CABECERA[valor] ?? null) : null;
}

/** El refresco que el navegador adjuntó en su cookie, si lo hay. */
export function refrescoDeLaCookie(
  request: FastifyRequest,
  cliente: ClienteWeb,
): string | undefined {
  const nombre = NOMBRE_DE_LA_COOKIE[cliente];
  const cabecera = request.headers.cookie;
  if (cabecera === undefined) return undefined;
  for (const par of cabecera.split(';')) {
    const corte = par.indexOf('=');
    if (corte > 0 && par.slice(0, corte).trim() === nombre) {
      const valor = par.slice(corte + 1).trim();
      return valor === '' ? undefined : valor;
    }
  }
  return undefined;
}

/**
 * Con la cookie hay que comprobar el origen: `Origin` debe existir y ser el propio dominio. Se compara el
 * nombre de host sin puerto, porque el proxy reenvía `Host` sin el puerto del navegador.
 */
export function exigirOrigenPropio(request: FastifyRequest): void {
  const origen = request.headers.origin;
  let host: string | null = null;
  if (typeof origen === 'string') {
    try {
      host = new URL(origen).hostname;
    } catch {
      host = null;
    }
  }
  if (host === null || host !== request.hostname.replace(/:\d+$/, '')) {
    throw new ErrorDeDominio('sesion.origen_invalido', 403);
  }
}

/** Pone el refresco en la cookie de ese cliente; dura lo que el refresco (`dias`). */
export function fijarCookieDeRefresco(
  reply: FastifyReply,
  cliente: ClienteWeb,
  refresco: string,
  dias: number,
): void {
  reply.header(
    'set-cookie',
    `${NOMBRE_DE_LA_COOKIE[cliente]}=${refresco}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${String(dias * SEGUNDOS_POR_DIA)}`,
  );
}

/** Borra la cookie de ese cliente (cierre de sesión o refresco rechazado). */
export function borrarCookieDeRefresco(reply: FastifyReply, cliente: ClienteWeb): void {
  reply.header(
    'set-cookie',
    `${NOMBRE_DE_LA_COOKIE[cliente]}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
  );
}
