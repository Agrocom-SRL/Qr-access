import { AlmacenSesion } from '@/shared/api/almacenSesion';

describe('AlmacenSesion', () => {
  it('guarda el acceso solo en memoria: no escribe nada en el almacenamiento del navegador', () => {
    const almacen = new AlmacenSesion();
    almacen.guardar('a');
    expect(almacen.obtener()).toBe('a');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('una instancia nueva no recuerda la sesión de la anterior (recargar la página)', () => {
    new AlmacenSesion().guardar('a');
    expect(new AlmacenSesion().obtener()).toBeNull();
  });

  it('limpiar borra el acceso y avisa a los suscriptores', () => {
    const almacen = new AlmacenSesion();
    const oyente = vi.fn();
    almacen.suscribir(oyente);
    almacen.guardar('a');
    almacen.limpiar();
    expect(almacen.obtener()).toBeNull();
    expect(oyente).toHaveBeenCalledTimes(2);
  });

  it('dejar de suscribirse corta los avisos', () => {
    const almacen = new AlmacenSesion();
    const oyente = vi.fn();
    const cancelar = almacen.suscribir(oyente);
    cancelar();
    almacen.guardar('a');
    expect(oyente).not.toHaveBeenCalled();
  });
});
