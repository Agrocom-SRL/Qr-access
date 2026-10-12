import { validarCambioDeContrasena } from './contrasena';
import { tienePermiso } from './sesion';

describe('validarCambioDeContrasena', () => {
  const valido = { actual: 'la-actual-123', nueva: 'una-nueva-1234', repetida: 'una-nueva-1234' };

  it('acepta un cambio correcto', () => {
    expect(validarCambioDeContrasena(valido)).toEqual({});
  });

  it('exige mínimo 10 caracteres', () => {
    expect(validarCambioDeContrasena({ ...valido, nueva: 'corta', repetida: 'corta' }).nueva).toBe(
      'corta',
    );
  });

  it('la nueva no puede ser igual a la actual', () => {
    const errores = validarCambioDeContrasena({
      ...valido,
      nueva: valido.actual,
      repetida: valido.actual,
    });
    expect(errores.nueva).toBe('igualAlActual');
  });

  it('la repetición tiene que coincidir', () => {
    expect(validarCambioDeContrasena({ ...valido, repetida: 'otra-cosa-123' }).repetida).toBe(
      'noCoinciden',
    );
  });

  it('marca los campos vacíos como requeridos', () => {
    const errores = validarCambioDeContrasena({ actual: '', nueva: '', repetida: '' });
    expect(errores).toMatchObject({ actual: 'requerido', nueva: 'requerido' });
  });
});

describe('tienePermiso', () => {
  it('busca el código exacto', () => {
    expect(tienePermiso(['seguridad.equipo.ver'], 'seguridad.equipo.ver')).toBe(true);
    expect(tienePermiso(['seguridad.equipo.ver'], 'seguridad.equipo')).toBe(false);
  });
});
