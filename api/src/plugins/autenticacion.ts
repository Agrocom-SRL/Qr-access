import { normalizeIP } from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ContextoCuenta, type DatosContexto } from '../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../platform/errores/error-de-dominio.js';
import type { LimiteDeFallosDeAutenticacion } from '../platform/seguridad/limite-de-fallos-de-autenticacion.js';
import type { Autenticadores, Principal, TipoDeAcceso } from '../platform/seguridad/principal.js';

const ENCABEZADO_USUARIO = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
const ENCABEZADO_DISPOSITIVO = /^Dispositivo (\d{1,19})\.([A-Za-z0-9_-]{16,128})$/;

async function identificar(
  request: FastifyRequest,
  acceso: Exclude<TipoDeAcceso, 'publica'>,
  autenticadores: Autenticadores,
  fallos: LimiteDeFallosDeAutenticacion,
): Promise<Principal> {
  const encabezado = request.headers.authorization ?? '';
  const ip = normalizeIP(request.ip);
  const credencial = ENCABEZADO_DISPOSITIVO.exec(encabezado);
  const dispositivoId = acceso === 'dispositivo' ? credencial?.[1] : undefined;

  // Una IP que ya acumuló demasiados fallos no llega a verificar nada (ni gasta el hash), salvo
  // un dispositivo que autenticó bien desde ella hace poco (IP compartida de un sitio).
  const conocido = dispositivoId !== undefined && fallos.esDispositivoConocido(ip, dispositivoId);
  const bloqueo = conocido ? 0 : fallos.segundosDeBloqueo(ip);
  if (bloqueo > 0) {
    request.log.warn({ clase: 'fallos_autenticacion' }, 'límite de uso excedido');
    throw new ErrorDeDominio('limite.excedido', 429, { reintentar_en_segundos: bloqueo });
  }

  try {
    const principal = await verificar(acceso, autenticadores, encabezado, credencial);
    if (principal.tipo === 'dispositivo') fallos.registrarAcierto(ip, principal.dispositivoId);
    return principal;
  } catch (error) {
    if (error instanceof ErrorDeDominio && error.status === 401) fallos.registrarFallo(ip);
    throw error;
  }
}

async function verificar(
  acceso: Exclude<TipoDeAcceso, 'publica'>,
  autenticadores: Autenticadores,
  encabezado: string,
  credencial: RegExpExecArray | null,
): Promise<Principal> {
  if (acceso === 'usuario' || acceso === 'plataforma') {
    const jwt = ENCABEZADO_USUARIO.exec(encabezado)?.[1];
    const principal =
      jwt === undefined
        ? null
        : acceso === 'usuario'
          ? await autenticadores.autenticarUsuario(jwt)
          : await autenticadores.autenticarPlataforma(jwt);
    if (principal === null) throw new ErrorDeDominio('autenticacion.requerida', 401);
    return principal;
  }

  const principal =
    credencial?.[1] === undefined || credencial[2] === undefined
      ? null
      : await autenticadores.autenticarDispositivo(credencial[1], credencial[2]);
  if (principal === null) throw new ErrorDeDominio('dispositivo.credencial_invalida', 401);
  return principal;
}

function contextoDe(principal: Principal): DatosContexto {
  if (principal.tipo === 'plataforma') {
    // Sin cuenta: tocar una tabla de cuenta falla cerrado (ADR 0004 §7).
    return {
      cuentaId: null,
      usuarioId: principal.usuarioId,
      rolActivoId: null,
      dispositivoId: null,
      origen: 'api',
    };
  }
  if (principal.tipo === 'usuario') {
    return {
      cuentaId: principal.cuentaId,
      usuarioId: principal.usuarioId,
      rolActivoId: principal.rolActivoId,
      dispositivoId: null,
      origen: 'api',
    };
  }
  return {
    cuentaId: principal.cuentaId,
    usuarioId: null,
    rolActivoId: null,
    dispositivoId: principal.dispositivoId,
    origen: 'dispositivo',
  };
}

/**
 * Autentica cada petición y abre el `ContextoCuenta` en el que corre el resto de la cadena
 * (ADR 0004). Una ruta que no declare `config.acceso` exige un usuario: se falla cerrado.
 * Las rutas que no existen (404) no pasan por acá.
 */
export function registrarAutenticacion(
  app: FastifyInstance,
  autenticadores: Autenticadores,
  fallos: LimiteDeFallosDeAutenticacion,
): void {
  app.addHook('onRequest', (request, _reply, done) => {
    if (request.is404) {
      done();
      return;
    }
    const acceso = request.routeOptions.config.acceso ?? 'usuario';
    if (acceso === 'publica') {
      done();
      return;
    }
    identificar(request, acceso, autenticadores, fallos).then(
      (principal) => {
        request.principal = principal;
        // `done` corre dentro del contexto: el resto de los hooks y el handler lo heredan.
        ContextoCuenta.ejecutar(contextoDe(principal), () => {
          done();
        });
      },
      (error: unknown) => {
        done(error as Error);
      },
    );
  });
}
