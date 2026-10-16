import * as argon2 from 'argon2';

/** Parámetros de argon2id (OWASP: 19 MiB, 2 pasadas, 1 hilo). Cada hash los lleva dentro. */
const PARAMETROS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hash argon2id de una contraseña, un PIN o la clave de un dispositivo (invariante 6). */
export function hashear(secreto: string): Promise<string> {
  return argon2.hash(secreto, PARAMETROS);
}

/** `false` ante un hash mal formado en vez de lanzar: un dato corrupto no es un 500. */
export async function verificarHash(hash: string, secreto: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, secreto);
  } catch {
    return false;
  }
}

let hashDeRelleno: Promise<string> | undefined;

/**
 * Gasta el mismo tiempo que una verificación real. Se llama cuando no hay nada que verificar
 * (cuenta o dispositivo inexistente) para que la respuesta no revele si existe.
 */
export async function verificarContraRelleno(secreto: string): Promise<false> {
  hashDeRelleno ??= hashear('relleno-sin-uso');
  await verificarHash(await hashDeRelleno, secreto);
  return false;
}
