// Sesiones de usuario para los escenarios. La caché vive dentro de cada VU (el módulo se evalúa una vez por VU),
// así que no se comparte entre VU y no hace falta sincronizarla.
import { pedir, leer } from './http.js';

const sesiones = {};

/**
 * Entra con el PIN de un usuario (ADR 0018). Devuelve siempre el estado HTTP y, si entró, los tokens.
 * `tags` permite separar el login normal del que prueba el límite (ADR 0030 §3.2).
 */
export function iniciarSesion(usuario, { ip, tags = { endpoint: 'login' } } = {}) {
  const res = pedir('POST', '/sesiones', { pin: usuario.pin }, { tags, ip });
  const cuerpo = leer(res);
  if (res.status !== 200 || cuerpo === null) return { status: res.status, acceso: null, refresco: null, res };
  return { status: res.status, acceso: cuerpo.acceso, refresco: cuerpo.refresco, res };
}

/**
 * Token de acceso del usuario para este VU: entra la primera vez y después reutiliza el token. Quien
 * reciba un 401 (el token dura JWT_ACCESO_MINUTOS, 15 por omisión) llama a `olvidarToken` y vuelve a pedirlo.
 * `indice` identifica al usuario dentro del archivo de datos.
 */
export function tokenDe(usuario, indice) {
  if (!sesiones[indice]) {
    const sesion = iniciarSesion(usuario);
    if (sesion.acceso === null) return null;
    sesiones[indice] = sesion.acceso;
  }
  return sesiones[indice];
}

/** Olvida el token de un usuario (tras un 401, o para forzar un login nuevo). */
export function olvidarToken(indice) {
  delete sesiones[indice];
}
