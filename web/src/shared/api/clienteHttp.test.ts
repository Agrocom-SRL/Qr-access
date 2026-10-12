import { AlmacenSesion } from './almacenSesion';
import { crearClienteFetch } from './clienteHttp';
import { ErrorApi } from './errorApi';

function respuesta(estado: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado });
}

function armar(respuestas: Response[]) {
  const sesion = new AlmacenSesion();
  sesion.guardar({ acceso: 'a1', refresco: 'r1' });
  const llamadas: { url: string; auth: string | null }[] = [];
  const falso = vi.fn<typeof fetch>((url, init) => {
    llamadas.push({
      url: url instanceof Request ? url.url : String(url),
      auth: new Headers(init?.headers).get('Authorization'),
    });
    const siguiente = respuestas.shift();
    if (!siguiente) throw new TypeError('sin red');
    return Promise.resolve(siguiente);
  });
  const alSesionVencida = vi.fn();
  const cliente = crearClienteFetch({
    baseUrl: '/api/v1',
    sesion,
    alSesionVencida,
    implementacionFetch: falso,
  });
  return { cliente, sesion, llamadas, alSesionVencida };
}

describe('clienteHttp', () => {
  it('manda el Bearer y arma la consulta sin valores vacíos', async () => {
    const { cliente, llamadas } = armar([respuesta(200, { ok: true })]);
    await cliente.solicitar({ metodo: 'GET', ruta: '/cuentas', consulta: { pagina: 2, q: '' } });
    expect(llamadas[0]).toEqual({ url: '/api/v1/cuentas?pagina=2', auth: 'Bearer a1' });
  });

  it('traduce un problema RFC 9457 a ErrorApi con su code', async () => {
    const { cliente } = armar([
      respuesta(409, { code: 'cuenta.codigo_existente', title: 'x', status: 409, cuenta: 'FRO' }),
    ]);
    const error = await cliente.solicitar({ metodo: 'GET', ruta: '/x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({
      status: 409,
      code: 'cuenta.codigo_existente',
      extra: { cuenta: 'FRO' },
    });
  });

  it('en 401 refresca los tokens y reintenta una vez', async () => {
    const { cliente, sesion, llamadas } = armar([
      respuesta(401, { code: 'autenticacion.requerida' }),
      respuesta(200, { acceso: 'a2', refresco: 'r2' }),
      respuesta(200, { datos: [] }),
    ]);
    await cliente.solicitar({ metodo: 'GET', ruta: '/cuentas' });
    expect(sesion.obtener()).toEqual({ acceso: 'a2', refresco: 'r2' });
    expect(llamadas.map((l) => l.auth)).toEqual(['Bearer a1', null, 'Bearer a2']);
  });

  it('si el refresco falla, limpia la sesión y avisa que terminó', async () => {
    const { cliente, sesion, alSesionVencida } = armar([
      respuesta(401, { code: 'autenticacion.requerida' }),
      respuesta(401, { code: 'sesion.refresco_invalido' }),
    ]);
    await expect(cliente.solicitar({ metodo: 'GET', ruta: '/cuentas' })).rejects.toBeInstanceOf(
      ErrorApi,
    );
    expect(sesion.obtener()).toBeNull();
    expect(alSesionVencida).toHaveBeenCalledOnce();
  });

  it('sin red lanza red.sin_conexion', async () => {
    const { cliente } = armar([]);
    await expect(cliente.solicitar({ metodo: 'GET', ruta: '/cuentas' })).rejects.toMatchObject({
      code: 'red.sin_conexion',
    });
  });
});
