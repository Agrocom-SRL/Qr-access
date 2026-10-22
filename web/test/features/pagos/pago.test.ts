import { anchosDeColumnas, construirLibro, TAMANO_DE_FUENTE } from '@/shared/lib/excel';
import {
  cobranzaAExcel,
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
    comprobante: new File(['x'], 'comprobante.png', { type: 'image/png' }),
  };

  it('acepta un pago completo', () => {
    expect(validarPago(valido)).toEqual({});
  });

  it('marca lo que falta o está mal', () => {
    expect(validarPago({ ...valido, monto: '', fechaPago: '', referencia: ' ' })).toEqual({
      monto: 'requerido',
      fechaPago: 'requerido',
    });
    expect(validarPago({ ...valido, monto: '1,5', fechaPago: '12/10/2026' })).toEqual({
      monto: 'formato',
      fechaPago: 'formato',
    });
  });

  it('una transferencia o un pago por QR piden comprobante; el efectivo no', () => {
    const sinRespaldo = { ...valido, comprobante: null };
    expect(validarPago(sinRespaldo)).toEqual({ comprobante: 'requerido' });
    expect(validarPago({ ...sinRespaldo, medio: 'qr' })).toHaveProperty('comprobante');
    expect(validarPago({ ...sinRespaldo, medio: 'efectivo' })).toEqual({});
  });

  it('el comprobante tiene que ser imagen o PDF y pesar hasta 5 MB', () => {
    const archivo = (tipo: string, bytes = 1) =>
      new File([new Uint8Array(bytes)], 'a', { type: tipo });
    expect(validarPago({ ...valido, comprobante: archivo('application/pdf') })).toEqual({});
    expect(validarPago({ ...valido, comprobante: archivo('text/html') }).comprobante).toBe(
      'archivoInvalido',
    );
    expect(
      validarPago({ ...valido, comprobante: archivo('image/png', 5 * 1024 * 1024 + 1) })
        .comprobante,
    ).toBe('archivoGrande');
  });
});

describe('Excel de la cobranza', () => {
  const fila: FilaDeCobranza = {
    cuenta: { id: '1', codigo: 'SDE', nombre: 'Semillas, del Este' },
    plan: { id: '1', nombre: '100 usuarios', cupoUsuarios: 100 },
    monto: 12000,
    venceEl: new Date('2026-10-18T04:00:00Z'),
    diasRestantes: 6,
    pago: 'pendiente',
    estado: 'porVencer',
  };
  const definicion = cobranzaAExcel(
    [fila],
    ['Cuenta', 'Código', 'Plan', 'Monto', 'Vence', 'Pago'],
    'Cobranza',
    () => 'Pendiente',
  );

  it('arma una columna por dato con el monto y la fecha como valores de verdad', () => {
    expect(definicion.columnas.map((c) => c.encabezado)).toEqual([
      'Cuenta',
      'Código',
      'Plan',
      'Monto',
      'Vence',
      'Pago',
    ]);
    expect(definicion.filas[0]).toEqual([
      'Semillas, del Este',
      'SDE',
      '100 usuarios',
      12000,
      fila.venceEl,
      'Pendiente',
    ]);
  });

  it('el libro lleva cabeceras verdes, letra de 13, anchos distintos y filtros', async () => {
    const libro = await construirLibro(definicion);
    const hoja = libro.getWorksheet('Cobranza');
    const cabecera = hoja?.getRow(1).getCell(1);
    expect(cabecera?.fill).toMatchObject({ fgColor: { argb: 'FF007A33' } });
    expect(cabecera?.font).toMatchObject({ bold: true, size: TAMANO_DE_FUENTE });
    expect(TAMANO_DE_FUENTE).toBeGreaterThan(11);
    expect(hoja?.getRow(2).getCell(1).font.size).toBe(TAMANO_DE_FUENTE);
    const anchos = anchosDeColumnas(definicion);
    expect(anchos[0]).toBeGreaterThan(anchos[1] ?? 0);
    expect(new Set(anchos).size).toBeGreaterThan(1);
    expect(hoja?.autoFilter).toBeTruthy();
  });
});
