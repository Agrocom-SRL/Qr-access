import { describe, expect, it } from 'vitest';
import {
  contarPorEstado,
  filtrarCuentas,
  normalizarCodigoDeCuenta,
  sugerirCodigos,
} from '../../src/modules/seguridad/domain/cuentas.js';

describe('normalizarCodigoDeCuenta', () => {
  it('3 letras, en mayúsculas', () => {
    expect(normalizarCodigoDeCuenta(' agr ')).toBe('AGR');
  });

  it('rechaza lo que no son 3 letras A–Z', () => {
    for (const entrada of ['', 'AG', 'AGRO', 'A1R', 'ÁGR', 'AG R']) {
      expect(normalizarCodigoDeCuenta(entrada)).toBeNull();
    }
  });
});

describe('sugerirCodigos', () => {
  it('propone códigos libres parecidos a la razón social, sin los ocupados', () => {
    const sugerencias = sugerirCodigos('Agrícola Guarayos S.A.', new Set(['AGR']));
    expect(sugerencias).toHaveLength(3);
    expect(sugerencias).not.toContain('AGR');
    expect(sugerencias).toContain('GUA');
    for (const codigo of sugerencias) expect(codigo).toMatch(/^[A-Z]{3}$/);
  });

  it('es determinista y sin repetidos', () => {
    const a = sugerirCodigos('Frigorífico Oriente', new Set());
    expect(sugerirCodigos('Frigorífico Oriente', new Set())).toEqual(a);
    expect(new Set(a).size).toBe(a.length);
  });

  it('sin palabras útiles no sugiere nada', () => {
    expect(sugerirCodigos('', new Set())).toEqual([]);
  });
});

describe('filtrarCuentas y contarPorEstado', () => {
  const cuentas = [
    { nombre: 'Agroindustrial Norte', codigo: 'AGR', estado: 'por_vencer' as const },
    { nombre: 'Frigorífico Oriente', codigo: 'FRO', estado: 'activa' as const },
    { nombre: 'Lácteos Montero', codigo: 'LAM', estado: 'vencida' as const },
  ];

  it('busca por nombre sin tildes ni mayúsculas', () => {
    expect(filtrarCuentas(cuentas, { busqueda: 'frigorifico', estado: 'todas' })).toHaveLength(1);
    expect(filtrarCuentas(cuentas, { busqueda: 'lacteos', estado: 'todas' })[0]?.codigo).toBe(
      'LAM',
    );
  });

  it('busca por código', () => {
    expect(filtrarCuentas(cuentas, { busqueda: 'agr', estado: 'todas' })).toHaveLength(1);
  });

  it('filtra por estado y combina con la búsqueda', () => {
    expect(filtrarCuentas(cuentas, { busqueda: '', estado: 'vencida' })).toHaveLength(1);
    expect(filtrarCuentas(cuentas, { busqueda: 'norte', estado: 'activa' })).toHaveLength(0);
  });

  it('cuenta por estado', () => {
    expect(contarPorEstado(cuentas)).toEqual({
      todas: 3,
      activa: 1,
      por_vencer: 1,
      vencida: 1,
      suspendida: 0,
    });
  });
});
