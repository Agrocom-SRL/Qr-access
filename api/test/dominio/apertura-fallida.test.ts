import { describe, expect, it } from 'vitest';
import {
  filaEfectiva,
  resultadoDelInforme,
  SIN_RESPUESTA,
} from '../../src/modules/accesos/domain/confirmacion.js';
import {
  dispositivosQueFallan,
  esFalla,
  type EjecucionParaJuzgar,
} from '../../src/modules/dispositivos/domain/apertura-fallida.js';

const AHORA = new Date('2026-11-01T12:00:00.000Z');
const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * 60_000);
const umbrales = { fallidasMinimo: 2, ventanaSegundos: 3600 };

const ejecucion = (
  eventoId: string,
  resultado: EjecucionParaJuzgar['resultado'],
  causa: string,
  minutos: number,
  dispositivoId = '1',
): EjecucionParaJuzgar => ({
  eventoId,
  dispositivoId,
  resultado,
  causa,
  registradaAt: hace(minutos),
});

describe('confirmación de apertura: del informe de la placa a lo que se guarda', () => {
  it('traduce el vocabulario de la placa al del servidor (ADR 0031 §18)', () => {
    expect(resultadoDelInforme({ resultado: 'ejecutada' })).toEqual({
      resultado: 'ejecutada',
      causa: 'puerta_abrio',
    });
    expect(resultadoDelInforme({ resultado: 'fallida', causa: 'puerta_no_cerro' })).toEqual({
      resultado: 'fallida',
      causa: 'puerta_no_cerro',
    });
    expect(resultadoDelInforme({ resultado: 'sin_sensor' })).toEqual({
      resultado: 'sin_confirmacion',
      causa: 'sin_sensor',
    });
    expect(SIN_RESPUESTA).toEqual({ resultado: 'sin_confirmacion', causa: 'sin_respuesta' });
  });

  it('la fila de la placa manda sobre la del servidor, llegue cuando llegue', () => {
    const servidor = {
      origen: 'servidor',
      resultado: 'sin_confirmacion',
      causa: 'sin_respuesta',
    } as const;
    const placa = { origen: 'placa', resultado: 'ejecutada', causa: 'puerta_abrio' } as const;
    expect(filaEfectiva([servidor, placa])).toBe(placa);
    expect(filaEfectiva([placa, servidor])).toBe(placa);
    expect(filaEfectiva([servidor])).toBe(servidor);
    expect(filaEfectiva([])).toBeNull();
  });
});

describe('puertas que fallan al abrir', () => {
  it('falla lo que la placa dice fallida y la falta de respuesta; sin_sensor no es ni lo uno ni lo otro', () => {
    expect(esFalla({ resultado: 'fallida', causa: 'puerta_no_abrio' })).toBe(true);
    expect(esFalla({ resultado: 'sin_confirmacion', causa: 'sin_respuesta' })).toBe(true);
    expect(esFalla({ resultado: 'sin_confirmacion', causa: 'sin_sensor' })).toBe(false);
    expect(esFalla({ resultado: 'ejecutada', causa: 'puerta_abrio' })).toBe(false);
  });

  it('una falla aislada no alcanza; dos dentro de la ventana sí', () => {
    expect(
      dispositivosQueFallan([ejecucion('1', 'fallida', 'puerta_no_abrio', 5)], AHORA, umbrales)
        .size,
    ).toBe(0);
    const resultado = dispositivosQueFallan(
      [
        ejecucion('1', 'fallida', 'puerta_no_abrio', 10),
        ejecucion('2', 'sin_confirmacion', 'sin_respuesta', 5),
      ],
      AHORA,
      umbrales,
    );
    expect(resultado.get('1')).toMatchObject({
      fallos: 2,
      ultimaCausa: 'sin_respuesta',
      desde: hace(10),
    });
  });

  it('cuentan desde la última apertura ejecutada: si volvió a abrir, se supera', () => {
    const ejecuciones = [
      ejecucion('1', 'fallida', 'puerta_no_abrio', 20),
      ejecucion('2', 'fallida', 'puerta_no_abrio', 15),
      ejecucion('3', 'ejecutada', 'puerta_abrio', 10),
      ejecucion('4', 'fallida', 'puerta_no_abrio', 5),
    ];
    expect(dispositivosQueFallan(ejecuciones, AHORA, umbrales).size).toBe(0);
    expect(
      dispositivosQueFallan(
        [...ejecuciones, ejecucion('5', 'fallida', 'puerta_no_abrio', 2)],
        AHORA,
        umbrales,
      ).get('1')?.fallos,
    ).toBe(2);
  });

  it('lo que queda fuera de la ventana (o en el futuro) no cuenta', () => {
    const resultado = dispositivosQueFallan(
      [
        ejecucion('1', 'fallida', 'puerta_no_abrio', 61),
        ejecucion('2', 'fallida', 'puerta_no_abrio', 60),
        ejecucion('3', 'fallida', 'puerta_no_abrio', 30),
        ejecucion('4', 'fallida', 'puerta_no_abrio', -5),
      ],
      AHORA,
      umbrales,
    );
    expect(resultado.size).toBe(0);
  });

  it('cada dispositivo se juzga por separado', () => {
    const resultado = dispositivosQueFallan(
      [
        ejecucion('1', 'fallida', 'puerta_no_abrio', 10, '1'),
        ejecucion('2', 'fallida', 'puerta_no_abrio', 9, '2'),
        ejecucion('3', 'fallida', 'puerta_no_abrio', 8, '1'),
      ],
      AHORA,
      umbrales,
    );
    expect([...resultado.keys()]).toEqual(['1']);
  });
});
