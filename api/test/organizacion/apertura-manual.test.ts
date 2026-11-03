import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearCuenta,
  crearDispositivo,
  crearEscenario,
  crearPuerta,
  crearRol,
  crearUsuarioConPin,
  marcarEnLinea,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';

interface PuertaManual {
  id: string;
  nombre: string;
  sitio: { id: string; nombre: string };
  habilitada: boolean;
  disponible: boolean;
  tiene_placa: boolean;
  conexion: 'en_linea' | 'sin_conexion';
}

describe('apertura manual: configuración del administrador y lista de la app (ADR 0035 §5)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let admin: Sesion;
  let usuario: Sesion;

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
    await marcarEnLinea(prueba.pool, a.dispositivoPrincipal.id);
    admin = await iniciarSesion(prueba.app, a.administrador.pin);
    usuario = await iniciarSesion(prueba.app, a.usuario.pin);
  });

  const llamar = (sesion: Sesion, method: 'GET' | 'PUT' | 'POST', url: string, payload?: object) =>
    prueba.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: conUsuario(sesion),
      ...(payload === undefined ? {} : { payload }),
    });
  /** MariaDB entrega las columnas JSON como texto y mysql2 a veces ya las parsea: se acepta cualquiera. */
  const json = (valor: unknown): unknown =>
    typeof valor === 'string' ? (JSON.parse(valor) as unknown) : valor;
  const listar = async (sesion: Sesion): Promise<PuertaManual[]> => {
    const respuesta = await llamar(sesion, 'GET', '/puertas/apertura-manual');
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<{ datos: PuertaManual[] }>().datos;
  };
  async function aperturaDe(puertaId: string): Promise<number> {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT apertura_manual FROM puertas WHERE id = ?',
      [puertaId],
    );
    return Number(filas[0]?.apertura_manual);
  }
  async function porOmision(cuentaId: string): Promise<number> {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT apertura_manual_por_omision AS valor FROM cuentas WHERE id = ?',
      [cuentaId],
    );
    return Number(filas[0]?.valor);
  }

  describe('PUT /puertas/{id}/apertura-manual', () => {
    it('el administrador apaga y enciende una puerta (204) y queda en la bitácora con el antes y el después', async () => {
      const apaga = await llamar(admin, 'PUT', `/puertas/${a.puertaPrincipal.id}/apertura-manual`, {
        habilitada: false,
      });
      expect(apaga.statusCode).toBe(204);
      expect(await aperturaDe(a.puertaPrincipal.id)).toBe(0);
      // Solo cambió esa puerta.
      expect(await aperturaDe(a.puertaTrasera.id)).toBe(1);

      const [registros] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id, accion, antes, despues FROM bitacoras WHERE tabla = 'puertas' AND registro_id = ? AND accion = 'actualizado'",
        [a.puertaPrincipal.id],
      );
      expect(registros).toHaveLength(1);
      expect(registros[0]?.usuario_id).toBe(a.administrador.id);
      expect(json(registros[0]?.antes)).toEqual({ apertura_manual: 1 });
      expect(json(registros[0]?.despues)).toEqual({ apertura_manual: 0 });

      const enciende = await llamar(
        admin,
        'PUT',
        `/puertas/${a.puertaPrincipal.id}/apertura-manual`,
        { habilitada: true },
      );
      expect(enciende.statusCode).toBe(204);
      expect(await aperturaDe(a.puertaPrincipal.id)).toBe(1);
    });

    it('repetir el mismo valor no escribe ni llena la bitácora', async () => {
      await llamar(admin, 'PUT', `/puertas/${a.puertaPrincipal.id}/apertura-manual`, {
        habilitada: true,
      });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM bitacoras WHERE tabla = 'puertas' AND accion = 'actualizado'",
      );
      expect(Number(filas[0]?.n)).toBe(0);
    });

    it('sin el permiso de configurar (un Miembro) es 403 y no cambia nada', async () => {
      const respuesta = await llamar(
        usuario,
        'PUT',
        `/puertas/${a.puertaPrincipal.id}/apertura-manual`,
        { habilitada: false },
      );
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
      expect(await aperturaDe(a.puertaPrincipal.id)).toBe(1);
    });

    it('aislamiento: una puerta de otra cuenta es 404 puerta.no_encontrada y no se toca', async () => {
      const respuesta = await llamar(
        admin,
        'PUT',
        `/puertas/${b.puertaPrincipal.id}/apertura-manual`,
        { habilitada: false },
      );
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('puerta.no_encontrada');
      expect(await aperturaDe(b.puertaPrincipal.id)).toBe(1);
      expect(
        (await llamar(admin, 'PUT', '/puertas/999999/apertura-manual', { habilitada: false }))
          .statusCode,
      ).toBe(404);
    });

    it('rechaza un cuerpo inválido o con campos de más (en particular un sentido)', async () => {
      for (const cuerpo of [{}, { habilitada: 'si' }, { habilitada: true, sentido: 'entrada' }]) {
        const respuesta = await llamar(
          admin,
          'PUT',
          `/puertas/${a.puertaPrincipal.id}/apertura-manual`,
          cuerpo,
        );
        expect(respuesta.statusCode, JSON.stringify(cuerpo)).toBe(400);
      }
    });

    it('una puerta sin placa se puede escribir (la «Sin placa» sin interruptor es de la pantalla) y la lectura lo informa', async () => {
      const sinPlaca = await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Sin placa');
      const respuesta = await llamar(admin, 'PUT', `/puertas/${sinPlaca.id}/apertura-manual`, {
        habilitada: false,
      });
      expect(respuesta.statusCode).toBe(204);
      expect(await aperturaDe(sinPlaca.id)).toBe(0);
      const lista = await listar(admin);
      expect(lista.find((p) => p.id === sinPlaca.id)).toMatchObject({
        habilitada: false,
        tiene_placa: false,
        disponible: false,
      });
    });
  });

  describe('PUT /cuentas/actual/apertura-manual: el interruptor general', () => {
    it('apaga TODAS las puertas de la cuenta y el valor inicial, sin tocar otra cuenta', async () => {
      expect(await porOmision(a.cuenta.id)).toBe(1);
      const respuesta = await llamar(admin, 'PUT', '/cuentas/actual/apertura-manual', {
        habilitada: false,
      });
      expect(respuesta.statusCode).toBe(204);

      expect(await aperturaDe(a.puertaPrincipal.id)).toBe(0);
      expect(await aperturaDe(a.puertaTrasera.id)).toBe(0);
      expect(await porOmision(a.cuenta.id)).toBe(0);
      // La cuenta B no cambia.
      expect(await aperturaDe(b.puertaPrincipal.id)).toBe(1);
      expect(await porOmision(b.cuenta.id)).toBe(1);
    });

    it('una puerta creada después nace apagada; encendido otra vez, nace encendida (nada lo enciende solo)', async () => {
      await llamar(admin, 'PUT', '/cuentas/actual/apertura-manual', { habilitada: false });

      const nueva = await llamar(admin, 'POST', `/sitios/${a.sitioId}/puertas`, {
        nombre: 'Nueva apagada',
      });
      expect(nueva.statusCode, nueva.body).toBe(201);
      expect(await aperturaDe(nueva.json<{ id: string }>().id)).toBe(0);

      await llamar(admin, 'PUT', '/cuentas/actual/apertura-manual', { habilitada: true });
      expect(await aperturaDe(a.puertaPrincipal.id)).toBe(1);
      expect(await aperturaDe(nueva.json<{ id: string }>().id)).toBe(1);
      expect(await porOmision(a.cuenta.id)).toBe(1);
      const otra = await llamar(admin, 'POST', `/sitios/${a.sitioId}/puertas`, {
        nombre: 'Nueva encendida',
      });
      expect(await aperturaDe(otra.json<{ id: string }>().id)).toBe(1);
    });

    it('con el modo apagado a mano en una puerta, una puerta sin placa tampoco se enciende sola', async () => {
      await llamar(admin, 'PUT', '/cuentas/actual/apertura-manual', { habilitada: false });
      const sinPlaca = await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Sin placa');
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [sinPlaca.id]);
      await crearDispositivo(prueba.pool, a.cuenta, sinPlaca.id);
      // Aunque ahora tenga placa, sigue apagada: el administrador la apagó.
      const puerta = (await listar(admin)).find((p) => p.id === sinPlaca.id);
      expect(puerta).toMatchObject({ habilitada: false, tiene_placa: true, disponible: false });
    });

    it('queda en la bitácora: las puertas que cambiaron (solo esas) y la cuenta', async () => {
      await llamar(admin, 'PUT', `/puertas/${a.puertaTrasera.id}/apertura-manual`, {
        habilitada: false,
      });
      await llamar(admin, 'PUT', '/cuentas/actual/apertura-manual', { habilitada: false });
      const [puertas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT registro_id FROM bitacoras WHERE tabla = 'puertas' AND accion = 'actualizado' ORDER BY id",
      );
      // La trasera ya estaba apagada: el interruptor general solo escribió la principal.
      expect(puertas.map((fila) => String(fila.registro_id))).toEqual([
        a.puertaTrasera.id,
        a.puertaPrincipal.id,
      ]);
      const [cuentas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT despues FROM bitacoras WHERE tabla = 'cuentas' AND registro_id = ? AND accion = 'actualizado'",
        [a.cuenta.id],
      );
      expect(cuentas).toHaveLength(1);
      expect(json(cuentas[0]?.despues)).toEqual({ apertura_manual_por_omision: 0 });
    });

    it('sin el permiso de configurar es 403 y no cambia nada', async () => {
      const respuesta = await llamar(usuario, 'PUT', '/cuentas/actual/apertura-manual', {
        habilitada: false,
      });
      expect(respuesta.statusCode).toBe(403);
      expect(await aperturaDe(a.puertaPrincipal.id)).toBe(1);
      expect(await porOmision(a.cuenta.id)).toBe(1);
    });
  });

  describe('una cuenta nueva', () => {
    it('nace con la apertura manual por omisión encendida y sus puertas nacen encendidas', async () => {
      const nueva = await crearCuenta(prueba.pool, 'CCC');
      expect(await porOmision(nueva.id)).toBe(1);
      expect(await aperturaDe(a.puertaPrincipal.id)).toBe(1);
    });
  });

  describe('GET /puertas/apertura-manual', () => {
    it('el usuario ve solo las disponibles (encendidas y con placa); sin sentidos', async () => {
      // Principal: encendida y con placa. Trasera: apagada. Tercera: encendida pero sin placa.
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        a.puertaTrasera.id,
      ]);
      await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Sin placa');

      const respuesta = await llamar(usuario, 'GET', '/puertas/apertura-manual');
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toEqual({
        datos: [
          {
            id: a.puertaPrincipal.id,
            nombre: 'Principal AAA',
            sitio: { id: a.sitioId, nombre: 'Sitio AAA' },
            habilitada: true,
            disponible: true,
            tiene_placa: true,
            conexion: 'en_linea',
          },
        ],
      });
      expect(respuesta.body).not.toMatch(/sentido|entrada|salida/);
      expect(respuesta.headers['cache-control']).toContain('no-store');
    });

    it('el administrador ve TODAS las puertas, con tiene_placa, para mostrar «Sin placa»', async () => {
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        a.puertaTrasera.id,
      ]);
      const sinPlaca = await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Sin placa');

      const lista = await listar(admin);
      expect(
        lista.map((p) => [p.nombre, p.habilitada, p.disponible, p.tiene_placa, p.conexion]),
      ).toEqual([
        ['Principal AAA', true, true, true, 'en_linea'],
        ['Sin placa', true, false, false, 'sin_conexion'],
        // La trasera tiene placa (nunca latió) pero el administrador la apagó.
        ['Trasera AAA', false, false, true, 'sin_conexion'],
      ]);
      expect(lista.find((p) => p.nombre === 'Sin placa')?.id).toBe(sinPlaca.id);
    });

    it('una placa sin conexión sigue disponible (informa conexion para avisar; la autoridad es la API)', async () => {
      await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = NULL WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      const lista = await listar(usuario);
      expect(lista.find((p) => p.id === a.puertaPrincipal.id)).toMatchObject({
        disponible: true,
        conexion: 'sin_conexion',
      });
    });

    it('una placa revocada deja la puerta sin placa', async () => {
      await prueba.pool.query('UPDATE dispositivos SET revocado_at = NOW(3) WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      expect((await listar(usuario)).map((p) => p.id)).not.toContain(a.puertaPrincipal.id);
      expect((await listar(admin)).find((p) => p.id === a.puertaPrincipal.id)?.tiene_placa).toBe(
        false,
      );
    });

    it('una puerta con dos placas aparece una sola vez y en línea si una late', async () => {
      await prueba.pool.query("UPDATE dispositivos SET sentido = 'salida' WHERE id = ?", [
        a.dispositivoPrincipal.id,
      ]);
      await crearDispositivo(prueba.pool, a.cuenta, a.puertaPrincipal.id, { sentido: 'entrada' });
      const lista = (await listar(usuario)).filter((p) => p.id === a.puertaPrincipal.id);
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({ disponible: true, conexion: 'en_linea' });
    });

    it('una puerta o un sitio inactivos no se ofrecen', async () => {
      await prueba.pool.query('UPDATE puertas SET activo = 0 WHERE id = ?', [a.puertaTrasera.id]);
      expect((await listar(admin)).map((p) => p.nombre)).toEqual(['Principal AAA']);
    });

    it('aislamiento: ninguna cuenta ve las puertas de otra', async () => {
      await marcarEnLinea(prueba.pool, b.dispositivoPrincipal.id);
      const deA = (await listar(admin)).map((p) => p.id);
      expect(deA).not.toContain(b.puertaPrincipal.id);
      expect(deA).not.toContain(b.puertaTrasera.id);
      const deB = await listar(await iniciarSesion(prueba.app, b.administrador.pin));
      expect(deB.map((p) => p.id)).toEqual([b.puertaPrincipal.id, b.puertaTrasera.id]);
    });

    it('un Guardia también la ve (todos los roles de la cuenta pueden usarla)', async () => {
      const rolGuardia = await crearRol(prueba.pool, a.cuenta, 'Guardia', [
        'organizacion.puerta.ver',
        'accesos.apertura_manual.usar',
      ]);
      const guardia = await crearUsuarioConPin(prueba.pool, a.cuenta, 'GU01', [rolGuardia], {
        superiorId: a.administrador.id,
      });
      const lista = await listar(await iniciarSesion(prueba.app, guardia.pin));
      expect(lista.map((p) => p.id)).toEqual([a.puertaPrincipal.id, a.puertaTrasera.id]);
    });

    it('sin ningún permiso de apertura manual es 403; sin sesión, 401', async () => {
      const rolSin = await crearRol(prueba.pool, a.cuenta, 'Sin permiso', []);
      const sin = await crearUsuarioConPin(prueba.pool, a.cuenta, 'SP01', [rolSin], {
        superiorId: a.administrador.id,
      });
      expect(
        (await llamar(await iniciarSesion(prueba.app, sin.pin), 'GET', '/puertas/apertura-manual'))
          .statusCode,
      ).toBe(403);
      expect(
        (await prueba.app.inject({ method: 'GET', url: '/api/v1/puertas/apertura-manual' }))
          .statusCode,
      ).toBe(401);
    });
  });
});
