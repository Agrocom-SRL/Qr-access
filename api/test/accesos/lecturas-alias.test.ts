import type { ResultSetHeader } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin, type Escenario } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Sesion,
} from '../helpers/http.js';

/**
 * La tabla y el recurso se llaman `lecturas` (ADR 0032 §5). Las rutas anteriores (`/eventos-acceso`,
 * `/plataforma/eventos-acceso`) siguen vivas con el MISMO contrato y quedan marcadas como obsoletas en el
 * OpenAPI (ADR 0005). Aquí se prueba que ambos nombres responden lo mismo y que el aislamiento por cuenta
 * vale en los dos.
 */
describe('lecturas: ruta vigente y alias obsoleto', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let admin: Sesion;
  let plataforma: { authorization: string };
  let idDeA: string;
  let idDeB: string;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    admin = await iniciarSesion(prueba.app, a.administrador.pin);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    plataforma = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    const ids: string[] = [];
    for (const escenario of [a, b]) {
      const [resultado] = await prueba.pool.query<ResultSetHeader>(
        `INSERT INTO lecturas (tenant_id, puerta_id, dispositivo_id, token_hash, metodo, resultado, motivo_code)
         VALUES (?, ?, ?, ?, 'qr', 'rechazado', 'qr.desconocido')`,
        [
          escenario.cuenta.id,
          escenario.puertaPrincipal.id,
          escenario.dispositivoPrincipal.id,
          `hash-${escenario.puertaPrincipal.id}`,
        ],
      );
      ids.push(String(resultado.insertId));
    }
    [idDeA, idDeB] = ids as [string, string];
  });

  const pedir = (url: string, headers: { authorization: string }) =>
    prueba.app.inject({ method: 'GET', url: `/api/v1${url}`, headers });

  it.each([
    ['/lecturas', '/eventos-acceso'],
    ['/lecturas/resumen', '/eventos-acceso/resumen'],
  ])('%s responde igual que el alias %s', async (nueva, anterior) => {
    const deLaNueva = await pedir(nueva, conUsuario(admin));
    const delAlias = await pedir(anterior, conUsuario(admin));
    expect(deLaNueva.statusCode, deLaNueva.body).toBe(200);
    expect(delAlias.statusCode, delAlias.body).toBe(200);
    expect(deLaNueva.json()).toEqual(delAlias.json());
  });

  it('el detalle responde igual en ambos nombres, y la lectura de otra cuenta es 404 en los dos', async () => {
    for (const base of ['/lecturas', '/eventos-acceso']) {
      const propia = await pedir(`${base}/${idDeA}`, conUsuario(admin));
      expect(propia.statusCode, propia.body).toBe(200);
      expect(propia.json<{ id: string }>().id).toBe(idDeA);
      // Aislamiento (invariante 1): la cuenta A pidiendo una lectura de B no la ve.
      expect((await pedir(`${base}/${idDeB}`, conUsuario(admin))).statusCode).toBe(404);
    }
  });

  it('el listado de una cuenta no trae lecturas de otra, con ninguno de los dos nombres', async () => {
    for (const base of ['/lecturas', '/eventos-acceso']) {
      const cuerpo = (await pedir(base, conUsuario(admin))).json<{ datos: { id: string }[] }>();
      expect(cuerpo.datos.map((d) => d.id)).toEqual([idDeA]);
    }
  });

  it('la vista de plataforma responde igual en /plataforma/lecturas y en el alias', async () => {
    const nueva = await pedir('/plataforma/lecturas', plataforma);
    const alias = await pedir('/plataforma/eventos-acceso', plataforma);
    expect(nueva.statusCode, nueva.body).toBe(200);
    expect(nueva.json()).toEqual(alias.json());
    expect(nueva.json<{ meta: { total: number } }>().meta.total).toBe(2);
    // Un usuario de cuenta no entra a la vista de plataforma por ninguno de los nombres.
    expect((await pedir('/plataforma/lecturas', conUsuario(admin))).statusCode).toBe(401);
    expect((await pedir('/plataforma/eventos-acceso', conUsuario(admin))).statusCode).toBe(401);
  });

  it('el OpenAPI marca como obsoletas solo las rutas anteriores', async () => {
    const documento = (
      await prueba.app.inject({ method: 'GET', url: '/api/v1/openapi.json' })
    ).json<{ paths: Record<string, { get?: { deprecated?: boolean } }> }>();
    for (const ruta of ['/lecturas', '/lecturas/resumen', '/plataforma/lecturas']) {
      const operacion = documento.paths[`/api/v1${ruta}`]?.get;
      expect(operacion, ruta).toBeDefined();
      expect(operacion?.deprecated ?? false, ruta).toBe(false);
    }
    for (const ruta of [
      '/eventos-acceso',
      '/eventos-acceso/resumen',
      '/eventos-acceso/{id}',
      '/plataforma/eventos-acceso',
    ]) {
      expect(documento.paths[`/api/v1${ruta}`]?.get?.deprecated, ruta).toBe(true);
    }
    expect(documento.paths['/api/v1/lecturas/{id}']?.get?.deprecated ?? false).toBe(false);
  });
});
