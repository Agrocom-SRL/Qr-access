import { AlmacenSesion } from '../../../shared/api/almacenSesion';
import type { ClienteHttp, SolicitudHttp } from '../../../shared/api/clienteHttp';
import { crearSeguridadHttp } from './seguridadHttp';

function clienteQueResponde(respuesta: unknown) {
  const llamadas: SolicitudHttp[] = [];
  const cliente: ClienteHttp = {
    solicitar: <T>(solicitud: SolicitudHttp) => {
      llamadas.push(solicitud);
      return Promise.resolve(respuesta as T);
    },
  };
  return { cliente, llamadas };
}

describe('seguridadHttp', () => {
  it('ingresar guarda los tokens en memoria y devuelve solo datos de dominio', async () => {
    const sesion = new AlmacenSesion();
    const { cliente, llamadas } = clienteQueResponde({
      acceso: 'a',
      refresco: 'r',
      usuario: { id: '7', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
      debe_cambiar_contrasena: true,
      permisos: ['seguridad.equipo.ver'],
    });
    const resultado = await crearSeguridadHttp(cliente, sesion).ingresar(
      'lucia.paz',
      'secreta-12345',
    );
    expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: '/plataforma/sesiones' });
    expect(sesion.obtener()).toEqual({ acceso: 'a', refresco: 'r' });
    expect(resultado).toEqual({
      usuario: { id: '7', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
      debeCambiarContrasena: true,
      permisos: ['seguridad.equipo.ver'],
    });
    expect(JSON.stringify(resultado)).not.toContain('refresco');
  });

  it('cerrarSesión limpia la sesión aunque la API falle', async () => {
    const sesion = new AlmacenSesion();
    sesion.guardar({ acceso: 'a', refresco: 'r' });
    const cliente: ClienteHttp = { solicitar: () => Promise.reject(new Error('sin red')) };
    await expect(crearSeguridadHttp(cliente, sesion).cerrarSesion()).rejects.toThrow();
    expect(sesion.obtener()).toBeNull();
  });
});
