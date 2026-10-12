import { estadoListado } from './estadoListado';

const base = { cargando: false, error: false, cantidad: undefined, conexion: true };

describe('estadoListado', () => {
  it('sin respuesta todavía es carga', () => {
    expect(estadoListado({ ...base, cargando: true })).toBe('cargando');
  });

  it('respuesta sin filas es vacío', () => {
    expect(estadoListado({ ...base, cantidad: 0 })).toBe('vacio');
  });

  it('un error sin datos es error', () => {
    expect(estadoListado({ ...base, error: true })).toBe('error');
  });

  it('sin red y sin caché es la pantalla completa sin conexión', () => {
    expect(estadoListado({ ...base, conexion: false })).toBe('sinConexionTotal');
  });

  it('sin red pero con caché sigue mostrando los datos', () => {
    expect(estadoListado({ ...base, cantidad: 3, conexion: false })).toBe('datos');
  });

  it('un error con datos en caché conserva la tabla', () => {
    expect(estadoListado({ ...base, cantidad: 3, error: true })).toBe('datos');
  });
});
