import { AlmacenSesion } from '@/shared/api/almacenSesion';
import type { ClienteHttp, SolicitudHttp } from '@/shared/api/clienteHttp';
import { ErrorApi } from '@/shared/api/errorApi';
import { crearSeguridadHttp } from '@/features/seguridad/api/seguridadHttp';

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

  describe('restaurar', () => {
    const perfil = {
      id: '7',
      nombre: null,
      usuario: 'lucia.paz',
      creado_at: '2026-01-01T00:00:00Z',
      ultimo_ingreso_at: null,
      debe_cambiar_contrasena: false,
      permisos: ['seguridad.equipo.ver'],
    };

    it('sin refresco recordado no llama a la API', async () => {
      const { cliente, llamadas } = clienteQueResponde({});
      expect(await crearSeguridadHttp(cliente, new AlmacenSesion()).restaurar()).toBeNull();
      expect(llamadas).toHaveLength(0);
    });

    it('refresca, trae el perfil y rota el refresco recordado', async () => {
      const sesion = new AlmacenSesion();
      sesion.guardar({ acceso: 'viejo', refresco: 'r1' });
      const cliente: ClienteHttp = {
        solicitar: <T>(solicitud: SolicitudHttp) =>
          Promise.resolve(
            (solicitud.ruta === '/sesiones/refresco'
              ? { acceso: 'a2', refresco: 'r2' }
              : perfil) as T,
          ),
      };
      const restaurada = await crearSeguridadHttp(cliente, new AlmacenSesion()).restaurar();
      expect(restaurada).toMatchObject({ usuario: { usuario: 'lucia.paz' } });
      expect(sessionStorage.getItem('acceso.refresco')).toBe('r2');
    });

    it('un refresco rechazado borra lo recordado', async () => {
      const sesion = new AlmacenSesion();
      sesion.guardar({ acceso: 'a', refresco: 'r1' });
      const cliente: ClienteHttp = {
        solicitar: () => Promise.reject(new ErrorApi(401, 'sesion.invalida')),
      };
      expect(await crearSeguridadHttp(cliente, sesion).restaurar()).toBeNull();
      expect(sesion.refrescoRecordado()).toBeNull();
    });
  });
});
