import {
  MAX_MOTIVO_DE_ANULACION,
  confirmaCodigo,
  motivoDeAnulacion,
  puedeAnular,
} from '@/features/anulacion/domain/anulacion';

describe('anulación masiva: reglas de la confirmación', () => {
  it('el motivo va sin espacios sobrantes y no puede estar vacío', () => {
    expect(motivoDeAnulacion('  Uso sospechoso  ')).toBe('Uso sospechoso');
    expect(motivoDeAnulacion('   ')).toBeNull();
    expect(motivoDeAnulacion('')).toBeNull();
  });

  it('el motivo tiene el mismo largo máximo que la API', () => {
    expect(motivoDeAnulacion('x'.repeat(MAX_MOTIVO_DE_ANULACION))).not.toBeNull();
    expect(motivoDeAnulacion('x'.repeat(MAX_MOTIVO_DE_ANULACION + 1))).toBeNull();
  });

  it('el código de la cuenta se confirma sin importar mayúsculas ni espacios', () => {
    expect(confirmaCodigo(' agr ', 'AGR')).toBe(true);
    expect(confirmaCodigo('AG', 'AGR')).toBe(false);
    expect(confirmaCodigo('', 'AGR')).toBe(false);
  });

  it('un código de cuenta vacío nunca confirma nada', () => {
    expect(confirmaCodigo('', '')).toBe(false);
  });

  it('solo se puede anular con motivo válido y código bien escrito', () => {
    expect(puedeAnular('Robo de QR', 'AGR', 'AGR')).toBe(true);
    expect(puedeAnular('', 'AGR', 'AGR')).toBe(false);
    expect(puedeAnular('Robo de QR', 'AG', 'AGR')).toBe(false);
  });
});
