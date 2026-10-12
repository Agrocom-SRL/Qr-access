import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma, type Problema } from '../helpers/http.js';

const BASE = '/api/v1/plataforma/cuentas';

interface SitioDto {
  id: string;
  nombre: string;
  direccion: string | null;
  zona_horaria: string;
  activo: boolean;
  puertas: {
    id: string;
    nombre: string;
    segundos_apertura: number;
    activa: boolean;
    dispositivo: unknown;
  }[];
}

describe('plataforma: sitios y puertas de una cuenta (HU-07, HU-08)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };
  let a: Escenario;
  let b: Escenario;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const llamar = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    prueba.app.inject({ method, url, headers, ...(payload === undefined ? {} : { payload }) });
  const estructura = async (cuentaId: string) =>
    (await llamar('GET', `${BASE}/${cuentaId}/sitios`)).json<{ datos: SitioDto[] }>().datos;

  describe('sitios', () => {
    it('crea un sitio con zona horaria por defecto y lo lista junto a las puertas', async () => {
      const respuesta = await llamar('POST', `${BASE}/${a.cuenta.id}/sitios`, {
        nombre: 'Planta Norte',
        direccion: ' Av. Cristo Redentor 120 ',
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);

      const sitios = await estructura(a.cuenta.id);
      expect(sitios.map((s) => s.nombre)).toEqual(['Planta Norte', 'Sitio AAA']);
      expect(sitios[0]).toMatchObject({
        direccion: 'Av. Cristo Redentor 120',
        zona_horaria: 'America/La_Paz',
        activo: true,
        puertas: [],
      });
    });

    it('rechaza un nombre repetido en la misma cuenta, pero no en otra', async () => {
      const repetido = await llamar('POST', `${BASE}/${a.cuenta.id}/sitios`, {
        nombre: 'Sitio AAA',
      });
      expect(repetido.statusCode).toBe(409);
      expect(repetido.json<Problema>().code).toBe('sitio.nombre_existente');
      const enOtra = await llamar('POST', `${BASE}/${b.cuenta.id}/sitios`, { nombre: 'Sitio AAA' });
      expect(enOtra.statusCode).toBe(201);
    });

    it('rechaza una zona horaria que no existe', async () => {
      const respuesta = await llamar('POST', `${BASE}/${a.cuenta.id}/sitios`, {
        nombre: 'X',
        zona_horaria: 'Mars/Olympus',
      });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('sitio.zona_invalida');
    });

    it('edita nombre, dirección, zona y estado', async () => {
      const respuesta = await llamar('PATCH', `${BASE}/${a.cuenta.id}/sitios/${a.sitioId}`, {
        nombre: 'Sede Central',
        direccion: null,
        zona_horaria: 'America/Santiago',
        activo: false,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(204);
      expect((await estructura(a.cuenta.id))[0]).toMatchObject({
        nombre: 'Sede Central',
        direccion: null,
        zona_horaria: 'America/Santiago',
        activo: false,
      });
    });

    it('no elimina un sitio con puertas; vacío, sí', async () => {
      const conPuertas = await llamar('DELETE', `${BASE}/${a.cuenta.id}/sitios/${a.sitioId}`);
      expect(conPuertas.statusCode).toBe(409);
      expect(conPuertas.json<Problema>().code).toBe('sitio.con_puertas');

      const nuevo = (
        await llamar('POST', `${BASE}/${a.cuenta.id}/sitios`, { nombre: 'Bodega' })
      ).json<{ id: string }>();
      const baja = await llamar('DELETE', `${BASE}/${a.cuenta.id}/sitios/${nuevo.id}`);
      expect(baja.statusCode).toBe(204);
      expect((await estructura(a.cuenta.id)).map((s) => s.nombre)).toEqual(['Sitio AAA']);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT deleted_at FROM sitios WHERE id = ?',
        [nuevo.id],
      );
      expect(filas[0]?.deleted_at).not.toBeNull();
    });

    it('un sitio de otra cuenta es 404 (aislamiento)', async () => {
      const editar = await llamar('PATCH', `${BASE}/${a.cuenta.id}/sitios/${b.sitioId}`, {
        nombre: 'Robado',
      });
      expect(editar.statusCode).toBe(404);
      expect(editar.json<Problema>().code).toBe('sitio.no_encontrado');
      const eliminar = await llamar('DELETE', `${BASE}/${a.cuenta.id}/sitios/${b.sitioId}`);
      expect(eliminar.statusCode).toBe(404);
      expect((await estructura(b.cuenta.id))[0]?.nombre).toBe('Sitio BBB');
    });
  });

  describe('puertas', () => {
    it('crea una puerta con 5 segundos por defecto', async () => {
      const respuesta = await llamar('POST', `${BASE}/${a.cuenta.id}/sitios/${a.sitioId}/puertas`, {
        nombre: 'Servicios',
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const puertas = (await estructura(a.cuenta.id))[0]?.puertas ?? [];
      expect(puertas.find((p) => p.nombre === 'Servicios')).toMatchObject({
        segundos_apertura: 5,
        activa: true,
        dispositivo: null,
      });
    });

    it('valida los segundos de apertura y repite nombre solo dentro del sitio', async () => {
      const url = `${BASE}/${a.cuenta.id}/sitios/${a.sitioId}/puertas`;
      expect((await llamar('POST', url, { nombre: 'X', segundos_apertura: 0 })).statusCode).toBe(
        400,
      );
      expect((await llamar('POST', url, { nombre: 'X', segundos_apertura: 31 })).statusCode).toBe(
        400,
      );
      const repetida = await llamar('POST', url, { nombre: 'Principal AAA' });
      expect(repetida.statusCode).toBe(409);
      expect(repetida.json<Problema>().code).toBe('puerta.nombre_existente');
    });

    it('edita el nombre y los segundos, y la desactiva', async () => {
      const url = `${BASE}/${a.cuenta.id}/puertas/${a.puertaTrasera.id}`;
      const respuesta = await llamar('PATCH', url, {
        nombre: 'Trasera de servicio',
        segundos_apertura: 12,
        activa: false,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(204);
      const puerta = (await estructura(a.cuenta.id))[0]?.puertas.find(
        (p) => p.id === a.puertaTrasera.id,
      );
      expect(puerta).toMatchObject({
        nombre: 'Trasera de servicio',
        segundos_apertura: 12,
        activa: false,
      });
    });

    it('no elimina una puerta con lector en servicio; sin él, sí', async () => {
      const conLector = await llamar(
        'DELETE',
        `${BASE}/${a.cuenta.id}/puertas/${a.puertaPrincipal.id}`,
      );
      expect(conLector.statusCode).toBe(409);
      expect(conLector.json<Problema>().code).toBe('puerta.con_dispositivo');

      const nueva = (
        await llamar('POST', `${BASE}/${a.cuenta.id}/sitios/${a.sitioId}/puertas`, {
          nombre: 'Sin lector',
        })
      ).json<{ id: string }>();
      const baja = await llamar('DELETE', `${BASE}/${a.cuenta.id}/puertas/${nueva.id}`);
      expect(baja.statusCode).toBe(204);
      expect(
        (await estructura(a.cuenta.id))[0]?.puertas.some((p) => p.nombre === 'Sin lector'),
      ).toBe(false);
    });

    it('una puerta de otra cuenta es 404 y no se crea una en el sitio de otra cuenta', async () => {
      const editar = await llamar(
        'PATCH',
        `${BASE}/${a.cuenta.id}/puertas/${b.puertaPrincipal.id}`,
        {
          nombre: 'Robada',
        },
      );
      expect(editar.statusCode).toBe(404);
      expect(editar.json<Problema>().code).toBe('puerta.no_encontrada');
      const crear = await llamar('POST', `${BASE}/${a.cuenta.id}/sitios/${b.sitioId}/puertas`, {
        nombre: 'Colada',
      });
      expect(crear.statusCode).toBe(404);
      expect((await estructura(b.cuenta.id))[0]?.puertas.map((p) => p.nombre)).toEqual([
        'Principal BBB',
        'Trasera BBB',
      ]);
    });
  });

  it('una cuenta inexistente es 404 y sin sesión de plataforma, 401', async () => {
    expect((await llamar('GET', `${BASE}/999999/sitios`)).json<Problema>().code).toBe(
      'cuenta.no_encontrada',
    );
    const sinSesion = await prueba.app.inject({
      method: 'GET',
      url: `${BASE}/${a.cuenta.id}/sitios`,
    });
    expect(sinSesion.statusCode).toBe(401);
  });

  it('cada cambio queda en la bitácora de la cuenta, firmado por el super admin', async () => {
    await llamar('POST', `${BASE}/${a.cuenta.id}/sitios`, { nombre: 'Bodega' });
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT tabla, accion FROM bitacoras WHERE tenant_id = ? AND tabla = 'sitios' ORDER BY id DESC LIMIT 1",
      [a.cuenta.id],
    );
    expect(filas.map((f: RowDataPacket) => [String(f.tabla), String(f.accion)])).toEqual([
      ['sitios', 'creado'],
    ]);
  });
});
