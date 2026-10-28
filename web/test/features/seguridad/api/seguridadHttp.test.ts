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
  it('ingresar guarda el acceso en memoria y devuelve solo datos de dominio', async () => {
    const sesion = new AlmacenSesion();
    const { cliente, llamadas } = clienteQueResponde({
      acceso: 'a',
      usuario: { id: '7', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
      debe_cambiar_contrasena: true,
      permisos: ['seguridad.equipo.ver'],
    });
    const resultado = await crearSeguridadHttp(cliente, sesion).ingresar(
      'lucia.paz',
      'secreta-12345',
    );
    expect(llamadas[0]).toMatchObject({ metodo: 'POST', ruta: '/plataforma/sesiones' });
    expect(sesion.obtener()).toBe('a');
    expect(resultado).toEqual({
      usuario: { id: '7', nombre: 'Lucía Paz', usuario: 'lucia.paz' },
      debeCambiarContrasena: true,
      permisos: ['seguridad.equipo.ver'],
    });
    expect(JSON.stringify(resultado)).not.toContain('refresco');
  });

  it('ingresar no deja ningún refresco en el almacenamiento del navegador', async () => {
    const { cliente } = clienteQueResponde({
      acceso: 'a',
      usuario: { id: '7', nombre: null, usuario: 'lucia.paz' },
      debe_cambiar_contrasena: false,
      permisos: [],
    });
    await crearSeguridadHttp(cliente, new AlmacenSesion()).ingresar('lucia.paz', 'secreta-12345');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('cerrarSesión limpia la sesión aunque la API falle', async () => {
    const sesion = new AlmacenSesion();
    sesion.guardar('a');
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

    it('pide el refresco con cuerpo vacío: el navegador manda la cookie y el panel no la conoce', async () => {
      const { cliente, llamadas } = clienteQueResponde({ acceso: 'a2' });
      await crearSeguridadHttp(cliente, new AlmacenSesion()).restaurar();
      expect(llamadas[0]).toEqual({ metodo: 'POST', ruta: '/sesiones/refresco', cuerpo: {} });
    });

    it('sin cookie válida (401) no hay sesión y no queda nada guardado', async () => {
      const sesion = new AlmacenSesion();
      const cliente: ClienteHttp = {
        solicitar: () => Promise.reject(new ErrorApi(401, 'sesion.refresco_invalido')),
      };
      expect(await crearSeguridadHttp(cliente, sesion).restaurar()).toBeNull();
      expect(sesion.obtener()).toBeNull();
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });

    it('con cookie válida refresca, guarda el acceso y trae el perfil', async () => {
      const sesion = new AlmacenSesion();
      const cliente: ClienteHttp = {
        solicitar: <T>(solicitud: SolicitudHttp) =>
          Promise.resolve(
            (solicitud.ruta === '/sesiones/refresco' ? { acceso: 'a2' } : perfil) as T,
          ),
      };
      const restaurada = await crearSeguridadHttp(cliente, sesion).restaurar();
      expect(restaurada).toMatchObject({ usuario: { usuario: 'lucia.paz' } });
      expect(sesion.obtener()).toBe('a2');
      expect(sessionStorage.length).toBe(0);
    });

    it('sin red conserva el acceso que hubiera en memoria', async () => {
      const sesion = new AlmacenSesion();
      sesion.guardar('a');
      const cliente: ClienteHttp = {
        solicitar: () => Promise.reject(new ErrorApi(0, 'red.sin_conexion')),
      };
      expect(await crearSeguridadHttp(cliente, sesion).restaurar()).toBeNull();
      expect(sesion.obtener()).toBe('a');
    });

    it('la restauración se hace una sola vez aunque se pida dos veces (StrictMode)', async () => {
      const { cliente, llamadas } = clienteQueResponde({ acceso: 'a2' });
      const repositorio = crearSeguridadHttp(cliente, new AlmacenSesion());
      await Promise.all([repositorio.restaurar(), repositorio.restaurar()]);
      expect(llamadas.filter((l) => l.ruta === '/sesiones/refresco')).toHaveLength(1);
    });
  });
});
