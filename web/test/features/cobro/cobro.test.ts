import { crearCobroHttp } from '@/features/cobro/api/cobroHttp';
import {
  FORMULARIO_VACIO,
  validarCuentaDeCobro,
  type FormularioDeCuentaDeCobro,
} from '@/features/cobro/domain/cuentaDeCobro';
import type { ClienteHttp } from '@/shared/api/clienteHttp';

function clienteFalso(respuesta?: unknown) {
  const solicitar = vi.fn(() => Promise.resolve(respuesta));
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

const BANCARIA: FormularioDeCuentaDeCobro = {
  ...FORMULARIO_VACIO,
  banco: ' Banco Unión ',
  titular: ' AGROCOM S.R.L. ',
  numeroCuenta: ' 10000123456 ',
  tipoCuenta: 'corriente',
};

describe('validarCuentaDeCobro', () => {
  it('una cuenta bancaria pide banco, titular y número; el tipo es opcional', () => {
    expect(validarCuentaDeCobro(BANCARIA)).toEqual({});
    expect(validarCuentaDeCobro({ ...FORMULARIO_VACIO })).toEqual({
      banco: 'requerido',
      titular: 'requerido',
      numeroCuenta: 'requerido',
    });
    expect(validarCuentaDeCobro({ ...BANCARIA, tipoCuenta: '' })).toEqual({});
  });

  it('un QR pide su imagen: la nueva o la que ya tiene', () => {
    const qr = { ...FORMULARIO_VACIO, metodo: 'qr' as const, banco: 'Banco Unión' };
    expect(validarCuentaDeCobro(qr)).toEqual({ imagen: 'requerido' });
    expect(validarCuentaDeCobro({ ...qr, imagenActualId: '50' })).toEqual({});
    const png = new File(['x'], 'qr.png', { type: 'image/png' });
    expect(validarCuentaDeCobro({ ...qr, imagen: png })).toEqual({});
  });

  it('el QR tiene que ser una imagen de hasta 5 MB', () => {
    const qr = { ...FORMULARIO_VACIO, metodo: 'qr' as const, banco: 'Banco Unión' };
    const pdf = new File(['x'], 'qr.pdf', { type: 'application/pdf' });
    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'qr.png', { type: 'image/png' });
    expect(validarCuentaDeCobro({ ...qr, imagen: pdf }).imagen).toBe('archivoInvalido');
    expect(validarCuentaDeCobro({ ...qr, imagen: grande }).imagen).toBe('archivoGrande');
  });
});

describe('cuentas de cobro por HTTP (contrato de la API)', () => {
  it('crea una cuenta bancaria con los datos limpios y sin imagen', async () => {
    const { solicitar, cliente } = clienteFalso();
    await crearCobroHttp(cliente).crear(BANCARIA);
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'POST',
      ruta: '/plataforma/cuentas-de-cobro',
      cuerpo: {
        metodo: 'transferencia',
        banco: 'Banco Unión',
        nota: '',
        titular: 'AGROCOM S.R.L.',
        numero_cuenta: '10000123456',
        tipo_cuenta: 'corriente',
      },
    });
  });

  it('un QR sube antes su imagen y la cuenta la referencia por su id', async () => {
    const solicitar = vi.fn().mockResolvedValueOnce({ id: '77' }).mockResolvedValueOnce(undefined);
    const cliente = { solicitar } as unknown as ClienteHttp;
    const imagen = new File(['x'], 'qr.png', { type: 'image/png' });
    await crearCobroHttp(cliente).crear({
      ...FORMULARIO_VACIO,
      metodo: 'qr',
      banco: 'Banco Unión',
      imagen,
    });
    expect(solicitar).toHaveBeenNthCalledWith(1, {
      metodo: 'POST',
      ruta: '/plataforma/comprobantes',
      archivo: imagen,
    });
    expect(solicitar).toHaveBeenNthCalledWith(2, {
      metodo: 'POST',
      ruta: '/plataforma/cuentas-de-cobro',
      cuerpo: { metodo: 'qr', banco: 'Banco Unión', nota: '', imagen_id: '77' },
    });
  });

  it('editar un QR sin elegir otra imagen conserva la que tiene', async () => {
    const { solicitar, cliente } = clienteFalso();
    await crearCobroHttp(cliente).editar('5', {
      ...FORMULARIO_VACIO,
      metodo: 'qr',
      banco: 'Banco Unión',
      imagenActualId: '50',
    });
    expect(solicitar).toHaveBeenCalledOnce();
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'PATCH',
      ruta: '/plataforma/cuentas-de-cobro/5',
      cuerpo: { banco: 'Banco Unión', nota: '', imagen_id: '50' },
    });
  });

  it('activar y eliminar usan sus rutas', async () => {
    const { solicitar, cliente } = clienteFalso();
    const http = crearCobroHttp(cliente);
    await http.cambiarActivo('5', false);
    await http.eliminar('5');
    expect(solicitar).toHaveBeenNthCalledWith(1, {
      metodo: 'PATCH',
      ruta: '/plataforma/cuentas-de-cobro/5',
      cuerpo: { activo: false },
    });
    expect(solicitar).toHaveBeenNthCalledWith(2, {
      metodo: 'DELETE',
      ruta: '/plataforma/cuentas-de-cobro/5',
    });
  });

  it('lista las cuentas con sus nombres de campo', async () => {
    const { cliente } = clienteFalso({
      datos: [
        {
          id: '1',
          metodo: 'transferencia',
          banco: 'Banco Unión',
          titular: 'AGROCOM',
          numero_cuenta: '1',
          tipo_cuenta: null,
          imagen_id: null,
          nota: null,
          activo: true,
        },
      ],
    });
    expect(await crearCobroHttp(cliente).listar()).toEqual([
      {
        id: '1',
        metodo: 'transferencia',
        banco: 'Banco Unión',
        titular: 'AGROCOM',
        numeroCuenta: '1',
        tipoCuenta: null,
        imagenId: null,
        nota: null,
        activo: true,
      },
    ]);
  });
});
