import rateLimit, { normalizeIP } from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../config.js';
import { ErrorDeDominio } from '../platform/errores/error-de-dominio.js';
import type { Principal } from '../platform/seguridad/principal.js';

/**
 * Qué tipo de ruta es, a efectos del rate limit (ADR 0030 §3.2). Se declara por ruta con
 * `config: { limite: '…' }`; sin declarar, `lectura` para GET y `escritura` para el resto,
 * o `dispositivo` en las rutas del dispositivo.
 */
export type ClaseDeLimite =
  | 'login'
  | 'refresco'
  | 'anuncio'
  | 'generar_qr'
  | 'escritura'
  | 'lectura'
  | 'exportacion'
  | 'validacion'
  | 'dispositivo'
  | 'ordenes';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Clase de rate limit de la ruta; `'ninguno'` la deja fuera. */
    limite?: ClaseDeLimite | 'ninguno';
  }
}

/** Todas las clases cuentan por minuto: el valor de cada una es configuración. */
const VENTANA_MS = 60_000;
/** Claves que el limitador recuerda a la vez (el LRU descarta las más viejas, no falla). */
const CLAVES_EN_MEMORIA = 50_000;

function maximosDe(config: Config): Readonly<Record<ClaseDeLimite, number>> {
  return {
    login: config.LIMITE_LOGIN_POR_MINUTO,
    refresco: config.LIMITE_REFRESCO_POR_MINUTO,
    anuncio: config.LIMITE_ANUNCIO_POR_MINUTO,
    generar_qr: config.LIMITE_GENERAR_QR_POR_MINUTO,
    escritura: config.LIMITE_ESCRITURA_POR_MINUTO,
    lectura: config.LIMITE_LECTURA_POR_MINUTO,
    exportacion: config.LIMITE_EXPORTACION_POR_MINUTO,
    validacion: config.LIMITE_VALIDACION_POR_MINUTO,
    dispositivo: config.LIMITE_DISPOSITIVO_POR_MINUTO,
    ordenes: config.LIMITE_ORDENES_POR_MINUTO,
  };
}

/** La clase de la ruta, o `null` si está fuera del rate limit. */
export function claseDe(request: FastifyRequest): ClaseDeLimite | null {
  const { limite, acceso } = request.routeOptions.config;
  if (limite === 'ninguno') return null;
  if (limite !== undefined) return limite;
  if (acceso === 'dispositivo') return 'dispositivo';
  return request.method === 'GET' || request.method === 'HEAD' ? 'lectura' : 'escritura';
}

/**
 * Quién cuenta (ADR 0030 §3.2): el dispositivo por su credencial, el usuario por su sesión y,
 * sin sesión, la IP. Se cuenta por quien ya pasó la autenticación (el hook de autenticación
 * corre antes): una cabecera sin verificar nunca elige la clave. Ninguna clave junta a dos
 * cuentas: el id de un usuario o de un dispositivo pertenece a una sola.
 */
function identidadDe(request: FastifyRequest): string {
  const principal = request.principal;
  if (principal?.tipo === 'dispositivo') return `d:${principal.dispositivoId}`;
  if (principal?.tipo === 'usuario') return `u:${principal.usuarioId}`;
  if (principal?.tipo === 'plataforma') return `p:${principal.usuarioId}`;
  return `ip:${normalizeIP(request.ip)}`;
}

/** Qué puerta y qué dispositivo hay detrás de una petición del dispositivo, para el log. */
export function datosDelDispositivo(
  principal: Principal | undefined,
): { dispositivoId: string; puertaId: string } | Record<string, never> {
  return principal?.tipo === 'dispositivo'
    ? { dispositivoId: principal.dispositivoId, puertaId: principal.puertaId }
    : {};
}

/**
 * `@fastify/rate-limit` con la clase de cada ruta y una cuenta por (clase, identidad). Se
 * registra DESPUÉS de la autenticación para ver al principal. El contador vive en memoria:
 * vale para una sola instancia (V1); con más, sale a Redis o a la base (ADR 0030 §3.3).
 *
 * Validar un QR (`validacion`) se cuenta por credencial de dispositivo y con un tope muy
 * por encima de cualquier lectura real: es protección anti-flood, no cuota (ADR 0030 §1).
 * Un 429 nunca depende del rate limit de un usuario: la ruta del dispositivo no lo usa.
 */
export async function registrarLimites(app: FastifyInstance, config: Config): Promise<void> {
  const maximos = maximosDe(config);
  // El plugin calcula la clave antes de consultar `allowList`: una ruta sin clase igual la pasa por acá.
  const claseOSinClase = (request: FastifyRequest): ClaseDeLimite | 'ninguno' =>
    claseDe(request) ?? 'ninguno';
  const maximoDe = (request: FastifyRequest): number => {
    const clase = claseDe(request);
    return clase === null ? Number.MAX_SAFE_INTEGER : maximos[clase];
  };

  await app.register(rateLimit, {
    global: true,
    hook: 'onRequest',
    timeWindow: VENTANA_MS,
    cache: CLAVES_EN_MEMORIA,
    max: maximoDe,
    keyGenerator: (request: FastifyRequest) => `${claseOSinClase(request)}|${identidadDe(request)}`,
    allowList: (request: FastifyRequest) => claseDe(request) === null,
    onExceeded: (request: FastifyRequest) => {
      // Sin la clave: lleva la IP o el id del usuario y no hace falta en el log. De un dispositivo
      // sí van su id y su puerta (no son secretos): sin ellos, un 429 en la puerta no deja rastro
      // de cuál fue (invariante 4: el rechazo no llega a `lecturas`).
      request.log.warn(
        { clase: claseDe(request), ...datosDelDispositivo(request.principal) },
        'límite de uso excedido',
      );
    },
    errorResponseBuilder: (_request, contexto) =>
      new ErrorDeDominio('limite.excedido', 429, {
        reintentar_en_segundos: Math.max(1, Math.ceil(contexto.ttl / 1000)),
      }),
  });
}
