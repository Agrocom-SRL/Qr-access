import type { TFunction } from 'i18next';
import { formatearFecha, formatearMonto } from '../../../l10n/formatos';
import type { EventoBitacora, ValoresDeEvento } from '../domain/evento';

const VACIO = '—';

function texto(valor: unknown): string {
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor) : VACIO;
}

/** Un valor de antes o después, escrito como lo ve el super admin ("vence 22/03/2027", "Plan 200 · Bs 21.600"). */
function describirValores(codigo: string, valores: ValoresDeEvento | null, t: TFunction): string {
  if (valores === null) return VACIO;
  const monto = (valor: unknown) => formatearMonto(Number(valor));
  switch (codigo) {
    case 'suscripcion.plan_cambiado':
      return texto(valores.plan);
    case 'suscripcion.renovada':
      return typeof valores.hasta === 'string'
        ? t('bitacora:valor.vence', { fecha: formatearFecha(valores.hasta) })
        : VACIO;
    case 'suscripcion.suspendida':
    case 'suscripcion.reactivada':
      return valores.estado === 'suspendida'
        ? t('bitacora:valor.suspendida')
        : t('bitacora:valor.activa');
    case 'pago.registrado':
      return `${monto(valores.monto)} · ${texto(valores.referencia)}`;
    case 'plan.precio_editado':
      return `${texto(valores.plan)} · ${monto(valores.precio_anual)}`;
    case 'cuenta.creada':
      return `${texto(valores.nombre)} · ${texto(valores.codigo)}`;
    case 'equipo.agregado':
      return `${texto(valores.etiqueta)} · ${texto(valores.username)}`;
    case 'equipo.desactivado':
      return valores.activo === false
        ? t('bitacora:valor.desactivado')
        : t('bitacora:valor.activo');
    case 'usuario.pin_regenerado':
      return t('bitacora:valor.pin');
    case 'usuario.creado':
      return texto(valores.etiqueta);
    default:
      return (
        Object.entries(valores)
          .map(([campo, valor]) => `${campo}: ${texto(valor)}`)
          .join(' · ') || VACIO
      );
  }
}

export interface EventoDescrito {
  que: string;
  antes: string;
  despues: string;
}

/**
 * El texto de un evento: qué pasó y cómo quedó (README, A10). Un código que el panel todavía no
 * conoce se muestra con su acción genérica ("Editó …"), nunca en crudo.
 */
export function describirEvento(evento: EventoBitacora, t: TFunction): EventoDescrito {
  const conocido = t(`bitacora:evento.${evento.codigo.replaceAll('.', '_')}`, { defaultValue: '' });
  return {
    que:
      conocido !== ''
        ? conocido
        : `${t(`bitacora:acciones.${evento.accion}`)} ${evento.codigo.split('.')[0] ?? ''}`.trim(),
    antes: describirValores(evento.codigo, evento.antes, t),
    despues: describirValores(evento.codigo, evento.despues, t),
  };
}
