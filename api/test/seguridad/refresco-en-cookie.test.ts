import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearSuperAdmin, type SuperAdminDePrueba } from '../helpers/fixtures.js';

const BASE = '/api/v1';
const PANEL = { 'x-requested-with': 'agrocom-panel' };

/** El valor de la cookie que la respuesta fija (`nombre=valor; atributos`), o undefined si no hay. */
function cookieDe(respuesta: { headers: Record<string, unknown> }, nombre: string) {
  const crudo = respuesta.headers['set-cookie'];
  const lista = Array.isArray(crudo)
    ? (crudo as string[])
    : typeof crudo === 'string'
      ? [crudo]
      : [];
  return lista.find((c) => c.startsWith(`${nombre}=`));
}

describe('refresco en cookie HttpOnly (ADR 0033 §5)', () => {
  let prueba: AppDePrueba;
  let lucia: SuperAdminDePrueba;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz', { nombre: 'Lucía Paz' });
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const ingresarDesdeElPanel = () =>
    prueba.app.inject({
      method: 'POST',
      url: `${BASE}/plataforma/sesiones`,
      headers: PANEL,
      payload: { usuario: 'lucia.paz', contrasena: lucia.contrasena },
    });

  const refrescar = (headers: Record<string, string>, payload: object = {}) =>
    prueba.app.inject({
      method: 'POST',
      url: `${BASE}/sesiones/refresco`,
      headers,
      payload,
    });

  it('un navegador recibe el refresco en la cookie y el cuerpo no lo trae', async () => {
    const respuesta = await ingresarDesdeElPanel();
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).not.toHaveProperty('refresco');
    const cookie = cookieDe(respuesta, '__Host-refresco-panel');
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Domain');
  });

  it('la app nativa sigue recibiendo el refresco en el cuerpo, sin cookie', async () => {
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: `${BASE}/plataforma/sesiones`,
      payload: { usuario: 'lucia.paz', contrasena: lucia.contrasena },
    });
    expect(respuesta.json()).toHaveProperty('refresco');
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });

  it('refresca con la cookie, rota el refresco y entrega uno nuevo en la cookie', async () => {
    const ingreso = await ingresarDesdeElPanel();
    const cookie = (cookieDe(ingreso, '__Host-refresco-panel') ?? '').split(';')[0] ?? '';
    const cabeceras = { ...PANEL, cookie, origin: 'http://localhost' };
    const respuesta = await refrescar(cabeceras);
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ acceso: expect.any(String) as string });
    const nueva = cookieDe(respuesta, '__Host-refresco-panel');
    expect(nueva).toBeDefined();
    expect(nueva?.split(';')[0]).not.toBe(cookie);
    // La cookie vieja ya rotó: presentarla otra vez es un reuso.
    expect((await refrescar(cabeceras)).statusCode).toBe(401);
  });

  it('la cookie sin origen propio se rechaza (CSRF)', async () => {
    const ingreso = await ingresarDesdeElPanel();
    const cookie = (cookieDe(ingreso, '__Host-refresco-panel') ?? '').split(';')[0] ?? '';
    const sinOrigen = await refrescar({ ...PANEL, cookie });
    expect(sinOrigen.statusCode).toBe(403);
    expect(sinOrigen.json()).toMatchObject({ code: 'sesion.origen_invalido' });
    const ajeno = await refrescar({ ...PANEL, cookie, origin: 'https://sitio-ajeno.example' });
    expect(ajeno.statusCode).toBe(403);
  });

  it('sin la cabecera propia la cookie no cuenta', async () => {
    const ingreso = await ingresarDesdeElPanel();
    const cookie = (cookieDe(ingreso, '__Host-refresco-panel') ?? '').split(';')[0] ?? '';
    const respuesta = await refrescar({ cookie, origin: 'http://localhost' });
    expect(respuesta.statusCode).toBe(401);
  });

  it('la cookie del panel no sirve a la app web, y viceversa', async () => {
    const ingreso = await ingresarDesdeElPanel();
    const cookie = (cookieDe(ingreso, '__Host-refresco-panel') ?? '').split(';')[0] ?? '';
    const respuesta = await refrescar({
      'x-requested-with': 'agrocom-app',
      cookie,
      origin: 'http://localhost',
    });
    expect(respuesta.statusCode).toBe(401);
  });

  it('un cuerpo distinto de la cookie es ambiguo', async () => {
    const ingreso = await ingresarDesdeElPanel();
    const cookie = (cookieDe(ingreso, '__Host-refresco-panel') ?? '').split(';')[0] ?? '';
    const respuesta = await refrescar(
      { ...PANEL, cookie, origin: 'http://localhost' },
      { refresco: 'otro-refresco' },
    );
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toMatchObject({ code: 'sesion.refresco_ambiguo' });
  });

  it('un refresco rechazado borra la cookie del navegador', async () => {
    const respuesta = await refrescar({
      ...PANEL,
      cookie: '__Host-refresco-panel=inventado',
      origin: 'http://localhost',
    });
    expect(respuesta.statusCode).toBe(401);
    expect(cookieDe(respuesta, '__Host-refresco-panel')).toContain('Max-Age=0');
  });

  it('cerrar sesión borra la cookie', async () => {
    const ingreso = await ingresarDesdeElPanel();
    const { acceso } = ingreso.json<{ acceso: string }>();
    const respuesta = await prueba.app.inject({
      method: 'DELETE',
      url: `${BASE}/plataforma/sesiones/actual`,
      headers: { authorization: `Bearer ${acceso}`, ...PANEL },
    });
    expect(respuesta.statusCode).toBe(204);
    expect(cookieDe(respuesta, '__Host-refresco-panel')).toContain('Max-Age=0');
  });
});
