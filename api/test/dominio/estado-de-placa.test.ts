import { describe, expect, it } from 'vitest';
import {
  claveDeGrupo,
  descomponerClave,
  estaEnObservacion,
  evaluarConexion,
  evaluarLector,
  gruposQueCambiaron,
  miembrosPorGrupo,
  type EstadoDeConexion,
  type UmbralesDePlaca,
} from '../../src/modules/dispositivos/domain/estado-de-placa.js';
import { esperaTrasFallo, decidir } from '../../src/modules/notificaciones/domain/aviso.js';

const U: UmbralesDePlaca = {
  caidaSegundos: 15 * 60,
  desaparecidaSegundos: 120 * 60,
  recuperacionSegundos: 3 * 60,
  lectorSinRespuestaSegundos: 5 * 60,
  observacionSegundos: 24 * 3600,
};
const T0 = new Date('2026-10-27T12:00:00.000Z');
const hace = (segundos: number) => new Date(T0.getTime() - segundos * 1000);

describe('estado de conexión de la placa (ADR 0031 §18)', () => {
  const evaluar = (silencio: number | null, previo: EstadoDeConexion | null, racha = 0) =>
    evaluarConexion(
      {
        ultimoLatidoAt: silencio === null ? null : hace(silencio),
        enLineaDesde: hace(racha),
        previo,
      },
      T0,
      U,
    );

  it('sin latidos nunca hay estado (no avisa)', () => {
    expect(evaluar(null, null)).toBeNull();
  });
  it('un latido reciente es en línea', () => {
    expect(evaluar(60, null)).toBe('en_linea');
  });
  it('entre 3 y 15 min es sin conexión, sin llegar a caída sostenida', () => {
    expect(evaluar(200, 'en_linea')).toBe('sin_conexion');
    expect(evaluar(15 * 60 - 1, 'sin_conexion')).toBe('sin_conexion');
  });
  it('a los 15 min es caída sostenida y a las 2 h desaparecida', () => {
    expect(evaluar(15 * 60, 'sin_conexion')).toBe('caida_sostenida');
    expect(evaluar(120 * 60 - 1, 'caida_sostenida')).toBe('caida_sostenida');
    expect(evaluar(120 * 60, 'caida_sostenida')).toBe('desaparecida');
  });
  it('histéresis: en alerta no baja de escalón ni se recupera con un latido suelto', () => {
    // Un latido hace 10 s pero la racha apenas empezó: sigue en alerta.
    expect(evaluar(10, 'caida_sostenida', 10)).toBe('caida_sostenida');
    expect(evaluar(10, 'desaparecida', 60)).toBe('desaparecida');
    // Con la racha sostenida, se recupera.
    expect(evaluar(10, 'caida_sostenida', 3 * 60)).toBe('en_linea');
    expect(evaluar(10, 'desaparecida', 10 * 60)).toBe('en_linea');
    // Sin latido reciente pero en alerta previa, no vuelve a sin_conexion.
    expect(evaluar(16 * 60, 'desaparecida')).toBe('desaparecida');
  });
});

describe('estado del lector y observación', () => {
  const lector = (
    responde: boolean | null,
    desde: number,
    previo: 'responde' | 'sin_respuesta' | null,
  ) => evaluarLector({ lectorResponde: responde, lectorCambioAt: hace(desde), previo }, T0, U);

  it('si el firmware no lo informa no hay estado', () => {
    expect(lector(null, 0, null)).toBeNull();
  });
  it('sin respuesta solo tras el umbral, y se recupera con histéresis', () => {
    expect(lector(false, 60, 'responde')).toBe('responde');
    expect(lector(false, 5 * 60, 'responde')).toBe('sin_respuesta');
    expect(lector(true, 30, 'sin_respuesta')).toBe('sin_respuesta');
    expect(lector(true, 3 * 60, 'sin_respuesta')).toBe('responde');
    expect(lector(true, 30, 'responde')).toBe('responde');
  });
  it('en observación: en línea y sin lecturas por 24 h, medido desde el vínculo si nunca leyó', () => {
    const datos = (
      conexion: EstadoDeConexion | null,
      lectura: number | null,
      vinculada: number,
    ) => ({
      conexion,
      ultimaLecturaAt: lectura === null ? null : hace(lectura),
      vinculadaAt: hace(vinculada),
    });
    expect(estaEnObservacion(datos('en_linea', null, 25 * 3600), T0, U)).toBe(true);
    expect(estaEnObservacion(datos('en_linea', null, 3600), T0, U)).toBe(false);
    expect(estaEnObservacion(datos('en_linea', 3600, 90 * 3600), T0, U)).toBe(false);
    expect(estaEnObservacion(datos('caida_sostenida', null, 90 * 3600), T0, U)).toBe(false);
  });
});

describe('agrupación por sitio', () => {
  it('una placa desaparecida cuenta también como caída; el lector mudo es otro grupo', () => {
    const grupos = miembrosPorGrupo([
      { id: '2', sitioId: '10', conexion: 'caida_sostenida', lector: null },
      { id: '1', sitioId: '10', conexion: 'desaparecida', lector: 'sin_respuesta' },
      { id: '3', sitioId: '11', conexion: 'en_linea', lector: 'responde' },
      { id: '4', sitioId: '11', conexion: 'caida_sostenida', lector: null },
    ]);
    expect(grupos.get(claveDeGrupo('placa.caida_sostenida', '10'))).toEqual(['1', '2']);
    expect(grupos.get(claveDeGrupo('placa.desaparecida', '10'))).toEqual(['1']);
    expect(grupos.get(claveDeGrupo('placa.lector_sin_respuesta', '10'))).toEqual(['1']);
    expect(grupos.get(claveDeGrupo('placa.caida_sostenida', '11'))).toEqual(['4']);
    expect(grupos.has(claveDeGrupo('placa.desaparecida', '11'))).toBe(false);
  });
  it('detecta solo los grupos que cambiaron', () => {
    const antes = new Map([
      ['a:sitio:1', ['1']],
      ['b:sitio:1', ['1']],
    ]);
    const ahora = new Map([
      ['a:sitio:1', ['1', '2']],
      ['b:sitio:1', ['1']],
      ['c:sitio:2', ['5']],
    ]);
    expect(gruposQueCambiaron(antes, ahora)).toEqual(['a:sitio:1', 'c:sitio:2']);
    expect(gruposQueCambiaron(ahora, ahora)).toEqual([]);
    expect(gruposQueCambiaron(antes, new Map())).toEqual(['a:sitio:1', 'b:sitio:1']);
  });
  it('la clave se descompone', () => {
    expect(descomponerClave(claveDeGrupo('placa.desaparecida', '7'))).toEqual({
      grupo: 'placa.desaparecida',
      sitioId: '7',
    });
    expect(descomponerClave('otra:cosa')).toBeNull();
  });
});

describe('decisión de un aviso agrupado y reintentos', () => {
  it('abre, actualiza (con o sin novedad), cierra o no hace nada', () => {
    expect(decidir(null, { miembros: ['1'] })).toEqual({ accion: 'abrir' });
    expect(decidir(null, { miembros: [] })).toEqual({ accion: 'nada' });
    expect(decidir({ id: '1', miembros: ['1'] }, { miembros: [] })).toEqual({ accion: 'cerrar' });
    expect(decidir({ id: '1', miembros: ['1'] }, { miembros: ['1'] })).toEqual({
      accion: 'actualizar',
      miembros: ['1'],
      hayNovedad: false,
    });
    expect(decidir({ id: '1', miembros: ['1'] }, { miembros: ['2'] })).toEqual({
      accion: 'actualizar',
      miembros: ['1', '2'],
      hayNovedad: true,
    });
  });
  it('la espera crece y se topa en 1 h', () => {
    expect(esperaTrasFallo(1)).toBe(30);
    expect(esperaTrasFallo(2)).toBe(60);
    expect(esperaTrasFallo(3)).toBe(120);
    expect(esperaTrasFallo(20)).toBe(3600);
  });
});
