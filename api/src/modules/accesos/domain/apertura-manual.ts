/**
 * La apertura manual desde la app (ADR 0035): reglas puras, sin base ni HTTP. La API valida la petición como
 * valida un QR (usuario activo, suscripción, puerta de la cuenta y habilitada) y además comprueba que la puerta
 * tenga placa y conexión y que el usuario no abuse (enfriamiento y tope diario, ADR 0030). Aquí solo se decide;
 * `actions/abrir-puerta-manual.ts` lee y escribe.
 */

import type { CausaDeFalla } from './confirmacion.js';

/** Cuánto vive una orden de abrir desde que se crea (ADR 0035 §3); la tabla nunca admite más de 30 s. */
export const VIGENCIA_DE_ORDEN_MS = 15_000;

/** El motivo que queda en `lecturas.motivo_code` cuando la API crea la orden. */
export const MOTIVO_ORDENADA = 'manual.ordenada';

/** Motivos de rechazo de una petición de apertura manual (se guardan en `lecturas.motivo_code`). */
export type MotivoManualRechazado =
  | 'manual.usuario_restringido'
  | 'manual.usuario_suspendido'
  | 'manual.cuenta_suspendida'
  | 'manual.usuario_eliminado'
  | 'manual.suscripcion_vencida'
  | 'manual.no_habilitada'
  | 'manual.sin_dispositivo'
  | 'manual.sin_conexion'
  | 'manual.orden_en_curso'
  | 'manual.limite';

/** Lo que responde la API ante cada rechazo: el código del error (RFC 9457), su estado HTTP y el motivo guardado. */
export interface RechazoDeApertura {
  readonly motivo: MotivoManualRechazado;
  /** Código del problema: casi siempre el mismo motivo; `puerta.*` y `suscripcion.vencida` repiten los de la API. */
  readonly codigo: string;
  readonly status: number;
  readonly extra: Readonly<Record<string, unknown>>;
}

const rechazo = (
  motivo: MotivoManualRechazado,
  codigo: string,
  status: number,
  extra: Readonly<Record<string, unknown>> = {},
): RechazoDeApertura => ({ motivo, codigo, status, extra });

export interface EntradaDeApertura {
  /** Estado efectivo de quien pide (el peor entre el suyo, el de sus superiores y el de su cuenta). */
  readonly usuario: {
    readonly estado: 'activo' | 'restringido' | 'suspendido' | 'eliminado';
    readonly origen: 'usuario' | 'superior' | 'cuenta' | null;
  };
  readonly suscripcionVigente: boolean;
  /** El administrador encendió la apertura manual en la puerta. */
  readonly puertaHabilitada: boolean;
  readonly placas: { readonly enServicio: number; readonly enLinea: number };
  /** Hay una orden pendiente o entregada y vigente en la puerta (de cualquier usuario). */
  readonly hayOrdenViva: boolean;
  /** Cuándo se creó la última orden de este usuario sobre esta puerta, si hay. */
  readonly ultimaOrdenDelUsuarioAt: Date | null;
  /** Órdenes que el usuario pidió hoy (día local del sitio). */
  readonly ordenesDeHoy: number;
  readonly topes: { readonly enfriamientoSegundos: number; readonly topeDiario: number };
  readonly ahora: Date;
  /** Cuándo empieza el día siguiente en el sitio (para decir cuándo se renueva el tope diario). */
  readonly finDelDia: Date;
}

const segundosHasta = (instante: Date, ahora: Date): number =>
  Math.max(1, Math.ceil((instante.getTime() - ahora.getTime()) / 1000));

/**
 * El primer rechazo que corresponde a la petición, o `null` si se puede ordenar abrir. El orden es el de la
 * gravedad para quien pide: primero quién es (estado, suscripción), después la puerta (habilitada, placa,
 * conexión), después el estado de la puerta (orden en curso) y al final los topes de abuso. Ante un estado de
 * usuario que no se reconoce, no abre (falla cerrado).
 */
export function decidirApertura(entrada: EntradaDeApertura): RechazoDeApertura | null {
  const { usuario, topes, ahora } = entrada;
  if (usuario.estado === 'restringido') {
    return rechazo('manual.usuario_restringido', 'manual.usuario_restringido', 403);
  }
  if (usuario.estado === 'suspendido') {
    return usuario.origen === 'cuenta'
      ? rechazo('manual.cuenta_suspendida', 'manual.cuenta_suspendida', 403)
      : rechazo('manual.usuario_suspendido', 'manual.usuario_suspendido', 403);
  }
  if (usuario.estado !== 'activo') {
    return rechazo('manual.usuario_eliminado', 'manual.usuario_eliminado', 403);
  }
  if (!entrada.suscripcionVigente) {
    return rechazo('manual.suscripcion_vencida', 'suscripcion.vencida', 403);
  }
  if (!entrada.puertaHabilitada)
    return rechazo('manual.no_habilitada', 'manual.no_habilitada', 409);
  if (entrada.placas.enServicio === 0) {
    return rechazo('manual.sin_dispositivo', 'puerta.sin_dispositivo', 409);
  }
  if (entrada.placas.enLinea === 0)
    return rechazo('manual.sin_conexion', 'puerta.sin_conexion', 409);
  if (entrada.hayOrdenViva) return rechazo('manual.orden_en_curso', 'manual.orden_en_curso', 409);

  if (entrada.ultimaOrdenDelUsuarioAt !== null) {
    const libreEn = new Date(
      entrada.ultimaOrdenDelUsuarioAt.getTime() + topes.enfriamientoSegundos * 1000,
    );
    if (libreEn > ahora) {
      return rechazo('manual.limite', 'manual.limite', 429, {
        tipo: 'enfriamiento',
        tope: topes.enfriamientoSegundos,
        reintentar_en_segundos: segundosHasta(libreEn, ahora),
      });
    }
  }
  if (entrada.ordenesDeHoy >= topes.topeDiario) {
    return rechazo('manual.limite', 'manual.limite', 429, {
      tipo: 'diario',
      tope: topes.topeDiario,
      reintentar_en_segundos: segundosHasta(entrada.finDelDia, ahora),
    });
  }
  return null;
}

export type EstadoDeOrden = 'pendiente' | 'entregada' | 'ejecutada' | 'fallida' | 'vencida';

/**
 * Cuánto después de `vence_at` se espera todavía el resultado de una orden YA ENTREGADA antes de darla por vencida.
 * `vence_at` es el plazo para que una placa TOME la orden y empiece el pulso; el resultado llega después: el pulso
 * (hasta 10 s) más lo que la placa observa su sensor (`segundos_apertura` + 5 s) más la red. Sin esta gracia, una
 * orden tomada a los 14 s se daría por vencida a los 15 s y el informe legítimo de la placa se rechazaría. No aplica
 * a una orden `pendiente`: esa nadie la tomó y no hay nada que esperar.
 */
export const GRACIA_DE_RESULTADO_MS = 30_000;

/**
 * El estado que se muestra a la app. Una orden `pendiente` cuyo plazo ya pasó, o una `entregada` que además agotó la
 * gracia para informar, sigue así en la tabla hasta que el proceso periódico la marque; la app no debe esperarla
 * para siempre, así que ve `vencida`. Mientras una orden entregada está dentro de la gracia se sigue viendo
 * `entregada` (la placa puede estar observando su sensor).
 */
export function estadoVisible(estado: EstadoDeOrden, venceAt: Date, ahora: Date): EstadoDeOrden {
  if (estado === 'pendiente') return venceAt <= ahora ? 'vencida' : estado;
  if (estado === 'entregada') {
    return venceAt.getTime() + GRACIA_DE_RESULTADO_MS <= ahora.getTime() ? 'vencida' : estado;
  }
  return estado;
}

/** Lo que una placa informa de una orden: cómo terminó el pulso y qué vio. Pares válidos de `confirmaciones_apertura`. */
export type ResultadoDeOrden =
  | { readonly resultado: 'ejecutada'; readonly causa: 'puerta_abrio' }
  | { readonly resultado: 'fallida'; readonly causa: CausaDeFalla }
  | { readonly resultado: 'sin_confirmacion'; readonly causa: 'sin_sensor' };

/**
 * En qué estado queda la ORDEN tras el informe de la placa. Una puerta sin sensor (`sin_confirmacion`) igual accionó
 * el relé: la orden se ejecutó, solo que no hay forma de saber si la puerta se abrió (no se inventa un éxito, y la
 * confirmación lo dice). `fallida`, en cambio, es que la placa no pudo accionar o no vio abrir.
 */
export function estadoDeOrdenTras(informe: ResultadoDeOrden): 'ejecutada' | 'fallida' {
  return informe.resultado === 'fallida' ? 'fallida' : 'ejecutada';
}
