import type { TFunction } from 'i18next';
import {
  formatearDecimal,
  formatearDiaCalendario,
  formatearMes,
  formatearNumero,
} from '../../../l10n/formatos';
import type { Notificacion } from '../domain/notificacion';

/**
 * Las líneas de texto de los avisos de señales, bolsa y flujo (ADR 0030 §6). Cada cifra sale del
 * aviso; si la API no la trae, la línea lo dice en vez de inventarla. Nunca lleva un token, una IP
 * ni un id que no sea de usuario.
 */
export function lineasDeAviso(notificacion: Notificacion, t: TFunction, idioma: string): string[] {
  const lineas: string[] = [];
  const senal = notificacion.senal;
  if (senal) {
    lineas.push(t(`senales:lista.tipo.${senal.tipo}`));
    lineas.push(
      senal.usuarioEtiqueta === null
        ? t('notificaciones:senal.usuarioSinNombre')
        : t('notificaciones:senal.usuario', { usuario: senal.usuarioEtiqueta }),
    );
    lineas.push(
      t('notificaciones:senal.medido', {
        valor: formatearNumero(senal.valor, idioma),
        umbral: formatearNumero(senal.umbral, idioma),
      }),
    );
    lineas.push(t('notificaciones:senal.dia', { dia: formatearDiaCalendario(senal.dia, idioma) }));
  }
  const bolsa = notificacion.bolsa;
  if (bolsa) {
    const mes = formatearMes(bolsa.mes, idioma);
    lineas.push(
      bolsa.usado === null || bolsa.tope === null
        ? t('notificaciones:bolsa.sinCifras', { mes })
        : t('notificaciones:bolsa.usado', {
            usado: formatearNumero(bolsa.usado, idioma),
            tope: formatearNumero(bolsa.tope, idioma),
            mes,
          }),
    );
  }
  const flujo = notificacion.flujo;
  if (flujo) {
    lineas.push(
      t('notificaciones:flujo.aperturas', {
        aperturas: formatearNumero(flujo.aperturas, idioma),
        usuarios: formatearNumero(flujo.usuariosActivos, idioma),
      }),
    );
    lineas.push(
      t('notificaciones:flujo.porUsuario', {
        porUsuario: formatearDecimal(flujo.porUsuario, idioma),
        umbral: formatearNumero(flujo.umbralPorUsuario, idioma),
      }),
    );
    lineas.push(
      flujo.base === null
        ? t('notificaciones:flujo.sinBase')
        : t('notificaciones:flujo.base', { base: formatearDecimal(flujo.base, idioma) }),
    );
    lineas.push(t('notificaciones:flujo.dia', { dia: formatearDiaCalendario(flujo.dia, idioma) }));
  }
  return lineas;
}
