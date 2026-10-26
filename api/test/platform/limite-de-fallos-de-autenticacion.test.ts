import { describe, expect, it } from 'vitest';
import { LimiteDeFallosDeAutenticacion } from '../../src/platform/seguridad/limite-de-fallos-de-autenticacion.js';

describe('LimiteDeFallosDeAutenticacion', () => {
  function crear(opciones: { maxIps?: number } = {}) {
    let ahora = 1_000_000;
    const limite = new LimiteDeFallosDeAutenticacion({
      maxFallos: 3,
      ...opciones,
      reloj: () => ahora,
    });
    return { limite, avanzar: (segundos: number) => (ahora += segundos * 1000) };
  }

  it('bloquea a la IP al llegar al tope de fallos y lo levanta al terminar la ventana', () => {
    const { limite, avanzar } = crear();
    limite.registrarFallo('1.1.1.1');
    limite.registrarFallo('1.1.1.1');
    expect(limite.segundosDeBloqueo('1.1.1.1')).toBe(0);
    limite.registrarFallo('1.1.1.1');
    expect(limite.segundosDeBloqueo('1.1.1.1')).toBe(60);
    expect(limite.segundosDeBloqueo('2.2.2.2')).toBe(0);
    avanzar(30);
    expect(limite.segundosDeBloqueo('1.1.1.1')).toBe(30);
    avanzar(31);
    expect(limite.segundosDeBloqueo('1.1.1.1')).toBe(0);
    // La ventana nueva empieza de cero.
    limite.registrarFallo('1.1.1.1');
    expect(limite.segundosDeBloqueo('1.1.1.1')).toBe(0);
  });

  it('un dispositivo que autenticó bien desde la IP es conocido por 15 minutos, solo desde esa IP', () => {
    const { limite, avanzar } = crear();
    limite.registrarAcierto('1.1.1.1', '7');
    expect(limite.esDispositivoConocido('1.1.1.1', '7')).toBe(true);
    expect(limite.esDispositivoConocido('2.2.2.2', '7')).toBe(false);
    expect(limite.esDispositivoConocido('1.1.1.1', '8')).toBe(false);
    avanzar(15 * 60 + 1);
    expect(limite.esDispositivoConocido('1.1.1.1', '7')).toBe(false);
  });

  it('recuerda un número acotado de IP: llena, olvida la menos reciente', () => {
    const { limite } = crear({ maxIps: 2 });
    for (const ip of ['a', 'b', 'c']) {
      for (let i = 0; i < 3; i += 1) limite.registrarFallo(ip);
    }
    expect(limite.segundosDeBloqueo('a')).toBe(0);
    expect(limite.segundosDeBloqueo('b')).toBe(60);
    expect(limite.segundosDeBloqueo('c')).toBe(60);
  });
});
