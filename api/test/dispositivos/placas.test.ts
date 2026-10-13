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
import { conUsuario, iniciarSesionDePlataforma, type Problema } from '../helpers/http.js';

const MAC = 'AA:BB:CC:00:11:22';
const CLAVE = 'a'.repeat(64);
const OTRA_CLAVE = 'b'.repeat(64);

describe('placas: reclamo, vinculación y liberación (ADR 0025)', () => {
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

  const reclamar = (payload: object) =>
    prueba.app.inject({ method: 'POST', url: '/api/v1/dispositivos/reclamar', payload });

  async function darDeAlta(mac = MAC): Promise<{ id: string; codigo: string }> {
    const respuesta = await plataforma('POST', '/placas', { mac });
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    return respuesta.json<{ id: string; codigo: string }>();
  }

  const cuerpoDeReclamo = (codigo: string, clave = CLAVE, mac = MAC) => ({
    mac,
    codigo,
    clave,
    firmware: '1.0.0',
  });

  async function nuevaPuerta(escenario: Escenario, nombre: string): Promise<string> {
    return (await crearPuerta(prueba.pool, escenario.cuenta, escenario.sitioId, nombre)).id;
  }

  describe('alta', () => {
    it('entrega el código una sola vez y en la base solo queda su hash', async () => {
      const { id, codigo } = await darDeAlta('aa-bb-cc-00-11-22');
      expect(codigo).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT mac, codigo_hash FROM placas WHERE id = ?',
        [id],
      );
      expect(filas[0]?.mac).toBe(MAC);
      expect(String(filas[0]?.codigo_hash)).toMatch(/^\$argon2id\$/);
      expect(String(filas[0]?.codigo_hash)).not.toContain(codigo);
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT despues FROM bitacoras WHERE tabla = 'placas'",
      );
      expect(JSON.stringify(bitacora)).not.toContain(codigo);
      expect(JSON.stringify(bitacora)).not.toContain('argon2id');
    });

    it('rechaza una MAC inválida o repetida', async () => {
      expect((await plataforma('POST', '/placas', { mac: 'ZZ:ZZ:ZZ:ZZ:ZZ:ZZ' })).statusCode).toBe(
        422,
      );
      await darDeAlta();
      const repetida = await plataforma('POST', '/placas', { mac: MAC });
      expect(repetida.statusCode).toBe(409);
      expect(repetida.json<Problema>().code).toBe('placa.mac_existente');
    });

    it('exige permiso de plataforma: sin sesión, 401', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/plataforma/placas',
        payload: { mac: MAC },
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('POST /dispositivos/reclamar', () => {
    it('con el código correcto guarda el hash de la clave y responde pendiente', async () => {
      const { id, codigo } = await darDeAlta();
      const respuesta = await reclamar(cuerpoDeReclamo(codigo));
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toEqual({ estado: 'pendiente' });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT clave_hash, firmware_version, ultimo_reclamo_at FROM placas WHERE id = ?',
        [id],
      );
      expect(String(filas[0]?.clave_hash)).toMatch(/^\$argon2id\$/);
      expect(filas[0]?.clave_hash).not.toContain(CLAVE);
      expect(filas[0]?.firmware_version).toBe('1.0.0');
      expect(filas[0]?.ultimo_reclamo_at).toBeInstanceOf(Date);
    });

    it('código incorrecto, MAC desconocida o código de otra placa: el mismo 401', async () => {
      const una = await darDeAlta();
      const otra = await darDeAlta('AA:BB:CC:00:11:33');
      const casos = [
        cuerpoDeReclamo('0'.repeat(16)),
        cuerpoDeReclamo(una.codigo, CLAVE, 'AA:BB:CC:99:99:99'),
        cuerpoDeReclamo(otra.codigo),
      ];
      const cuerpos = new Set<string>();
      for (const caso of casos) {
        const respuesta = await reclamar(caso);
        expect(respuesta.statusCode).toBe(401);
        expect(respuesta.json<Problema>().code).toBe('dispositivo.reclamo_invalido');
        cuerpos.add(respuesta.body);
      }
      expect(cuerpos.size).toBe(1);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT clave_hash FROM placas WHERE clave_hash IS NOT NULL',
      );
      expect(filas).toHaveLength(0);
    });

    it('acepta el código con espacios, guiones y minúsculas como lo teclea una persona', async () => {
      const { codigo } = await darDeAlta();
      const tecleado = `${codigo.slice(0, 4)}-${codigo.slice(4, 8)} ${codigo.slice(8).toLowerCase()}`;
      expect((await reclamar(cuerpoDeReclamo(tecleado))).statusCode).toBe(200);
    });

    it('bloquea tras demasiados fallos, aun con el código correcto', async () => {
      // App propia: el límite vive en memoria y no debe bloquear a los demás tests.
      const aislada = await crearAppDePrueba();
      try {
        const { codigo } = await darDeAlta();
        const enviar = (payload: object) =>
          aislada.app.inject({ method: 'POST', url: '/api/v1/dispositivos/reclamar', payload });
        for (let i = 0; i < 10; i += 1) await enviar(cuerpoDeReclamo('0'.repeat(16)));
        const bloqueado = await enviar(cuerpoDeReclamo(codigo));
        expect(bloqueado.statusCode).toBe(429);
        expect(bloqueado.json<Problema>().code).toBe('dispositivo.reclamo_bloqueado');
      } finally {
        await aislada.cerrar();
      }
    });

    it('valida el cuerpo', async () => {
      for (const payload of [{}, { ...cuerpoDeReclamo('X'.repeat(16)), clave: 'corta' }]) {
        expect((await reclamar(payload)).statusCode).toBe(400);
      }
    });

    it('no es una ruta de usuario: no necesita sesión ni credencial de dispositivo', async () => {
      const { codigo } = await darDeAlta();
      expect((await reclamar(cuerpoDeReclamo(codigo))).statusCode).toBe(200);
    });
  });

  describe('vincular', () => {
    async function placaReclamada(mac = MAC): Promise<string> {
      const { id, codigo } = await darDeAlta(mac);
      expect((await reclamar(cuerpoDeReclamo(codigo, CLAVE, mac))).statusCode).toBe(200);
      return id;
    }

    it('crea el dispositivo de la cuenta y la puerta, la placa pasa a vinculada y se autentica con su clave', async () => {
      const { id, codigo } = await darDeAlta();
      await reclamar(cuerpoDeReclamo(codigo));
      const puertaId = await nuevaPuerta(a, 'Garaje');

      const respuesta = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: puertaId,
        nombre: 'Lector garaje',
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const { dispositivo_id } = respuesta.json<{ dispositivo_id: string }>();

      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT tenant_id, puerta_id, placa_id, nombre, created_by FROM dispositivos WHERE id = ?',
        [dispositivo_id],
      );
      expect(filas[0]).toMatchObject({
        tenant_id: a.cuenta.id,
        puerta_id: puertaId,
        placa_id: id,
        nombre: 'Lector garaje',
      });
      expect(filas[0]?.created_by).not.toBeNull();

      // La placa lo sabe en su siguiente sondeo, y es idempotente.
      for (let i = 0; i < 2; i += 1) {
        const sondeo = await reclamar(cuerpoDeReclamo(codigo));
        expect(sondeo.json()).toEqual({ estado: 'vinculado', dispositivo_id });
      }
      // Y desde ahora opera con su credencial, como cualquier dispositivo.
      const configuracion = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/dispositivos/configuracion',
        headers: { authorization: `Dispositivo ${dispositivo_id}.${CLAVE}` },
      });
      expect(configuracion.statusCode).toBe(200);
    });

    it('con una clave distinta, una placa vinculada no recibe nada', async () => {
      const { id, codigo } = await darDeAlta();
      await reclamar(cuerpoDeReclamo(codigo));
      await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: await nuevaPuerta(a, 'Garaje'),
        nombre: 'Lector',
      });
      const copia = await reclamar(cuerpoDeReclamo(codigo, OTRA_CLAVE));
      expect(copia.statusCode).toBe(401);
      expect(copia.json<Problema>().code).toBe('dispositivo.reclamo_invalido');
    });

    it('exige que la placa haya reclamado antes', async () => {
      const { id } = await darDeAlta();
      const respuesta = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: await nuevaPuerta(a, 'Garaje'),
        nombre: 'Lector',
      });
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('placa.sin_reclamo');
      expect(await contarFilas(prueba.pool, 'dispositivos', 'placa_id IS NOT NULL')).toBe(0);
    });

    it('una puerta de otra cuenta es 404 (aislamiento) y no crea nada', async () => {
      const id = await placaReclamada();
      const respuesta = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: b.puertaPrincipal.id,
        nombre: 'Lector',
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('puerta.no_encontrada');
      expect(await contarFilas(prueba.pool, 'dispositivos', 'placa_id IS NOT NULL')).toBe(0);
    });

    it('una puerta que ya tiene lector es 409', async () => {
      const id = await placaReclamada();
      const respuesta = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: a.puertaPrincipal.id,
        nombre: 'Otro lector',
      });
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('puerta.con_dispositivo');
    });

    it('una placa ya vinculada no se vincula dos veces', async () => {
      const id = await placaReclamada();
      const cuerpo = (puerta: string) => ({
        cuenta_id: a.cuenta.id,
        puerta_id: puerta,
        nombre: 'Lector',
      });
      expect(
        (await plataforma('POST', `/placas/${id}/vincular`, cuerpo(await nuevaPuerta(a, 'P1'))))
          .statusCode,
      ).toBe(201);
      const segunda = await plataforma(
        'POST',
        `/placas/${id}/vincular`,
        cuerpo(await nuevaPuerta(a, 'P2')),
      );
      expect(segunda.statusCode).toBe(409);
      expect(segunda.json<Problema>().code).toBe('placa.ya_vinculada');
    });

    it('respeta el cupo de dispositivos del plan', async () => {
      await prueba.pool.query('UPDATE planes SET max_dispositivos = 2');
      const id = await placaReclamada();
      const respuesta = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: await nuevaPuerta(a, 'Garaje'),
        nombre: 'Lector',
      });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('plan.limite_dispositivos');
    });

    it('una cuenta inexistente es 404', async () => {
      const id = await placaReclamada();
      const respuesta = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: '99999',
        puerta_id: a.puertaPrincipal.id,
        nombre: 'Lector',
      });
      expect(respuesta.statusCode).toBe(404);
    });
  });

  describe('liberar y reasignar', () => {
    it('el dispositivo anterior deja de autenticar y la placa pasa a otra cuenta sin dejar rastro en la primera', async () => {
      const { id, codigo } = await darDeAlta();
      await reclamar(cuerpoDeReclamo(codigo));
      const vinculo = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: await nuevaPuerta(a, 'Garaje'),
        nombre: 'Lector A',
      });
      const anterior = vinculo.json<{ dispositivo_id: string }>().dispositivo_id;

      const liberada = await plataforma('POST', `/placas/${id}/liberar`);
      expect(liberada.statusCode).toBe(204);

      const configuracion = (dispositivo: string, clave: string) =>
        prueba.app.inject({
          method: 'GET',
          url: '/api/v1/dispositivos/configuracion',
          headers: { authorization: `Dispositivo ${dispositivo}.${clave}` },
        });
      expect((await configuracion(anterior, CLAVE)).statusCode).toBe(401);
      // La placa, con 401, borra su vínculo y vuelve a reclamar con una clave nueva.
      const sondeo = await reclamar(cuerpoDeReclamo(codigo, OTRA_CLAVE));
      expect(sondeo.json()).toEqual({ estado: 'pendiente' });

      const nueva = await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: b.cuenta.id,
        puerta_id: await nuevaPuerta(b, 'Bodega'),
        nombre: 'Lector B',
      });
      expect(nueva.statusCode, nueva.body).toBe(201);
      const nuevo = nueva.json<{ dispositivo_id: string }>().dispositivo_id;
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
      const { id } = await darDeAlta();
      const respuesta = await plataforma('POST', `/placas/${id}/liberar`);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('placa.sin_dispositivo');
    });

    it('queda en la bitácora de la cuenta, sin claves', async () => {
      const { id, codigo } = await darDeAlta();
      await reclamar(cuerpoDeReclamo(codigo));
      await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: await nuevaPuerta(a, 'Garaje'),
        nombre: 'Lector A',
      });
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
      const todo = JSON.stringify(filas);
      expect(todo).not.toContain(CLAVE);
      expect(todo).not.toContain('argon2id');
    });
  });

  describe('inventario y baja', () => {
    it('lista el estado, la cuenta y la puerta de cada placa', async () => {
      const una = await darDeAlta();
      await darDeAlta('AA:BB:CC:00:11:33');
      await reclamar(cuerpoDeReclamo(una.codigo));
      await plataforma('POST', `/placas/${una.id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: await nuevaPuerta(a, 'Garaje'),
        nombre: 'Lector',
      });

      const respuesta = await plataforma('GET', '/placas');
      expect(respuesta.statusCode).toBe(200);
      const { datos, meta } = respuesta.json<{
        datos: {
          mac: string;
          estado: string;
          reclamo_hecho: boolean;
          cuenta: { codigo: string } | null;
          puerta: { nombre: string } | null;
        }[];
        meta: { total: number };
      }>();
      expect(meta.total).toBe(2);
      const vinculada = datos.find((placa) => placa.mac === MAC);
      expect(vinculada).toMatchObject({
        estado: 'vinculada',
        cuenta: { codigo: 'AAA' },
        puerta: { nombre: 'Garaje' },
      });
      expect(datos.find((placa) => placa.mac !== MAC)).toMatchObject({
        estado: 'de_fabrica',
        reclamo_hecho: false,
        cuenta: null,
      });

      const soloLibres = await plataforma('GET', '/placas?estado=de_fabrica');
      expect(soloLibres.json<{ meta: { total: number } }>().meta.total).toBe(1);
      expect(JSON.stringify(respuesta.json())).not.toMatch(/argon2|hash/);
    });

    it('da de baja una placa libre y no una vinculada', async () => {
      const libre = await darDeAlta();
      expect((await plataforma('DELETE', `/placas/${libre.id}`)).statusCode).toBe(204);
      // La MAC se puede registrar de nuevo tras la baja.
      expect((await plataforma('POST', '/placas', { mac: MAC })).statusCode).toBe(201);

      const { id, codigo } = await darDeAlta('AA:BB:CC:00:11:33');
      await reclamar(cuerpoDeReclamo(codigo, CLAVE, 'AA:BB:CC:00:11:33'));
      await plataforma('POST', `/placas/${id}/vincular`, {
        cuenta_id: a.cuenta.id,
        puerta_id: await nuevaPuerta(a, 'Garaje'),
        nombre: 'Lector',
      });
      expect((await plataforma('DELETE', `/placas/${id}`)).statusCode).toBe(409);
    });

    it('un usuario de una cuenta no ve ni toca las placas', async () => {
      const { id } = await darDeAlta();
      const sesion = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/sesiones',
        payload: { pin: a.administrador.pin },
      });
      const token = sesion.json<{ acceso: string }>().acceso;
      for (const [method, url] of [
        ['GET', '/api/v1/plataforma/placas'],
        ['POST', `/api/v1/plataforma/placas/${id}/liberar`],
      ] as const) {
        const respuesta = await prueba.app.inject({
          method,
          url,
          headers: conUsuario({ acceso: token }),
        });
        expect([401, 403]).toContain(respuesta.statusCode);
      }
    });
  });
});
