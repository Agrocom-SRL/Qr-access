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

/** Prefijo del motivo que lleva el estado que impone la reincidencia (`incidente.reincidencia:<id>`). */
const MOTIVO_REINCIDENCIA = 'incidente.reincidencia';
/** El id del incidente: solo dígitos. Lo que no lo sea no se mete en el texto. */
const ID_DE_INCIDENTE = /^\d{1,19}$/;

/**
 * Traduce el `estado_motivo` de un usuario o de una cuenta (ADR 0033 §4). Casi todos son un `code` suelto,
 * como `traducirError`. El de reincidencia lleva el id del incidente que lo provocó (`incidente.reincidencia:<id>`):
 * el id va como parámetro del texto, nunca concatenado en una frase traducida.
 */
export function traducirMotivoDeEstado(t: TFunction, motivo: string): string {
  const separador = motivo.indexOf(':');
  const codigo = separador === -1 ? motivo : motivo.slice(0, separador);
  const id = separador === -1 ? '' : motivo.slice(separador + 1);
  if (codigo !== MOTIVO_REINCIDENCIA) return traducirError(t, codigo);
  return ID_DE_INCIDENTE.test(id)
    ? t('errores:incidente_reincidencia', { incidente: id })
    : t('errores:incidente_reincidencia_sin_id');
}
