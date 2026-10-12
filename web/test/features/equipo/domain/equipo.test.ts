import {
  generarContrasenaTemporal,
  puedeDesactivar,
  sugerirUsuario,
  usuarioConFormatoValido,
  type MiembroEquipo,
} from '@/features/equipo/domain/equipo';

const miembro: MiembroEquipo = {
  id: '1',
  nombre: 'Marco Suárez',
  usuario: 'marco.suarez',
  activo: true,
  esActual: false,
  ultimoIngresoEn: null,
};

describe('puedeDesactivar', () => {
  it('otra persona activa sí', () => {
    expect(puedeDesactivar(miembro)).toBe(true);
  });

  it('uno mismo no', () => {
    expect(puedeDesactivar({ ...miembro, esActual: true })).toBe(false);
  });

  it('quien ya está desactivado no', () => {
    expect(puedeDesactivar({ ...miembro, activo: false })).toBe(false);
  });
});

describe('usuario', () => {
  it('se sugiere desde el nombre, sin tildes ni espacios', () => {
    expect(sugerirUsuario('Valeria Justiniano')).toBe('valeria.justiniano');
    expect(sugerirUsuario('  José  Ángel Ñuflo ')).toBe('jose.angel.nuflo');
  });

  it('valida el formato', () => {
    expect(usuarioConFormatoValido('valeria.justiniano')).toBe(true);
    expect(usuarioConFormatoValido('ab')).toBe(false);
    expect(usuarioConFormatoValido('con espacio')).toBe(false);
  });
});

describe('generarContrasenaTemporal', () => {
  it('son 12 caracteres en tres grupos y supera el mínimo de la API', () => {
    let contador = 0;
    const clave = generarContrasenaTemporal(() => contador++ % 50);
    expect(clave).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
    expect(clave.length).toBeGreaterThanOrEqual(10);
  });

  it('no usa caracteres ambiguos', () => {
    const clave = generarContrasenaTemporal((limite) => limite - 1);
    expect(clave).not.toMatch(/[0OIl1]/);
  });
});
