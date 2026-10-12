import type { TFunction } from 'i18next';

/**
 * Traduce el `code` de un error de la API (RFC 9457, ADR 0005) al texto del namespace
 * `errores`. Los puntos del código pasan a `_` porque i18next los usa como separador de
 * claves. Un código sin traducción cae en `desconocido`.
 */
export function traducirError(
  t: TFunction,
  code: string | undefined,
  parametros: Record<string, unknown> = {},
): string {
  const clave = code?.replaceAll('.', '_') ?? '';
  const respaldo = t('errores:desconocido');
  if (!clave) return respaldo;
  return t(`errores:${clave}`, { ...parametros, defaultValue: respaldo });
}
