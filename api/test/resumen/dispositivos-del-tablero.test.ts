import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma } from '../helpers/http.js';

interface Tablero {
  dispositivos: {
    en_linea: number;
    sin_conexion: number;
    lista: { id: string; cuenta: { codigo: string }; en_linea: boolean }[];
  };
}

describe('plataforma: dispositivos del tablero (HU-09)', () => {
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

  const pedir = async () => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/resumen',
      headers,
    });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<Tablero>().dispositivos;
  };

  it('lista los dispositivos de todas las cuentas, con los que no reportan primero', async () => {
    await prueba.pool.query(
      'UPDATE dispositivos SET ultimo_latido_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [a.dispositivoPrincipal.id],
    );
    const dispositivos = await pedir();
    expect(dispositivos.lista).toHaveLength(4);
    expect(dispositivos.lista.map((d) => d.cuenta.codigo)).toEqual(
      expect.arrayContaining(['AAA', 'BBB']),
    );
    expect(dispositivos.en_linea).toBe(1);
    expect(dispositivos.sin_conexion).toBe(3);
    expect(dispositivos.lista[0]?.en_linea).toBe(false);
    expect(dispositivos.lista.at(-1)).toMatchObject({
      id: a.dispositivoPrincipal.id,
      en_linea: true,
    });
  });

  it('no cuenta los dispositivos que el cliente desactivó', async () => {
    await prueba.pool.query('UPDATE dispositivos SET activo = 0 WHERE id = ?', [
      b.dispositivoTrasero.id,
    ]);
    const dispositivos = await pedir();
    expect(dispositivos.lista).toHaveLength(3);
    expect(dispositivos.lista.map((d) => d.id)).not.toContain(b.dispositivoTrasero.id);
  });
});
