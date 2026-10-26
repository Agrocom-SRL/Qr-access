import { describe, expect, it } from 'vitest';
import {
  esAlivio,
  estadoEfectivo,
  nodosDeEstado,
  peorEstado,
  puedeCambiarEstado,
  type Estado,
} from '../../src/modules/seguridad/domain/estado.js';
import { clasificarCambio } from '../../src/modules/bitacora/domain/clasificar.js';

/** Un árbol de prueba: 1 (admin) -> 2 (titular) -> 3 (miembro); 1 -> 4 (otro titular). */
function arbol(estados: Partial<Record<string, Estado>> = {}) {
  const superior: Record<string, string | null> = { '1': null, '2': '1', '3': '2', '4': '1' };
  return nodosDeEstado(
    Object.entries(superior).map(([id, superior_id]) => ({
      id,
      superior_id,
      estado: estados[id] ?? 'activo',
    })),
  );
}

describe('estado efectivo (D-25, ADR 0031 §2)', () => {
  it('suspendido > restringido > activo', () => {
    expect(peorEstado('activo', 'restringido')).toBe('restringido');
    expect(peorEstado('restringido', 'suspendido')).toBe('suspendido');
    expect(peorEstado('suspendido', 'activo')).toBe('suspendido');
    expect(esAlivio('suspendido', 'restringido')).toBe(true);
    expect(esAlivio('activo', 'restringido')).toBe(false);
  });

  it('sin nada en contra, activo', () => {
    expect(estadoEfectivo('3', arbol(), 'activo')).toEqual({ estado: 'activo', origen: null });
  });

  it('la restricción de un superior arrastra a toda su rama, igual que la suspensión', () => {
    const nodos = arbol({ '2': 'restringido' });
    expect(estadoEfectivo('2', nodos, 'activo')).toEqual({
      estado: 'restringido',
      origen: 'usuario',
    });
    expect(estadoEfectivo('3', nodos, 'activo')).toEqual({
      estado: 'restringido',
      origen: 'superior',
    });
    // Un par y el superior no se ven afectados.
    expect(estadoEfectivo('4', nodos, 'activo').estado).toBe('activo');
    expect(estadoEfectivo('1', nodos, 'activo').estado).toBe('activo');
    expect(estadoEfectivo('3', arbol({ '1': 'suspendido' }), 'activo')).toEqual({
      estado: 'suspendido',
      origen: 'superior',
    });
  });

  it('gana el peor entre el propio, los superiores y la cuenta', () => {
    expect(
      estadoEfectivo('3', arbol({ '3': 'restringido', '1': 'suspendido' }), 'activo').estado,
    ).toBe('suspendido');
    // Un estado propio más leve no levanta el del superior.
    expect(estadoEfectivo('3', arbol({ '3': 'activo', '2': 'suspendido' }), 'activo').estado).toBe(
      'suspendido',
    );
    expect(estadoEfectivo('3', arbol({ '2': 'restringido' }), 'suspendido')).toEqual({
      estado: 'suspendido',
      origen: 'cuenta',
    });
    expect(estadoEfectivo('3', arbol(), 'restringido')).toEqual({
      estado: 'restringido',
      origen: 'cuenta',
    });
  });

  it('si el usuario o un superior ya no existen, falla cerrado: eliminado', () => {
    const sinTitular = new Map([...arbol()].filter(([id]) => id !== '2'));
    expect(estadoEfectivo('3', sinTitular, 'activo').estado).toBe('eliminado');
    expect(estadoEfectivo('9', arbol(), 'activo').estado).toBe('eliminado');
  });

  it('un ciclo en superior_id no entra en un bucle: eliminado', () => {
    const ciclo = nodosDeEstado([
      { id: '1', superior_id: '2', estado: 'activo' },
      { id: '2', superior_id: '1', estado: 'activo' },
    ]);
    expect(estadoEfectivo('1', ciclo, 'activo').estado).toBe('eliminado');
  });
});

describe('quién puede cambiar un estado (ADR 0033 §1)', () => {
  const rama = new Set(['2', '3']);

  it('quien no tiene estado propio puede recibir uno de cualquiera con permiso en su rama', () => {
    expect(puedeCambiarEstado({ estado: 'activo', impuestoPor: null }, '1', rama)).toBe(true);
  });

  it('lo levanta quien lo impuso o un superior suyo', () => {
    expect(puedeCambiarEstado({ estado: 'restringido', impuestoPor: '1' }, '1', rama)).toBe(true);
    // Impuesto por alguien de la rama del actor (el actor es superior de quien lo impuso).
    expect(puedeCambiarEstado({ estado: 'restringido', impuestoPor: '2' }, '1', rama)).toBe(true);
  });

  it('no lo levanta quien está debajo, un par ni AGROCOM, ni se sabe quién lo impuso', () => {
    // El actor es 2; lo impuso 1 (superior de 2).
    expect(
      puedeCambiarEstado({ estado: 'suspendido', impuestoPor: '1' }, '2', new Set(['3'])),
    ).toBe(false);
    // Lo impuso un par (4) o AGROCOM (99): no está en la rama del actor.
    expect(
      puedeCambiarEstado({ estado: 'suspendido', impuestoPor: '4' }, '2', new Set(['3'])),
    ).toBe(false);
    expect(puedeCambiarEstado({ estado: 'suspendido', impuestoPor: '99' }, '1', rama)).toBe(false);
    expect(puedeCambiarEstado({ estado: 'suspendido', impuestoPor: null }, '1', rama)).toBe(false);
  });
});

describe('la bitácora nombra los cambios de estado', () => {
  const cambio = (tabla: string, tenantId: string | null, estado: string) =>
    clasificarCambio({
      tabla,
      accion: 'actualizado',
      registroId: '1',
      tenantId,
      antes: { estado: 'activo' },
      despues: { estado, estado_motivo: 'x' },
    });

  it('usuarios, cuentas y equipo', () => {
    expect(cambio('usuarios', '5', 'restringido')).toBe('usuario.restringido');
    expect(cambio('usuarios', '5', 'suspendido')).toBe('usuario.suspendido');
    expect(cambio('usuarios', '5', 'activo')).toBe('usuario.reactivado');
    expect(cambio('cuentas', null, 'restringido')).toBe('cuenta.restringida');
    expect(cambio('cuentas', null, 'suspendido')).toBe('cuenta.suspendida');
    expect(cambio('cuentas', null, 'activo')).toBe('cuenta.reactivada');
    expect(cambio('usuarios', null, 'suspendido')).toBe('equipo.desactivado');
    expect(cambio('usuarios', null, 'activo')).toBe('equipo.reactivado');
  });
});
