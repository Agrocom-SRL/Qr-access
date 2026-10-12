import {
  BORRADOR_VACIO,
  hoyIso,
  normalizarCodigo,
  validarEmpresa,
  validarVigencia,
  venceUnAnioDespues,
} from '@/features/cuentas/domain/alta';
import { usuariosDisponibles } from '@/features/cuentas/domain/cuenta';

const completa = {
  razonSocial: 'Agrícola Guarayos S.A.',
  nit: '2876501019',
  ciudad: 'Ascensión de Guarayos',
  codigo: 'AGU',
  contactoNombre: 'Rodrigo Añez',
  contactoTelefono: '7 712 4405',
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

  it('marca lo requerido', () => {
    const errores = validarEmpresa(BORRADOR_VACIO('2026-10-12').empresa);
    expect(Object.keys(errores).sort()).toEqual([
      'ciudad',
      'codigo',
      'contactoNombre',
      'contactoTelefono',
      'nit',
      'razonSocial',
    ]);
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
