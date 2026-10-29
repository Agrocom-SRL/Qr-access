import { describe, expect, it } from 'vitest';
import {
  decidirApertura,
  estadoDeOrdenTras,
  estadoVisible,
  GRACIA_DE_RESULTADO_MS,
  VIGENCIA_DE_ORDEN_MS,
  type EntradaDeApertura,
} from '../../src/modules/accesos/domain/apertura-manual.js';

const ahora = new Date('2026-11-10T15:00:00.000Z');
const finDelDia = new Date('2026-11-11T04:00:00.000Z');

/** Una petición que pasa todo; cada caso cambia una cosa. */
const base: EntradaDeApertura = {
  usuario: { estado: 'activo', origen: null },
  suscripcionVigente: true,
  puertaHabilitada: true,
  placas: { enServicio: 1, enLinea: 1 },
  hayOrdenViva: false,
  ultimaOrdenDelUsuarioAt: null,
  ordenesDeHoy: 0,
  topes: { enfriamientoSegundos: 10, topeDiario: 30 },
  ahora,
  finDelDia,
};
const decidir = (cambios: Partial<EntradaDeApertura>) => decidirApertura({ ...base, ...cambios });

describe('decidirApertura', () => {
  it('con todo en regla no rechaza', () => {
    expect(decidir({})).toBeNull();
  });

  it('el estado del usuario: solo `activo` abre (restringido, suspendido, eliminado y lo desconocido no)', () => {
    expect(decidir({ usuario: { estado: 'restringido', origen: 'usuario' } })?.motivo).toBe(
      'manual.usuario_restringido',
    );
    expect(decidir({ usuario: { estado: 'suspendido', origen: 'usuario' } })?.motivo).toBe(
      'manual.usuario_suspendido',
    );
    expect(decidir({ usuario: { estado: 'suspendido', origen: 'superior' } })?.motivo).toBe(
      'manual.usuario_suspendido',
    );
    expect(decidir({ usuario: { estado: 'suspendido', origen: 'cuenta' } })?.motivo).toBe(
      'manual.cuenta_suspendida',
    );
    expect(decidir({ usuario: { estado: 'eliminado', origen: null } })?.motivo).toBe(
      'manual.usuario_eliminado',
    );
    const raro = { estado: 'otro', origen: null } as unknown as EntradaDeApertura['usuario'];
    expect(decidir({ usuario: raro })?.motivo).toBe('manual.usuario_eliminado');
  });

  it('cada rechazo lleva el código y el estado HTTP que la API responde', () => {
    expect(decidir({ suscripcionVigente: false })).toMatchObject({
      motivo: 'manual.suscripcion_vencida',
      codigo: 'suscripcion.vencida',
      status: 403,
    });
    expect(decidir({ puertaHabilitada: false })).toMatchObject({
      motivo: 'manual.no_habilitada',
      codigo: 'manual.no_habilitada',
      status: 409,
    });
    expect(decidir({ placas: { enServicio: 0, enLinea: 0 } })).toMatchObject({
      motivo: 'manual.sin_dispositivo',
      codigo: 'puerta.sin_dispositivo',
      status: 409,
    });
    expect(decidir({ placas: { enServicio: 2, enLinea: 0 } })).toMatchObject({
      motivo: 'manual.sin_conexion',
      codigo: 'puerta.sin_conexion',
      status: 409,
    });
    expect(decidir({ hayOrdenViva: true })).toMatchObject({
      motivo: 'manual.orden_en_curso',
      codigo: 'manual.orden_en_curso',
      status: 409,
    });
  });

  it('el orden: quién es, luego la puerta, luego la orden viva y al final los topes', () => {
    const todoMal: Partial<EntradaDeApertura> = {
      usuario: { estado: 'restringido', origen: 'usuario' },
      suscripcionVigente: false,
      puertaHabilitada: false,
      placas: { enServicio: 0, enLinea: 0 },
      hayOrdenViva: true,
      ultimaOrdenDelUsuarioAt: ahora,
      ordenesDeHoy: 99,
    };
    expect(decidir(todoMal)?.motivo).toBe('manual.usuario_restringido');
    expect(decidir({ ...todoMal, usuario: base.usuario })?.motivo).toBe(
      'manual.suscripcion_vencida',
    );
    expect(decidir({ ...todoMal, usuario: base.usuario, suscripcionVigente: true })?.motivo).toBe(
      'manual.no_habilitada',
    );
    expect(
      decidir({
        ...todoMal,
        usuario: base.usuario,
        suscripcionVigente: true,
        puertaHabilitada: true,
      })?.motivo,
    ).toBe('manual.sin_dispositivo');
    expect(
      decidir({
        ...todoMal,
        usuario: base.usuario,
        suscripcionVigente: true,
        puertaHabilitada: true,
        placas: { enServicio: 1, enLinea: 1 },
      })?.motivo,
    ).toBe('manual.orden_en_curso');
  });

  describe('enfriamiento', () => {
    it('antes de cumplirse es 429 y dice cuándo reintentar; al cumplirse, pasa', () => {
      const hace3s = new Date(ahora.getTime() - 3_000);
      const rechazo = decidir({ ultimaOrdenDelUsuarioAt: hace3s });
      expect(rechazo).toMatchObject({
        motivo: 'manual.limite',
        codigo: 'manual.limite',
        status: 429,
        extra: { tipo: 'enfriamiento', tope: 10, reintentar_en_segundos: 7 },
      });
      expect(decidir({ ultimaOrdenDelUsuarioAt: new Date(ahora.getTime() - 10_000) })).toBeNull();
    });

    it('con enfriamiento 0 no espera nunca', () => {
      expect(
        decidir({
          ultimaOrdenDelUsuarioAt: ahora,
          topes: { enfriamientoSegundos: 0, topeDiario: 30 },
        }),
      ).toBeNull();
    });
  });

  describe('tope diario', () => {
    it('al llegar al tope es 429 hasta el fin del día del sitio', () => {
      const rechazo = decidir({ ordenesDeHoy: 30 });
      expect(rechazo).toMatchObject({
        motivo: 'manual.limite',
        status: 429,
        extra: { tipo: 'diario', tope: 30 },
      });
      expect(rechazo?.extra.reintentar_en_segundos).toBe(13 * 3600);
      expect(decidir({ ordenesDeHoy: 29 })).toBeNull();
    });
  });
});

describe('estadoVisible', () => {
  const venceAt = new Date(ahora.getTime() + VIGENCIA_DE_ORDEN_MS);

  it('la orden viva dentro de su plazo se ve como está', () => {
    expect(estadoVisible('pendiente', venceAt, ahora)).toBe('pendiente');
    expect(estadoVisible('entregada', venceAt, ahora)).toBe('entregada');
  });

  it('la orden pendiente con el plazo corrido se ve vencida, aunque el barrido no la haya marcado', () => {
    expect(estadoVisible('pendiente', venceAt, new Date(venceAt.getTime()))).toBe('vencida');
  });

  it('una orden entregada sigue entregada durante la gracia para informar y después se ve vencida', () => {
    // La placa la tomó a tiempo y puede estar observando su sensor: su informe todavía vale.
    expect(estadoVisible('entregada', venceAt, new Date(venceAt.getTime() + 1))).toBe('entregada');
    const finDeLaGracia = new Date(venceAt.getTime() + GRACIA_DE_RESULTADO_MS);
    expect(estadoVisible('entregada', venceAt, new Date(finDeLaGracia.getTime() - 1))).toBe(
      'entregada',
    );
    expect(estadoVisible('entregada', venceAt, finDeLaGracia)).toBe('vencida');
  });

  it('un estado final no cambia con el tiempo', () => {
    const tarde = new Date(venceAt.getTime() + 60_000);
    for (const estado of ['ejecutada', 'fallida', 'vencida'] as const) {
      expect(estadoVisible(estado, venceAt, tarde)).toBe(estado);
    }
  });

  it('la vigencia de una orden es de 15 s (la tabla nunca admite más de 30)', () => {
    expect(VIGENCIA_DE_ORDEN_MS).toBe(15_000);
  });
});

describe('estadoDeOrdenTras', () => {
  it('ejecutada y sin_confirmacion (puerta sin sensor) dejan la orden ejecutada: el relé se accionó', () => {
    expect(estadoDeOrdenTras({ resultado: 'ejecutada', causa: 'puerta_abrio' })).toBe('ejecutada');
    expect(estadoDeOrdenTras({ resultado: 'sin_confirmacion', causa: 'sin_sensor' })).toBe(
      'ejecutada',
    );
  });

  it('una falla de la placa deja la orden fallida, con cualquier causa', () => {
    for (const causa of ['puerta_no_abrio', 'puerta_no_cerro', 'rele_no_accionado'] as const) {
      expect(estadoDeOrdenTras({ resultado: 'fallida', causa })).toBe('fallida');
    }
  });
});
