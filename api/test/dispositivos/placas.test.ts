import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearPuerta,
  crearSuperAdmin,
  type Escenario,
} from '../helpers/fixtures.js';
import { ejecutar as depurarPlacas } from '../../src/modules/dispositivos/actions/depurar-placas.js';
import { conUsuario, iniciarSesionDePlataforma, type Problema } from '../helpers/http.js';

const MAC = 'AA:BB:CC:00:11:22';
const CLAVE = 'a'.repeat(64);
const OTRA_CLAVE = 'b'.repeat(64);
const CLAVE_FALSA = 'c'.repeat(64);

describe('placas: anuncio, confirmación física y liberación (ADR 0026)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let acceso: string;

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
    const admin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    acceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', admin.contrasena)).acceso;
  });

  const plataforma = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    prueba.app.inject({
      method,
      url: `/api/v1/plataforma${url}`,
      headers: conUsuario({ acceso }),
      ...(payload === undefined ? {} : { payload }),
    });

  const anunciar = (clave = CLAVE, mac = MAC, app = prueba.app) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/anunciar',
      payload: { mac, clave, firmware: '1.0.0' },
    });
  const confirmar = (clave = CLAVE, mac = MAC) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/confirmar',
      payload: { mac, clave },
    });

  async function nuevaPuerta(escenario: Escenario, nombre: string): Promise<string> {
    return (await crearPuerta(prueba.pool, escenario.cuenta, escenario.sitioId, nombre)).id;
  }

  /** La placa se anuncia sola y el panel la ve como detectada. */
  async function placaDetectada(mac = MAC, clave = CLAVE): Promise<string> {
    expect((await anunciar(clave, mac)).json()).toEqual({ estado: 'detectada' });
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT id FROM placas WHERE mac = ? AND deleted_at IS NULL',
      [mac.toUpperCase().replaceAll('-', ':')],
    );
    return String(filas[0]?.id);
  }

  const pedirVinculo = (id: string, escenario: Escenario, puerta: string, nombre = 'Lector') =>
    plataforma('POST', `/placas/${id}/vincular`, {
      cuenta_id: escenario.cuenta.id,
      puerta_id: puerta,
      nombre,
    });

  describe('POST /dispositivos/anunciar', () => {
    it('una placa desconocida queda registrada como detectada, sin guardar su clave en claro', async () => {
      const id = await placaDetectada('aa-bb-cc-00-11-22');
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT mac, firmware_version, ultimo_anuncio_at FROM placas WHERE id = ?',
        [id],
      );
      expect(filas[0]).toMatchObject({ mac: MAC, firmware_version: '1.0.0' });
      expect(filas[0]?.ultimo_anuncio_at).toBeInstanceOf(Date);
      const [anuncios] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT clave_huella FROM placas_anuncios WHERE placa_id = ?',
        [id],
      );
      expect(anuncios).toHaveLength(1);
      expect(JSON.stringify(anuncios)).not.toContain(CLAVE);
    });

    it('anunciarse otra vez con la misma clave no duplica nada', async () => {
      await placaDetectada();
      await anunciar();
      expect(await contarFilas(prueba.pool, 'placas')).toBe(1);
      expect(await contarFilas(prueba.pool, 'placas_anuncios')).toBe(1);
    });

    it('no es una ruta de usuario: no necesita sesión ni credencial de dispositivo', async () => {
      expect((await anunciar()).statusCode).toBe(200);
    });

    it('valida el cuerpo y la MAC', async () => {
      for (const payload of [{}, { mac: MAC, clave: 'corta', firmware: '1' }]) {
        const respuesta = await prueba.app.inject({
          method: 'POST',
          url: '/api/v1/dispositivos/anunciar',
          payload,
        });
        expect(respuesta.statusCode).toBe(400);
      }
      expect((await anunciar(CLAVE, 'ZZ:ZZ:ZZ:ZZ:ZZ:ZZ')).statusCode).toBe(422);
    });

    it('guarda a lo sumo cinco candidatos por MAC', async () => {
      const id = await placaDetectada();
      for (const letra of ['d', 'e', 'f', 'g']) {
        expect((await anunciar(letra.repeat(64))).statusCode).toBe(200);
      }
      const sexto = await anunciar('h'.repeat(64));
      expect(sexto.statusCode).toBe(429);
      expect(
        await contarFilas(
          prueba.pool,
          'placas_anuncios',
          'placa_id = ? AND descartada_at IS NULL',
          [id],
        ),
      ).toBe(5);
    });

    it('limita las placas nuevas que crea una misma IP', async () => {
      // App propia: el límite vive en memoria y no debe bloquear a los demás tests.
      const aislada = await crearAppDePrueba();
      try {
        for (let i = 0; i < 30; i += 1) {
          const mac = `AA:BB:CC:00:${i.toString(16).padStart(2, '0').toUpperCase()}:01`;
          expect((await anunciar(CLAVE, mac, aislada.app)).statusCode).toBe(200);
        }
        const bloqueada = await anunciar(CLAVE, 'AA:BB:CC:FF:FF:FF', aislada.app);
        expect(bloqueada.statusCode).toBe(429);
        expect(bloqueada.json<Problema>().code).toBe('dispositivo.anuncio_bloqueado');
      } finally {
        await aislada.cerrar();
      }
    });
  });

  describe('vincular y confirmar con el botón', () => {
    it('vincular solo abre la ventana: no crea el dispositivo y la placa pasa a confirmar', async () => {
      const id = await placaDetectada();
      const puerta = await nuevaPuerta(a, 'Garaje');
      const respuesta = await pedirVinculo(id, a, puerta);
      expect(respuesta.statusCode, respuesta.body).toBe(202);
      expect(await contarFilas(prueba.pool, 'dispositivos', 'placa_id IS NOT NULL')).toBe(0);
      expect((await anunciar()).json()).toEqual({ estado: 'confirmar' });
      const lista = await plataforma('GET', '/placas');
      expect(lista.json<{ datos: { estado: string }[] }>().datos[0]?.estado).toBe('por_confirmar');
    });

    it('al pulsar el botón se crea el dispositivo de la cuenta y la puerta, y se autentica con su clave', async () => {
      const id = await placaDetectada();
      const puerta = await nuevaPuerta(a, 'Garaje');
      await pedirVinculo(id, a, puerta, 'Lector garaje');

      const respuesta = await confirmar();
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      const { dispositivo_id } = respuesta.json<{ dispositivo_id: string }>();

      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT tenant_id, puerta_id, placa_id, nombre, clave_hash, created_by FROM dispositivos WHERE id = ?',
        [dispositivo_id],
      );
      expect(filas[0]).toMatchObject({
        tenant_id: a.cuenta.id,
        puerta_id: puerta,
        placa_id: id,
        nombre: 'Lector garaje',
      });
      expect(String(filas[0]?.clave_hash)).toMatch(/^\$argon2id\$/);
      expect(filas[0]?.created_by).not.toBeNull();

      // La solicitud se consumió y los anuncios quedaron descartados.
      const [placa] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT por_confirmar_hasta, vinculo_cuenta_id FROM placas WHERE id = ?',
        [id],
      );
      expect(placa[0]).toMatchObject({ por_confirmar_hasta: null, vinculo_cuenta_id: null });
      expect(await contarFilas(prueba.pool, 'placas_anuncios', 'descartada_at IS NULL')).toBe(0);

      // La placa lo sabe en su siguiente anuncio, y es idempotente (también confirmar).
      for (let i = 0; i < 2; i += 1) {
        expect((await anunciar()).json()).toEqual({ estado: 'vinculado', dispositivo_id });
      }
      expect((await confirmar()).json()).toEqual({ estado: 'vinculado', dispositivo_id });

      const configuracion = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/dispositivos/configuracion',
        headers: { authorization: `Dispositivo ${dispositivo_id}.${CLAVE}` },
      });
      expect(configuracion.statusCode).toBe(200);
    });

    it('un anuncio falso de la misma MAC no confirma ni se queda con el vínculo', async () => {
      const id = await placaDetectada();
      // El atacante conoce la MAC y se anuncia primero con su propia clave.
      await anunciar(CLAVE_FALSA);
      await pedirVinculo(id, a, await nuevaPuerta(a, 'Garaje'));

      // El botón lo pulsó la placa real: confirma la clave real.
      const respuesta = await confirmar(CLAVE);
      expect(respuesta.statusCode).toBe(200);
      const { dispositivo_id } = respuesta.json<{ dispositivo_id: string }>();

      const como = (clave: string) =>
        prueba.app.inject({
          method: 'GET',
          url: '/api/v1/dispositivos/configuracion',
          headers: { authorization: `Dispositivo ${dispositivo_id}.${clave}` },
        });
      expect((await como(CLAVE)).statusCode).toBe(200);
      expect((await como(CLAVE_FALSA)).statusCode).toBe(401);
      // El falso queda descartado y ya no sirve ni para anunciarse ni para confirmar.
      expect((await anunciar(CLAVE_FALSA)).statusCode).toBe(401);
      expect((await confirmar(CLAVE_FALSA)).statusCode).toBe(401);
    });

    it('quien no tiene un candidato anunciado no puede confirmar', async () => {
      const id = await placaDetectada();
      await pedirVinculo(id, a, await nuevaPuerta(a, 'Garaje'));
      const respuesta = await confirmar(CLAVE_FALSA);
      expect(respuesta.statusCode).toBe(401);
      expect(respuesta.json<Problema>().code).toBe('dispositivo.anuncio_invalido');
      expect(await contarFilas(prueba.pool, 'dispositivos', 'placa_id IS NOT NULL')).toBe(0);
    });

    it('sin solicitud de vínculo, el botón no hace nada', async () => {
      await placaDetectada();
      const respuesta = await confirmar();
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('placa.sin_solicitud');
    });

    it('con la ventana vencida no se vincula y la placa vuelve a detectada', async () => {
      const id = await placaDetectada();
      await pedirVinculo(id, a, await nuevaPuerta(a, 'Garaje'));
      await prueba.pool.query(
        'UPDATE placas SET por_confirmar_hasta = DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE id = ?',
        [id],
      );
      expect((await anunciar()).json()).toEqual({ estado: 'detectada' });
      expect((await confirmar()).statusCode).toBe(409);
      expect(await contarFilas(prueba.pool, 'dispositivos', 'placa_id IS NOT NULL')).toBe(0);
    });

    it('cancelar el vínculo retira la solicitud', async () => {
      const id = await placaDetectada();
      await pedirVinculo(id, a, await nuevaPuerta(a, 'Garaje'));
      expect((await plataforma('POST', `/placas/${id}/cancelar-vinculo`)).statusCode).toBe(204);
      expect((await anunciar()).json()).toEqual({ estado: 'detectada' });
      expect((await confirmar()).statusCode).toBe(409);
      const otra = await plataforma('POST', `/placas/${id}/cancelar-vinculo`);
      expect(otra.json<Problema>().code).toBe('placa.sin_solicitud');
    });

    it('una puerta de otra cuenta es 404 (aislamiento) y no abre ventana', async () => {
      const id = await placaDetectada();
      const respuesta = await pedirVinculo(id, a, b.puertaPrincipal.id);
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('puerta.no_encontrada');
      expect((await anunciar()).json()).toEqual({ estado: 'detectada' });
    });

    it('una puerta que ya tiene lector es 409', async () => {
      const id = await placaDetectada();
      const respuesta = await pedirVinculo(id, a, a.puertaPrincipal.id);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('puerta.con_dispositivo');
    });

    it('una cuenta inexistente es 404', async () => {
      const id = await placaDetectada();
      const respuesta = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: '99999',
        puerta_id: a.puertaPrincipal.id,
        nombre: 'Lector',
      });
      expect(respuesta.statusCode).toBe(404);
    });

    it('respeta el cupo del plan al pedir y otra vez al confirmar', async () => {
      const id = await placaDetectada();
      const puerta = await nuevaPuerta(a, 'Garaje');
      expect((await pedirVinculo(id, a, puerta)).statusCode).toBe(202);
      // Entre el pedido y el botón el plan se llena.
      await prueba.pool.query('UPDATE planes SET max_dispositivos = 1');
      const confirmacion = await confirmar();
      expect(confirmacion.statusCode).toBe(422);
      expect(confirmacion.json<Problema>().code).toBe('plan.limite_dispositivos');
      expect(await contarFilas(prueba.pool, 'dispositivos', 'placa_id IS NOT NULL')).toBe(0);

      const otra = await placaDetectada('AA:BB:CC:00:11:33');
      const sinCupo = await pedirVinculo(otra, a, await nuevaPuerta(a, 'Bodega'));
      expect(sinCupo.statusCode).toBe(422);
    });

    it('una placa ya vinculada no se vincula dos veces', async () => {
      const id = await placaDetectada();
      await pedirVinculo(id, a, await nuevaPuerta(a, 'P1'));
      await confirmar();
      const segunda = await pedirVinculo(id, a, await nuevaPuerta(a, 'P2'));
      expect(segunda.statusCode).toBe(409);
      expect(segunda.json<Problema>().code).toBe('placa.ya_vinculada');
    });

    it('con una clave distinta, una placa vinculada no recibe nada', async () => {
      const id = await placaDetectada();
      await pedirVinculo(id, a, await nuevaPuerta(a, 'Garaje'));
      await confirmar();
      for (const respuesta of [await anunciar(OTRA_CLAVE), await confirmar(OTRA_CLAVE)]) {
        expect(respuesta.statusCode).toBe(401);
        expect(respuesta.json<Problema>().code).toBe('dispositivo.anuncio_invalido');
      }
    });

    it('bloquea tras demasiados fallos, aun con la clave correcta', async () => {
      const aislada = await crearAppDePrueba();
      try {
        const id = await placaDetectada();
        await pedirVinculo(id, a, await nuevaPuerta(a, 'Garaje'));
        await confirmar();
        for (let i = 0; i < 10; i += 1) await anunciar(OTRA_CLAVE, MAC, aislada.app);
        const bloqueado = await anunciar(CLAVE, MAC, aislada.app);
        expect(bloqueado.statusCode).toBe(429);
        expect(bloqueado.json<Problema>().code).toBe('dispositivo.anuncio_bloqueado');
      } finally {
        await aislada.cerrar();
      }
    });
  });

  describe('liberar y reasignar', () => {
    it('el dispositivo anterior deja de autenticar y la placa pasa a otra cuenta tras otra confirmación física', async () => {
      const id = await placaDetectada();
      await pedirVinculo(id, a, await nuevaPuerta(a, 'Garaje'), 'Lector A');
      const anterior = (await confirmar()).json<{ dispositivo_id: string }>().dispositivo_id;

      expect((await plataforma('POST', `/placas/${id}/liberar`)).statusCode).toBe(204);

      const configuracion = (dispositivo: string, clave: string) =>
        prueba.app.inject({
          method: 'GET',
          url: '/api/v1/dispositivos/configuracion',
          headers: { authorization: `Dispositivo ${dispositivo}.${clave}` },
        });
      expect((await configuracion(anterior, CLAVE)).statusCode).toBe(401);
      // La placa, con 401, borra su vínculo y vuelve a anunciarse con una clave nueva.
      expect((await anunciar(OTRA_CLAVE)).json()).toEqual({ estado: 'detectada' });

      await pedirVinculo(id, b, await nuevaPuerta(b, 'Bodega'), 'Lector B');
      const nuevo = (await confirmar(OTRA_CLAVE)).json<{ dispositivo_id: string }>().dispositivo_id;
      expect(nuevo).not.toBe(anterior);
      expect((await configuracion(nuevo, OTRA_CLAVE)).statusCode).toBe(200);
      expect((await configuracion(nuevo, CLAVE)).statusCode).toBe(401);

      // El historial de la cuenta A conserva su dispositivo, revocado.
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT tenant_id, revocado_at FROM dispositivos WHERE id = ?',
        [anterior],
      );
      expect(filas[0]?.tenant_id).toBe(a.cuenta.id);
      expect(filas[0]?.revocado_at).toBeInstanceOf(Date);
    });

    it('liberar una placa sin dispositivo es 409', async () => {
      const id = await placaDetectada();
      const respuesta = await plataforma('POST', `/placas/${id}/liberar`);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('placa.sin_dispositivo');
    });

    it('queda en la bitácora de la cuenta, sin claves', async () => {
      const id = await placaDetectada();
      await pedirVinculo(id, a, await nuevaPuerta(a, 'Garaje'), 'Lector A');
      await confirmar();
      await plataforma('POST', `/placas/${id}/liberar`);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT tenant_id, accion, antes, despues FROM bitacoras WHERE tabla = 'dispositivos' ORDER BY id",
      );
      expect(
        filas.map((fila): [string, string] => [String(fila.tenant_id), String(fila.accion)]),
      ).toEqual([
        [a.cuenta.id, 'creado'],
        [a.cuenta.id, 'actualizado'],
      ]);
      const [todas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT antes, despues FROM bitacoras',
      );
      const todo = JSON.stringify([filas, todas]);
      expect(todo).not.toContain(CLAVE);
      expect(todo).not.toContain('argon2id');
    });
  });

  describe('inventario y baja', () => {
    it('lista el estado, la cuenta y la puerta de cada placa', async () => {
      const una = await placaDetectada();
      await placaDetectada('AA:BB:CC:00:11:33');
      await pedirVinculo(una, a, await nuevaPuerta(a, 'Garaje'));
      await confirmar();

      const respuesta = await plataforma('GET', '/placas');
      expect(respuesta.statusCode).toBe(200);
      const { datos, meta } = respuesta.json<{
        datos: {
          mac: string;
          estado: string;
          cuenta: { codigo: string } | null;
          puerta: { nombre: string } | null;
        }[];
        meta: { total: number };
      }>();
      expect(meta.total).toBe(2);
      expect(datos.find((placa) => placa.mac === MAC)).toMatchObject({
        estado: 'vinculada',
        cuenta: { codigo: 'AAA' },
        puerta: { nombre: 'Garaje' },
      });
      expect(datos.find((placa) => placa.mac !== MAC)).toMatchObject({
        estado: 'detectada',
        cuenta: null,
      });

      const soloDetectadas = await plataforma('GET', '/placas?estado=detectada');
      expect(soloDetectadas.json<{ meta: { total: number } }>().meta.total).toBe(1);
      expect(JSON.stringify(respuesta.json())).not.toMatch(/argon2|hash|huella/);
    });

    it('da de baja una placa libre y no una vinculada; una baja reaparece al anunciarse', async () => {
      const libre = await placaDetectada();
      expect((await plataforma('DELETE', `/placas/${libre}`)).statusCode).toBe(204);
      expect(
        (await plataforma('GET', '/placas')).json<{ meta: { total: number } }>().meta.total,
      ).toBe(0);
      // Una placa real que sigue enchufada vuelve a aparecer sola.
      const otra = await placaDetectada(MAC, OTRA_CLAVE);
      expect(otra).not.toBe(libre);

      await pedirVinculo(otra, a, await nuevaPuerta(a, 'Garaje'));
      await confirmar(OTRA_CLAVE);
      expect((await plataforma('DELETE', `/placas/${otra}`)).statusCode).toBe(409);
    });

    it('la limpieza da de baja las placas libres sin contacto y respeta las vinculadas', async () => {
      const vieja = await placaDetectada('AA:BB:CC:00:11:33');
      const vinculada = await placaDetectada();
      await pedirVinculo(vinculada, a, await nuevaPuerta(a, 'Garaje'));
      await confirmar();
      await prueba.pool.query(
        'UPDATE placas SET ultimo_anuncio_at = DATE_SUB(NOW(3), INTERVAL 8 DAY)',
      );
      expect(await depurarPlacas(prueba.pool)).toBe(1);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT id, deleted_at FROM placas ORDER BY id',
      );
      expect(filas.find((fila) => String(fila.id) === vieja)?.deleted_at).toBeInstanceOf(Date);
      expect(filas.find((fila) => String(fila.id) === vinculada)?.deleted_at).toBeNull();
    });

    it('un usuario de una cuenta no ve ni toca las placas', async () => {
      const id = await placaDetectada();
      const sesion = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones',
        payload: { pin: a.administrador.pin },
      });
      const token = sesion.json<{ acceso: string }>().acceso;
      for (const [method, url] of [
        ['GET', '/api/v1/plataforma/placas'],
        ['POST', `/api/v1/plataforma/placas/${id}/liberar`],
        ['POST', `/api/v1/plataforma/placas/${id}/vincular`],
        ['POST', `/api/v1/plataforma/placas/${id}/cancelar-vinculo`],
      ] as const) {
        const respuesta = await prueba.app.inject({
          method,
          url,
          headers: conUsuario({ acceso: token }),
        });
        expect([400, 401, 403]).toContain(respuesta.statusCode);
      }
    });
  });
});
