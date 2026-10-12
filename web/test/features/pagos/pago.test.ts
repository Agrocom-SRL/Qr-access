import { celdaCsv } from '@/shared/lib/csv';
import {
  cobranzaACsv,
  parsearMonto,
  validarPago,
  type FilaDeCobranza,
} from '@/features/pagos/domain/pago';

describe('parsearMonto', () => {
  it('acepta enteros con o sin puntos de miles', () => {
    expect(parsearMonto('12.000')).toBe(12000);
    expect(parsearMonto('12000')).toBe(12000);
  });

  it('rechaza cero, vacío, decimales y texto', () => {
    for (const texto of ['0', '', '12,5', 'abc', '-1']) expect(parsearMonto(texto)).toBeNull();
  });
});

describe('validarPago', () => {
  const valido = {
    monto: '12.000',
    fechaPago: '2026-10-12',
    medio: 'transferencia' as const,
    referencia: 'TRF-1',
  };

  it('acepta un pago completo', () => {
    expect(validarPago(valido)).toEqual({});
  });

  it('marca lo que falta o está mal', () => {
    expect(validarPago({ ...valido, monto: '', fechaPago: '', referencia: ' ' })).toEqual({
      monto: 'requerido',
      fechaPago: 'requerido',
      referencia: 'requerido',
    });
    expect(validarPago({ ...valido, monto: '1,5', fechaPago: '12/10/2026' })).toEqual({
      monto: 'formato',
      fechaPago: 'formato',
    });
  });
});

describe('CSV', () => {
  it('encomilla comas, comillas y saltos de línea', () => {
    expect(celdaCsv('Semillas, del "Este"')).toBe('"Semillas, del ""Este"""');
    expect(celdaCsv('simple')).toBe('simple');
    expect(celdaCsv(12000)).toBe('12000');
  });

  it('arma encabezados y una fila por cuenta', () => {
    const fila: FilaDeCobranza = {
      cuenta: { id: '1', codigo: 'SDE', nombre: 'Semillas, del Este' },
      plan: { id: '1', nombre: '100 usuarios', cupoUsuarios: 100 },
      monto: 12000,
      venceEl: new Date('2026-10-18T04:00:00Z'),
      diasRestantes: 6,
      pago: 'pendiente',
      estado: 'porVencer',
    };
    expect(
      cobranzaACsv(
        [fila],
        ['Cuenta', 'Código', 'Plan', 'Monto', 'Vence', 'Pago'],
        () => 'Pendiente',
      ),
    ).toBe(
      'Cuenta,Código,Plan,Monto,Vence,Pago\r\n"Semillas, del Este",SDE,100 usuarios,12000,2026-10-18,Pendiente',
    );
  });
});
