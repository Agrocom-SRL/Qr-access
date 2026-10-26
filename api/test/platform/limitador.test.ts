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

  it('tiene un tope duro de claves: llena, olvida la menos reciente en vez de crecer', () => {
    const limitador = new LimitadorDeIntentos({
      maxFallos: 2,
      bloqueoBaseSegundos: 60,
      bloqueoMaximoSegundos: 60,
      maxRegistros: 3,
      reloj: () => 1_000_000,
    });
    for (const clave of ['a', 'b', 'c', 'd', 'e']) {
      limitador.registrarFallo(clave);
      limitador.registrarFallo(clave);
    }
    // Quedan las 3 más recientes, con su bloqueo; las 2 primeras se olvidaron.
    expect(limitador.segundosDeBloqueo('a')).toBe(0);
    expect(limitador.segundosDeBloqueo('b')).toBe(0);
    for (const clave of ['c', 'd', 'e']) expect(limitador.segundosDeBloqueo(clave)).toBe(60);
  });
});
