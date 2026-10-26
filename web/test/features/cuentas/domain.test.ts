import {
  BORRADOR_VACIO,
  hoyIso,
  nombreCompletoDelResponsable,
  normalizarCodigo,
  validarEmpresa,
  validarPagoDeAlta,
  validarVigencia,
  venceUnAnioDespues,
} from '@/features/cuentas/domain/alta';
import {
  destinosDeReasignacion,
  inactivosDe,
  ruidososDe,
  titularesCercaDelTope,
  type EstadisticasDeUsuarios,
  sufijoDePinValido,
  topeDeMiembrosValido,
  usuariosDisponibles,
  type RamaDeAdministrador,
} from '@/features/cuentas/domain/cuenta';

const completa = {
  razonSocial: 'Agrícola Guarayos S.A.',
  nit: '2876501019',
  ciudad: 'Ascensión de Guarayos',
  codigo: 'AGU',
  contactoNombre: 'Rodrigo',
  contactoApellido: 'Añez',
  contactoTelefono: '7 712 4405',
  contactoCorreo: 'rodrigo@guarayos.bo',
};

describe('normalizarCodigo', () => {
  it('mayúsculas, solo letras y máximo 3', () => {
    expect(normalizarCodigo('ag1u-x')).toBe('AGU');
    expect(normalizarCodigo('ñ')).toBe('');
  });
});

describe('validarEmpresa', () => {
  it('acepta datos completos', () => {
    expect(validarEmpresa(completa)).toEqual({});
  });

  it('marca lo requerido: nombre de la cuenta, código, ciudad y nombre y apellido del responsable', () => {
    const errores = validarEmpresa(BORRADOR_VACIO('2026-10-12').empresa);
    expect(Object.keys(errores).sort()).toEqual([
      'ciudad',
      'codigo',
      'contactoApellido',
      'contactoNombre',
      'razonSocial',
    ]);
  });

  it('el NIT, el teléfono y el correo son opcionales: vacíos no marcan error', () => {
    expect(
      validarEmpresa({ ...completa, nit: '', contactoTelefono: '', contactoCorreo: '' }),
    ).toEqual({});
  });

  it('el apellido del responsable es obligatorio', () => {
    expect(validarEmpresa({ ...completa, contactoApellido: ' ' }).contactoApellido).toBe(
      'requerido',
    );
  });

  it('valida formato de NIT, código y teléfono', () => {
    const errores = validarEmpresa({
      ...completa,
      nit: '12',
      codigo: 'AG',
      contactoTelefono: 'abc',
    });
    expect(errores).toEqual({ nit: 'formato', codigo: 'formato', contactoTelefono: 'formato' });
  });
});

describe('validarVigencia', () => {
  it('pide inicio válido y nombre del administrador', () => {
    expect(validarVigencia({ inicio: '2026-10-12', administradorNombre: 'Rodrigo' })).toEqual({});
    expect(validarVigencia({ inicio: '', administradorNombre: ' ' })).toEqual({
      inicio: 'requerido',
      administradorNombre: 'requerido',
    });
    expect(validarVigencia({ inicio: '12/10/2026', administradorNombre: 'R' }).inicio).toBe(
      'formato',
    );
  });
});

describe('venceUnAnioDespues', () => {
  it('suma 12 meses', () => {
    expect(venceUnAnioDespues('2026-10-12')).toBe('2027-10-12');
  });

  it('no se pasa de fin de mes', () => {
    expect(venceUnAnioDespues('2028-02-29')).toBe('2029-02-28');
  });
});

describe('hoyIso', () => {
  it('es la fecha de La Paz, no la de UTC', () => {
    expect(hoyIso(new Date('2026-10-12T02:00:00Z'))).toBe('2026-10-11');
    expect(hoyIso(new Date('2026-10-12T05:00:00Z'))).toBe('2026-10-12');
  });
});

describe('usuariosDisponibles', () => {
  it('cupo menos activos, nunca negativo, y sin tope = null', () => {
    expect(usuariosDisponibles(87, 100)).toBe(13);
    expect(usuariosDisponibles(120, 100)).toBe(0);
    expect(usuariosDisponibles(5, null)).toBeNull();
  });
});

describe('validarPagoDeAlta', () => {
  const pago = {
    modo: 'ahora' as const,
    monto: '12.000',
    fechaPago: '2026-10-12',
    medio: 'transferencia' as const,
    referencia: 'TRF-1',
    comprobante: new File(['x'], 'comprobante.png', { type: 'image/png' }),
  };

  it('cobrar después no pide nada', () => {
    expect(validarPagoDeAlta({ ...pago, modo: 'despues', monto: '', referencia: '' })).toEqual({});
  });

  it('con el pago ahora pide monto y fecha; la referencia es opcional', () => {
    expect(validarPagoDeAlta(pago)).toEqual({});
    expect(validarPagoDeAlta({ ...pago, monto: '', fechaPago: '', referencia: ' ' })).toEqual({
      monto: 'requerido',
      fechaPago: 'requerido',
    });
    expect(validarPagoDeAlta({ ...pago, monto: '12,5' }).monto).toBe('formato');
  });
});

describe('correo de la persona responsable', () => {
  it('es opcional, pero si se escribe tiene que parecer un correo', () => {
    expect(validarEmpresa({ ...completa, contactoCorreo: '' }).contactoCorreo).toBeUndefined();
    expect(validarEmpresa({ ...completa, contactoCorreo: 'sin-arroba' }).contactoCorreo).toBe(
      'formato',
    );
  });
});

describe('nombreCompletoDelResponsable', () => {
  it('une nombre y apellido, sin espacios sobrantes', () => {
    expect(
      nombreCompletoDelResponsable({ contactoNombre: ' Rodrigo ', contactoApellido: 'Añez' }),
    ).toBe('Rodrigo Añez');
  });
});

describe('tope de Miembros por Titular (ADR 0028 §6)', () => {
  it('es un entero de 1 a 500', () => {
    for (const valido of [1, 10, 500]) expect(topeDeMiembrosValido(valido)).toBe(true);
    for (const invalido of [0, -3, 501, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(topeDeMiembrosValido(invalido)).toBe(false);
    }
  });
});

describe('sufijo del PIN de un administrador nuevo', () => {
  it('son 4 letras o números', () => {
    for (const valido of ['AB12', 'ab12', '0000', 'ZZZZ'])
      expect(sufijoDePinValido(valido)).toBe(true);
    for (const invalido of ['', 'AB1', 'AB123', 'A-B1', 'AB 1', 'ÁB12']) {
      expect(sufijoDePinValido(invalido)).toBe(false);
    }
  });
});

describe('destinos de una reasignación', () => {
  const rama = (id: string): RamaDeAdministrador => ({
    id,
    etiqueta: `Admin ${id}`,
    guardias: [],
    titulares: [],
  });

  it('son todos los administradores menos el que ya lo tiene', () => {
    const ramas = [rama('1'), rama('2'), rama('3')];
    expect(destinosDeReasignacion(ramas, '2').map((r) => r.id)).toEqual(['1', '3']);
  });

  it('con un solo administrador no hay a quién mover', () => {
    expect(destinosDeReasignacion([rama('1')], '1')).toEqual([]);
  });
});

describe('listas del uso de usuarios', () => {
  const uso = (id: string, inactivo: boolean, ruidoso: boolean) => ({
    id,
    etiqueta: id,
    rol: 'Miembro',
    unidad: null,
    qrGenerados: 0,
    qrUsados: 0,
    maxQrEnUnDia: 0,
    ultimoQrEn: null,
    inactivo,
    ruidoso,
  });
  const titular = (id: string, cercaDelTope: boolean) => ({
    id,
    etiqueta: id,
    unidad: null,
    miembros: 1,
    tope: 10,
    porcentaje: 10,
    cercaDelTope,
  });
  const datos: EstadisticasDeUsuarios = {
    ventanaDias: 30,
    umbralInactivoDias: 30,
    umbralRuidosoPorDia: 10,
    usuarios: [uso('a', true, false), uso('b', false, true), uso('c', false, false)],
    titulares: [titular('t1', true), titular('t2', false)],
    ramas: [],
  };

  it('separan inactivos, ruidosos y Titulares cerca del tope sin recalcular nada', () => {
    expect(inactivosDe(datos).map((u) => u.id)).toEqual(['a']);
    expect(ruidososDe(datos).map((u) => u.id)).toEqual(['b']);
    expect(titularesCercaDelTope(datos).map((t) => t.id)).toEqual(['t1']);
  });
});
