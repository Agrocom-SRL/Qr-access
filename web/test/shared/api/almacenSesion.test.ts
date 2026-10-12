import { AlmacenSesion } from '@/shared/api/almacenSesion';

describe('AlmacenSesion', () => {
  it('recuerda solo el refresco en la pestaña y lo borra al limpiar', () => {
    const almacen = new AlmacenSesion();
    almacen.guardar({ acceso: 'a', refresco: 'r' });
    expect(sessionStorage.getItem('acceso.refresco')).toBe('r');
    expect(JSON.stringify(sessionStorage)).not.toContain('"a"');
    expect(new AlmacenSesion().refrescoRecordado()).toBe('r');
    almacen.limpiar();
    expect(new AlmacenSesion().refrescoRecordado()).toBeNull();
  });

  it('sin almacenamiento sigue funcionando en memoria', () => {
    const almacen = new AlmacenSesion(null);
    almacen.guardar({ acceso: 'a', refresco: 'r' });
    expect(almacen.obtener()?.acceso).toBe('a');
    expect(almacen.refrescoRecordado()).toBeNull();
  });
});
