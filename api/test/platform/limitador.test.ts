import { describe, expect, it } from 'vitest';
import { LimitadorDeIntentos } from '../../src/platform/seguridad/limitador-de-intentos.js';

describe('LimitadorDeIntentos', () => {
  function crear() {
    let ahora = 1_000_000;
    const limitador = new LimitadorDeIntentos({
      maxFallos: 3,
      bloqueoBaseSegundos: 60,
      bloqueoMaximoSegundos: 200,
      reloj: () => ahora,
    });
    return { limitador, avanzar: (segundos: number) => (ahora += segundos * 1000) };
  }

  it('bloquea al llegar al máximo de fallos y avisa cuánto falta', () => {
    const { limitador } = crear();
    expect(limitador.registrarFallo('k')).toBe(false);
    expect(limitador.registrarFallo('k')).toBe(false);
    expect(limitador.segundosDeBloqueo('k')).toBe(0);
    expect(limitador.registrarFallo('k')).toBe(true);
    expect(limitador.segundosDeBloqueo('k')).toBe(60);
  });

  it('el bloqueo se levanta con el tiempo y cada uno dura el doble, hasta un tope', () => {
    const { limitador, avanzar } = crear();
    for (let i = 0; i < 3; i += 1) limitador.registrarFallo('k');
    avanzar(61);
    expect(limitador.segundosDeBloqueo('k')).toBe(0);
    for (let i = 0; i < 3; i += 1) limitador.registrarFallo('k');
    expect(limitador.segundosDeBloqueo('k')).toBe(120);
    avanzar(121);
    for (let i = 0; i < 3; i += 1) limitador.registrarFallo('k');
    expect(limitador.segundosDeBloqueo('k')).toBe(200);
  });

  it('un acierto borra el historial y las claves son independientes', () => {
    const { limitador } = crear();
    limitador.registrarFallo('k');
    limitador.registrarFallo('k');
    limitador.registrarExito('k');
    expect(limitador.registrarFallo('k')).toBe(false);
    for (let i = 0; i < 3; i += 1) limitador.registrarFallo('otra');
    expect(limitador.segundosDeBloqueo('otra')).toBeGreaterThan(0);
    expect(limitador.segundosDeBloqueo('k')).toBe(0);
  });
});
