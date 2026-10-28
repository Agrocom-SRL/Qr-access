import { describe, expect, it } from 'vitest';
import {
  debeRegistrarActividad,
  nombreDeDispositivoLimpio,
  sesionesQueSobran,
  type SesionViva,
} from '../../src/modules/seguridad/domain/sesion.js';

const t = (minutos: number): Date => new Date(Date.UTC(2026, 9, 26, 12, minutos));
const viva = (id: string, instalacion: string | null, minutos: number): SesionViva => ({
  id,
  instalacion_id: instalacion,
  ultima_actividad_at: t(minutos),
  created_at: t(minutos),
});
const TOPES = { maxPorUsuario: 3, maxPorInstalacion: 2 };

describe('sesionesQueSobran (ADR 0030 §4.1)', () => {
  it('sin pasarse de los topes no cierra nada', () => {
    const usuario = [viva('1', 'a', 1), viva('2', 'b', 2)];
    expect(sesionesQueSobran(usuario, [], { instalacionId: 'c' }, TOPES)).toEqual([]);
  });

  it('volver a entrar desde la misma instalación reemplaza la anterior', () => {
    const primera = viva('1', 'a', 1);
    const usuario = [primera, viva('2', 'b', 2)];
    expect(sesionesQueSobran(usuario, [primera], { instalacionId: 'a' }, TOPES)).toEqual([
      { id: '1', motivo: 'misma_instalacion' },
    ]);
  });

  it('pasado el tope por usuario cierra la más antigua, no la más reciente', () => {
    const usuario = [viva('3', 'c', 30), viva('1', 'a', 10), viva('2', 'b', 20)];
    expect(sesionesQueSobran(usuario, [], { instalacionId: 'd' }, TOPES)).toEqual([
      { id: '1', motivo: 'limite_usuario' },
    ]);
  });

  it('pasado el tope por instalación cierra la más antigua de esa instalación (otros usuarios)', () => {
    const enLaInstalacion = [viva('7', 'x', 5), viva('8', 'x', 6)];
    expect(sesionesQueSobran([], enLaInstalacion, { instalacionId: 'x' }, TOPES)).toEqual([
      { id: '7', motivo: 'limite_instalacion' },
    ]);
  });

  it('una sesión ya cerrada por un motivo no se cuenta ni se cierra otra vez', () => {
    const primera = viva('1', 'a', 1);
    const usuario = [primera, viva('2', 'b', 2), viva('3', 'c', 3)];
    const cierres = sesionesQueSobran(usuario, [primera], { instalacionId: 'a' }, TOPES);
    // La '1' sale por misma instalación y con eso ya hay sitio: no se cierra otra.
    expect(cierres).toEqual([{ id: '1', motivo: 'misma_instalacion' }]);
  });

  it('sin instalación (cliente anterior) solo cuenta el tope por usuario', () => {
    const usuario = [viva('1', null, 1), viva('2', null, 2), viva('3', null, 3)];
    expect(sesionesQueSobran(usuario, [], { instalacionId: null }, TOPES)).toEqual([
      { id: '1', motivo: 'limite_usuario' },
    ]);
  });

  it('a igual momento cierra la de id menor', () => {
    const usuario = [viva('12', 'b', 1), viva('9', 'a', 1), viva('20', 'c', 1)];
    expect(sesionesQueSobran(usuario, [], { instalacionId: 'd' }, TOPES)[0]?.id).toBe('9');
  });
});

describe('nombreDeDispositivoLimpio', () => {
  it('quita caracteres de control, junta espacios y acota a 60', () => {
    expect(nombreDeDispositivoLimpio('  Pixel\n 8\u0000  Pro ')).toBe('Pixel 8 Pro');
    expect(nombreDeDispositivoLimpio('x'.repeat(100))).toHaveLength(60);
  });
  it('devuelve null si no queda nada', () => {
    expect(nombreDeDispositivoLimpio('  \n ')).toBeNull();
    expect(nombreDeDispositivoLimpio(undefined)).toBeNull();
  });
});

describe('debeRegistrarActividad', () => {
  it('registra la primera vez y luego como mucho cada 5 minutos', () => {
    expect(debeRegistrarActividad(null, t(0))).toBe(true);
    expect(debeRegistrarActividad(t(0), t(4))).toBe(false);
    expect(debeRegistrarActividad(t(0), t(5))).toBe(true);
  });
});
