import { AlmacenSesion } from '@/shared/api/almacenSesion';
import { crearClienteFetch } from '@/shared/api/clienteHttp';
import { ErrorApi } from '@/shared/api/errorApi';

function respuesta(estado: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado });
}

interface LlamadaRegistrada {
  url: string;
  auth: string | null;
  cliente: string | null;
  metodo: string | undefined;
  cuerpo: string | null | undefined;
}

function armar(respuestas: Response[]) {
  const sesion = new AlmacenSesion();
  sesion.guardar('a1');
  const llamadas: LlamadaRegistrada[] = [];
  const falso = vi.fn<typeof fetch>((url, init) => {
    const cabeceras = new Headers(init?.headers);
    llamadas.push({
      url: url instanceof Request ? url.url : String(url),
      auth: cabeceras.get('Authorization'),
      cliente: cabeceras.get('X-Requested-With'),
      metodo: init?.method,
      cuerpo:
        typeof init?.body === 'string' ? init.body : init?.body === undefined ? undefined : null,
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
    expect(llamadas[0]).toMatchObject({ url: '/api/v1/cuentas?pagina=2', auth: 'Bearer a1' });
  });

  it('se anuncia como panel con X-Requested-With en cada petición, también en las de archivo', async () => {
    const { cliente, llamadas } = armar([
      respuesta(200, { ok: true }),
      respuesta(200, { ok: true }),
    ]);
    await cliente.solicitar({ metodo: 'GET', ruta: '/cuentas' });
    await cliente.solicitar({
      metodo: 'POST',
      ruta: '/comprobantes',
      archivo: new Blob(['x'], { type: 'image/png' }),
    });
    expect(llamadas.map((l) => l.cliente)).toEqual(['agrocom-panel', 'agrocom-panel']);
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

  it('en 401 refresca el acceso con cuerpo vacío (el refresco va en la cookie) y reintenta una vez', async () => {
    const { cliente, sesion, llamadas } = armar([
      respuesta(401, { code: 'autenticacion.requerida' }),
      respuesta(200, { acceso: 'a2' }),
      respuesta(200, { datos: [] }),
    ]);
    await cliente.solicitar({ metodo: 'GET', ruta: '/cuentas' });
    expect(sesion.obtener()).toBe('a2');
    expect(llamadas.map((l) => l.auth)).toEqual(['Bearer a1', null, 'Bearer a2']);
    expect(llamadas[1]).toMatchObject({
      metodo: 'POST',
      url: '/api/v1/sesiones/refresco',
      cuerpo: '{}',
    });
  });

  it('el refresco nunca se guarda en el almacenamiento del navegador', async () => {
    const { cliente } = armar([
      respuesta(401, { code: 'autenticacion.requerida' }),
      respuesta(200, { acceso: 'a2' }),
      respuesta(200, { datos: [] }),
    ]);
    await cliente.solicitar({ metodo: 'GET', ruta: '/cuentas' });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
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

  it('formato respuesta devuelve la Response completa para leer sus cabeceras', async () => {
    const { cliente } = armar([
      new Response('a,b', { status: 200, headers: { 'x-total-filas': '2' } }),
    ]);
    const respuesta = await cliente.solicitar<Response>({
      metodo: 'GET',
      ruta: '/exportacion',
      formato: 'respuesta',
    });
    expect(respuesta.headers.get('x-total-filas')).toBe('2');
    expect(await respuesta.text()).toBe('a,b');
  });

  it('sin red lanza red.sin_conexion', async () => {
    const { cliente } = armar([]);
    await expect(cliente.solicitar({ metodo: 'GET', ruta: '/cuentas' })).rejects.toMatchObject({
      code: 'red.sin_conexion',
    });
  });
});
