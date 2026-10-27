import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as evaluar } from '../../src/modules/dispositivos/actions/evaluar-estado-de-placas.js';
import { ejecutar as entregar } from '../../src/modules/notificaciones/actions/entregar-pendientes.js';
import { ejecutar as depurar } from '../../src/modules/notificaciones/actions/depurar-notificaciones.js';
import { crearTareas } from '../../src/tareas.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearRol,
  crearSuperAdmin,
  crearUsuarioConPin,
  PERMISOS_DE_GUARDIA,
  type Escenario,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

interface Notificacion {
  id: string;
  tipo: string;
  severidad: string;
  cuenta_id: string;
  cantidad: number;
  resuelta: boolean;
  leida: boolean;
  datos: {
    cuenta: { id: string };
    sitio: { id: string; nombre: string } | null;
    placas: { dispositivo_id: string; puerta_nombre: string; desde: string | null }[];
  };
}
interface Listado {
  datos: Notificacion[];
  meta: { total: number };
}

/** Lo que responde la API a un token de cuenta en una ruta de plataforma, y al revés (exactos, no «>= 401»). */
const CODIGO_DE_CUENTA_EN_PLATAFORMA = 401;
const CODIGO_DE_PLATAFORMA_EN_CUENTA = 401;

const MIN = 60_000;
const T0 = new Date(Date.now() + 30 * 24 * 3600_000);
const en = (minutos: number) => new Date(T0.getTime() + minutos * MIN);

describe('estados de placa, outbox y bandeja de notificaciones (ADR 0030 §6, ADR 0031 §18)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let adminA: string;
  let adminB: string;
  let usuarioA: string;
  let superAcceso: string;

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
    adminA = (await iniciarSesion(prueba.app, a.administrador.pin)).acceso;
    adminB = (await iniciarSesion(prueba.app, b.administrador.pin)).acceso;
    usuarioA = (await iniciarSesion(prueba.app, a.usuario.pin)).acceso;
    const sa = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    superAcceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena)).acceso;
  });

  /** Fija el último latido (y desde cuándo la racha es continua) del dispositivo. */
  const latidoA = async (
    id: string,
    ultimo: Date | null,
    racha: Date | null = ultimo,
    lector: { responde: boolean; desde: Date } | null = null,
  ) => {
    await prueba.pool.query(
      'UPDATE dispositivos SET ultimo_latido_at = ?, en_linea_desde = ?, lector_responde = ?, lector_cambio_at = ? WHERE id = ?',
      [
        ultimo,
        racha,
        lector === null ? null : lector.responde ? 1 : 0,
        lector === null ? null : lector.desde,
        id,
      ],
    );
  };
  const estadoDe = async (id: string) => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT estado_conexion, estado_lector, en_observacion FROM dispositivos WHERE id = ?',
      [id],
    );
    return filas[0];
  };
  const pasada = async (ahora: Date) => {
    const evaluacion = await evaluar(prueba.pool, ahora);
    const entrega = await entregar(prueba.pool, ahora);
    return { evaluacion, entrega };
  };
  const get = (url: string, acceso: string) =>
    prueba.app.inject({ method: 'GET', url: `/api/v1${url}`, headers: conUsuario({ acceso }) });
  const post = (url: string, acceso: string) =>
    prueba.app.inject({ method: 'POST', url: `/api/v1${url}`, headers: conUsuario({ acceso }) });
  const bandeja = async (acceso: string, url = '/notificaciones') =>
    (await get(url, acceso)).json<Listado>();

  describe('detector', () => {
    it('un corte corto no avisa: 10 min sin latido es solo sin conexión', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-10));
      const { evaluacion } = await pasada(en(0));
      expect(evaluacion.avisos).toBe(0);
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_conexion).toBe('sin_conexion');
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
      expect(await contarFilas(prueba.pool, 'notificaciones')).toBe(0);
    });

    it('una placa que nunca envió un latido no tiene estado ni genera aviso', async () => {
      const { evaluacion } = await pasada(en(0));
      expect(evaluacion.avisos).toBe(0);
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_conexion).toBeNull();
    });

    it('a los 15 min avisa al propietario y a AGROCOM, una sola vez aunque el detector corra de nuevo', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      const primera = await pasada(en(0));
      expect(primera.evaluacion.avisos).toBe(2);
      expect(primera.entrega.entregadas).toBe(2);

      // Misma foto, minutos después: no se encola nada más.
      const segunda = await pasada(en(1));
      expect(segunda.evaluacion.avisos).toBe(0);
      expect(segunda.entrega.entregadas).toBe(0);
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);

      const propia = await bandeja(adminA);
      expect(propia.meta.total).toBe(1);
      expect(propia.datos[0]).toMatchObject({
        tipo: 'placa.caida_sostenida',
        severidad: 'aviso',
        cantidad: 1,
        resuelta: false,
        leida: false,
        cuenta_id: a.cuenta.id,
      });
      expect(propia.datos[0]?.datos.sitio?.id).toBe(a.sitioId);
      expect(propia.datos[0]?.datos.placas.map((p) => p.puerta_nombre)).toEqual([
        a.puertaPrincipal.nombre,
      ]);
      const deAgrocom = await bandeja(superAcceso, '/plataforma/notificaciones');
      expect(deAgrocom.meta.total).toBe(1);
      expect(deAgrocom.datos[0]?.cuenta_id).toBe(a.cuenta.id);
      // La otra cuenta no se entera.
      expect((await bandeja(adminB)).meta.total).toBe(0);
    });

    it('agrupa por sitio: la segunda placa caída actualiza el MISMO aviso y lo vuelve a marcar no leído', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      const [primera] = (await bandeja(adminA)).datos;
      expect((await post(`/notificaciones/${primera?.id}/leer`, adminA)).statusCode).toBe(204);

      await latidoA(a.dispositivoTrasero.id, en(1 - 16));
      await pasada(en(1));
      const propia = await bandeja(adminA);
      expect(propia.meta.total).toBe(1);
      expect(propia.datos[0]?.id).toBe(primera?.id);
      expect(propia.datos[0]?.cantidad).toBe(2);
      expect(propia.datos[0]?.datos.placas).toHaveLength(2);
      expect(propia.datos[0]?.leida).toBe(false);
      expect(
        await contarFilas(prueba.pool, 'notificaciones', 'destinatario_id = ?', [
          a.administrador.id,
        ]),
      ).toBe(1);
    });

    it('placas de sitios distintos dan avisos distintos', async () => {
      const [sitio] = (await prueba.pool.query(
        'INSERT INTO sitios (tenant_id, nombre) VALUES (?, ?)',
        [a.cuenta.id, 'Otro sitio'],
      )) as unknown as [{ insertId: number }];
      await prueba.pool.query('UPDATE puertas SET sitio_id = ? WHERE id = ?', [
        sitio.insertId,
        a.puertaTrasera.id,
      ]);
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await latidoA(a.dispositivoTrasero.id, en(-16));
      await pasada(en(0));
      expect((await bandeja(adminA)).meta.total).toBe(2);
    });

    it('a las 2 h hay un segundo aviso, solo para AGROCOM y crítico', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      const resultado = await pasada(en(105));
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_conexion).toBe('desaparecida');
      expect(resultado.evaluacion.avisos).toBe(1);

      expect((await bandeja(adminA)).datos.map((n) => n.tipo)).toEqual(['placa.caida_sostenida']);
      const tipos = (await bandeja(superAcceso, '/plataforma/notificaciones')).datos;
      expect(tipos.map((n) => n.tipo).sort()).toEqual([
        'placa.caida_sostenida',
        'placa.desaparecida',
      ]);
      expect(tipos.find((n) => n.tipo === 'placa.desaparecida')?.severidad).toBe('critica');
    });

    it('histéresis: un latido suelto no la recupera; una racha sostenida sí, y cierra los avisos', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      await pasada(en(105));

      // Vuelve con un solo latido.
      await latidoA(a.dispositivoPrincipal.id, en(106), en(106));
      const suelto = await pasada(en(106.5));
      expect(suelto.evaluacion.avisos).toBe(0);
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_conexion).toBe('desaparecida');

      // Ya lleva 4 min de racha continua.
      await latidoA(a.dispositivoPrincipal.id, en(110), en(106));
      const sostenida = await pasada(en(110));
      expect(sostenida.evaluacion.avisos).toBeGreaterThan(0);
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_conexion).toBe('en_linea');

      const propia = await bandeja(adminA);
      expect(propia.datos).toHaveLength(1);
      expect(propia.datos[0]).toMatchObject({ tipo: 'placa.caida_sostenida', resuelta: true });
      const deAgrocom = (await bandeja(superAcceso, '/plataforma/notificaciones')).datos;
      expect(deAgrocom.map((n) => n.tipo).sort()).toEqual([
        'placa.caida_sostenida',
        'placa.desaparecida',
        'placa.recuperada',
      ]);
      expect(deAgrocom.filter((n) => n.tipo !== 'placa.recuperada').every((n) => n.resuelta)).toBe(
        true,
      );

      // Repetir la pasada no duplica la constancia.
      await pasada(en(111));
      expect(await contarFilas(prueba.pool, 'notificaciones', "tipo = 'placa.recuperada'")).toBe(1);
    });

    it('si cae otra vez dentro del enfriamiento, REABRE el mismo incidente en vez de abrir otro', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      await latidoA(a.dispositivoPrincipal.id, en(10), en(5));
      await pasada(en(10));
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_conexion).toBe('en_linea');
      await pasada(en(30));
      await pasada(en(40));
      const propia = await bandeja(adminA);
      expect(propia.datos).toHaveLength(1);
      expect(propia.datos[0]).toMatchObject({ tipo: 'placa.caida_sostenida', resuelta: false });
      expect(
        await contarFilas(prueba.pool, 'notificaciones', 'destinatario_id = ?', [
          a.administrador.id,
        ]),
      ).toBe(1);
    });

    it('un parpadeo sin gente nueva no vuelve a marcar el incidente como no leído', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      const [incidente] = (await bandeja(adminA)).datos;
      await post(`/notificaciones/${incidente?.id}/leer`, adminA);
      await latidoA(a.dispositivoPrincipal.id, en(10), en(5));
      await pasada(en(10));
      await pasada(en(30));
      const [reabierto] = (await bandeja(adminA)).datos;
      expect(reabierto).toMatchObject({ id: incidente?.id, resuelta: false, leida: true });
    });

    it('pasado el enfriamiento, una caída nueva abre OTRO incidente', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      await latidoA(a.dispositivoPrincipal.id, en(10), en(5));
      await pasada(en(10));
      await pasada(en(131)); // 2 h sin latido: más de la hora de enfriamiento desde que se cerró
      const propia = await bandeja(adminA);
      expect(propia.datos).toHaveLength(2);
      expect(propia.datos.filter((n) => !n.resuelta)).toHaveLength(1);
      expect(new Set(propia.datos.map((n) => n.id)).size).toBe(2);
    });

    it('un lector que lleva horas latiendo sin informarse deja de ser noticia y se olvida', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-1), en(-30), {
        responde: false,
        desde: en(-60),
      });
      // Lo informó por última vez hace 7 h (respecto del último latido): obsoleto.
      await prueba.pool.query('UPDATE dispositivos SET lector_informado_at = ? WHERE id = ?', [
        en(-1 - 7 * 60),
        a.dispositivoPrincipal.id,
      ]);
      const resultado = await pasada(en(0));
      expect(resultado.evaluacion.avisos).toBe(0);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT lector_responde, lector_cambio_at, estado_lector FROM dispositivos WHERE id = ?',
        [a.dispositivoPrincipal.id],
      );
      expect(filas[0]).toMatchObject({
        lector_responde: null,
        lector_cambio_at: null,
        estado_lector: null,
      });
    });

    it('un lector informado hace poco sigue valiendo, y su aviso se cierra si se olvida', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-1), en(-30), {
        responde: false,
        desde: en(-60),
      });
      await prueba.pool.query('UPDATE dispositivos SET lector_informado_at = ? WHERE id = ?', [
        en(-2),
        a.dispositivoPrincipal.id,
      ]);
      expect((await pasada(en(0))).evaluacion.avisos).toBe(1);
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_lector).toBe('sin_respuesta');
      // Sigue latiendo 7 h más sin informarlo: el estado y su aviso se limpian.
      await latidoA(a.dispositivoPrincipal.id, en(7 * 60), en(-30), {
        responde: false,
        desde: en(-60),
      });
      await pasada(en(7 * 60 + 1));
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_lector).toBeNull();
      const deAgrocom = await bandeja(superAcceso, '/plataforma/notificaciones');
      expect(deAgrocom.datos.find((n) => n.tipo === 'placa.lector_sin_respuesta')?.resuelta).toBe(
        true,
      );
    });

    it('lector sin respuesta: avisa a AGROCOM tras 5 min, no al propietario', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-1), en(-30), { responde: false, desde: en(-6) });
      const resultado = await pasada(en(0));
      expect(resultado.evaluacion.avisos).toBe(1);
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_lector).toBe('sin_respuesta');
      expect((await bandeja(adminA)).meta.total).toBe(0);
      const deAgrocom = await bandeja(superAcceso, '/plataforma/notificaciones');
      expect(deAgrocom.datos.map((n) => n.tipo)).toEqual(['placa.lector_sin_respuesta']);
    });

    it('lector que lleva menos de 5 min sin responder aún no avisa', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-1), en(-30), { responde: false, desde: en(-2) });
      expect((await pasada(en(0))).evaluacion.avisos).toBe(0);
    });

    it('en observación: en línea y sin lecturas en 24 h, sin aviso; una lectura reciente lo evita', async () => {
      const ahora = en(26 * 60);
      await latidoA(a.dispositivoPrincipal.id, new Date(ahora.getTime() - MIN));
      await latidoA(a.dispositivoTrasero.id, new Date(ahora.getTime() - MIN));
      await prueba.pool.query(
        "INSERT INTO eventos_acceso (tenant_id, puerta_id, dispositivo_id, metodo, resultado, motivo_code, ocurrido_at) VALUES (?, ?, ?, 'qr', 'permitido', 'qr.valido', ?)",
        [
          a.cuenta.id,
          a.puertaTrasera.id,
          a.dispositivoTrasero.id,
          new Date(ahora.getTime() - 3600_000),
        ],
      );
      const resultado = await pasada(ahora);
      expect(resultado.evaluacion.avisos).toBe(0);
      expect((await estadoDe(a.dispositivoPrincipal.id))?.en_observacion).toBe(1);
      expect((await estadoDe(a.dispositivoTrasero.id))?.en_observacion).toBe(0);
      expect(await contarFilas(prueba.pool, 'notificaciones')).toBe(0);
    });

    it('una placa revocada deja de evaluarse y su aviso se cierra', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      await prueba.pool.query('UPDATE dispositivos SET revocado_at = ? WHERE id = ?', [
        en(1),
        a.dispositivoPrincipal.id,
      ]);
      await pasada(en(2));
      expect((await estadoDe(a.dispositivoPrincipal.id))?.estado_conexion).toBeNull();
      expect((await bandeja(adminA)).datos[0]?.resuelta).toBe(true);
    });

    it('una cuenta no se mezcla con otra: la caída en A no toca la bandeja de B', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await latidoA(b.dispositivoPrincipal.id, en(-1));
      await pasada(en(0));
      expect((await bandeja(adminB)).meta.total).toBe(0);
      expect(
        await contarFilas(prueba.pool, 'cola_de_notificaciones', 'tenant_id = ?', [b.cuenta.id]),
      ).toBe(0);
    });

    it('los umbrales salen de la configuración de la plataforma', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 5 WHERE clave = 'placa.caida_minutos'",
      );
      await latidoA(a.dispositivoPrincipal.id, en(-6));
      expect((await pasada(en(0))).evaluacion.avisos).toBe(2);
    });
  });

  describe('outbox', () => {
    const encolarRoto = async () => {
      // Una carga que no tiene la forma de un aviso: la entrega falla en cada intento.
      await prueba.pool.query(
        "INSERT INTO cola_de_notificaciones (tenant_id, audiencia, canal, agrupacion_clave, carga, proximo_intento_at, clave_unica) VALUES (?, 'cuenta', 'app', 'x:sitio:1', '{}', ?, 'roto')",
        [a.cuenta.id, en(0)],
      );
    };
    const cola = async () => {
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT estado, intentos, proximo_intento_at, ultimo_error FROM cola_de_notificaciones',
      );
      return filas[0];
    };

    it('reintenta con espera creciente y, agotados los intentos, queda fallida sin guardar texto del error', async () => {
      await encolarRoto();
      const errores: unknown[] = [];
      const intento = (ahora: Date) => entregar(prueba.pool, ahora, (e) => errores.push(e));

      expect(await intento(en(0))).toMatchObject({ entregadas: 0, reintentos: 1, fallidas: 0 });
      expect((await cola())?.intentos).toBe(1);
      // Aún no toca: la espera es de 30 s.
      expect(await intento(en(0.1))).toMatchObject({ reintentos: 0 });
      expect((await cola())?.intentos).toBe(1);
      await intento(en(1));
      expect((await cola())?.intentos).toBe(2);
      await intento(en(10));
      await intento(en(30));
      await intento(en(120));
      await intento(en(200));
      await intento(en(300));
      const ultimo = await intento(en(500));
      expect(ultimo.fallidas).toBe(1);
      const fila = await cola();
      expect(fila).toMatchObject({ estado: 'fallida', intentos: 8, ultimo_error: 'TypeError' });
      expect(errores.length).toBe(8);
    });

    it('at-least-once sin duplicar: entregar dos veces el mismo mensaje deja una sola notificación', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      await prueba.pool.query(
        "UPDATE cola_de_notificaciones SET estado = 'pendiente', entregada_at = NULL",
      );
      const otra = await entregar(prueba.pool, en(0.5));
      expect(otra.entregadas).toBe(2);
      expect(await contarFilas(prueba.pool, 'notificaciones')).toBe(2);
    });

    it('un canal sin proveedor se anota como omitido, no se pierde en silencio', async () => {
      await prueba.pool.query(
        "INSERT INTO cola_de_notificaciones (tenant_id, audiencia, canal, agrupacion_clave, carga, proximo_intento_at, clave_unica) VALUES (?, 'cuenta', 'push', 'x', '{}', ?, 'push-1')",
        [a.cuenta.id, en(0)],
      );
      expect(await entregar(prueba.pool, en(0))).toMatchObject({ omitidas: 1, entregadas: 0 });
      expect((await cola())?.estado).toBe('omitida');
    });

    it('dos entregadores simultáneos no duplican', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await evaluar(prueba.pool, en(0));
      await Promise.all([entregar(prueba.pool, en(0)), entregar(prueba.pool, en(0))]);
      expect(await contarFilas(prueba.pool, 'notificaciones')).toBe(2);
    });

    it('la retención retira lo viejo ya cerrado y nunca un incidente abierto', async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
      expect(await depurar(prueba.pool, en(60 * 24 * 100))).toBe(2); // solo la cola (abiertos intactos)
      expect(await contarFilas(prueba.pool, 'notificaciones', 'deleted_at IS NULL')).toBe(2);
      await latidoA(a.dispositivoPrincipal.id, en(60 * 24), en(60 * 24 - 10));
      await pasada(en(60 * 24 + 1));
      expect(await depurar(prueba.pool, en(60 * 24 * 100))).toBeGreaterThan(0);
      expect(
        await contarFilas(prueba.pool, 'notificaciones', 'deleted_at IS NULL AND abierta = 0'),
      ).toBe(0);
    });
  });

  describe('API de la bandeja', () => {
    beforeEach(async () => {
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      await latidoA(b.dispositivoPrincipal.id, en(-16));
      await pasada(en(0));
    });

    it('lista, filtra y cuenta no leídas; leer y descartar', async () => {
      expect((await get('/notificaciones/contador', adminA)).json()).toEqual({ no_leidas: 1 });
      const [n] = (await bandeja(adminA)).datos;
      expect((await post(`/notificaciones/${n?.id}/leer`, adminA)).statusCode).toBe(204);
      // Repetirlo es inocuo.
      expect((await post(`/notificaciones/${n?.id}/leer`, adminA)).statusCode).toBe(204);
      expect((await get('/notificaciones/contador', adminA)).json()).toEqual({ no_leidas: 0 });
      expect((await bandeja(adminA, '/notificaciones?estado=no_leidas')).meta.total).toBe(0);
      expect((await bandeja(adminA, '/notificaciones?tipo=placa.recuperada')).meta.total).toBe(0);
      expect((await bandeja(adminA)).datos[0]?.leida).toBe(true);

      expect((await post(`/notificaciones/${n?.id}/descartar`, adminA)).statusCode).toBe(204);
      expect((await bandeja(adminA)).meta.total).toBe(0);
    });

    it('leer todas', async () => {
      const respuesta = await post('/notificaciones/leer-todas', adminA);
      expect(respuesta.json()).toEqual({ marcadas: 1 });
      expect((await get('/notificaciones/contador', adminA)).json()).toEqual({ no_leidas: 0 });
    });

    it('aislamiento: la cuenta A pidiendo una notificación de B recibe 404, sin tocarla', async () => {
      const [deB] = (await bandeja(adminB)).datos;
      for (const accion of ['leer', 'descartar']) {
        const respuesta = await post(`/notificaciones/${deB?.id}/${accion}`, adminA);
        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('notificacion.no_encontrada');
      }
      expect((await bandeja(adminB)).datos[0]?.leida).toBe(false);
    });

    it('un token de cuenta no abre NINGUNA ruta de la bandeja de AGROCOM, y uno de plataforma no abre la de cuenta', async () => {
      const deAgrocom = [
        ['GET', '/plataforma/notificaciones'],
        ['GET', '/plataforma/notificaciones/contador'],
        ['POST', '/plataforma/notificaciones/leer-todas'],
        ['POST', '/plataforma/notificaciones/1/leer'],
        ['POST', '/plataforma/notificaciones/1/descartar'],
      ] as const;
      for (const [metodo, url] of deAgrocom) {
        const respuesta = await prueba.app.inject({
          method: metodo,
          url: `/api/v1${url}`,
          headers: conUsuario({ acceso: adminA }),
        });
        expect(respuesta.statusCode, `${metodo} ${url}`).toBe(CODIGO_DE_CUENTA_EN_PLATAFORMA);
      }
      const deCuenta = [
        ['GET', '/notificaciones'],
        ['GET', '/notificaciones/contador'],
        ['POST', '/notificaciones/leer-todas'],
        ['POST', '/notificaciones/1/leer'],
        ['POST', '/notificaciones/1/descartar'],
      ] as const;
      for (const [metodo, url] of deCuenta) {
        const respuesta = await prueba.app.inject({
          method: metodo,
          url: `/api/v1${url}`,
          headers: conUsuario({ acceso: superAcceso }),
        });
        expect(respuesta.statusCode, `${metodo} ${url}`).toBe(CODIGO_DE_PLATAFORMA_EN_CUENTA);
      }
    });

    it('un Titular y un Guardia no tienen bandeja: 403 en TODAS las rutas /notificaciones', async () => {
      const titular = await crearUsuarioConPin(prueba.pool, a.cuenta, 'TI01', [a.rolTitularId], {
        superiorId: a.administrador.id,
      });
      const rolGuardia = await crearRol(prueba.pool, a.cuenta, 'Guardia', PERMISOS_DE_GUARDIA);
      const guardia = await crearUsuarioConPin(prueba.pool, a.cuenta, 'GU01', [rolGuardia]);
      const rutas = [
        ['GET', '/notificaciones'],
        ['GET', '/notificaciones/contador'],
        ['POST', '/notificaciones/leer-todas'],
        ['POST', '/notificaciones/1/leer'],
        ['POST', '/notificaciones/1/descartar'],
      ] as const;
      for (const usuario of [titular, guardia]) {
        const { acceso } = await iniciarSesion(prueba.app, usuario.pin);
        for (const [metodo, url] of rutas) {
          const respuesta = await prueba.app.inject({
            method: metodo,
            url: `/api/v1${url}`,
            headers: conUsuario({ acceso }),
          });
          expect(respuesta.statusCode, `${metodo} ${url}`).toBe(403);
        }
      }
    });

    it('la notificación de AGROCOM no se puede tocar desde la ruta de una cuenta', async () => {
      const [deAgrocom] = (await bandeja(superAcceso, '/plataforma/notificaciones')).datos;
      expect((await post(`/notificaciones/${deAgrocom?.id}/leer`, adminA)).statusCode).toBe(404);
    });

    it('árbol y permisos: un Miembro no tiene bandeja; el Administrador solo ve las suyas', async () => {
      expect((await get('/notificaciones', usuarioA)).statusCode).toBe(403);
      expect((await get('/notificaciones/contador', usuarioA)).statusCode).toBe(403);
      expect((await get('/notificaciones', '')).statusCode).toBe(401);
      expect(
        await contarFilas(prueba.pool, 'notificaciones', 'destinatario_id = ?', [a.usuario.id]),
      ).toBe(0);
    });

    it('un segundo administrador es otro destinatario con su propio estado de lectura', async () => {
      const [n] = (await bandeja(adminA)).datos;
      await post(`/notificaciones/${n?.id}/leer`, adminA);
      expect(
        await contarFilas(prueba.pool, 'notificaciones', 'cuenta_id = ? AND destinatario_id <> ?', [
          a.cuenta.id,
          a.administrador.id,
        ]),
      ).toBe(1);
    });

    it('un destinatario suspendido no recibe avisos nuevos', async () => {
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
        [a.administrador.id],
      );
      await prueba.pool.query('TRUNCATE TABLE notificaciones');
      await latidoA(a.dispositivoTrasero.id, en(1 - 16));
      await pasada(en(1));
      expect(
        await contarFilas(prueba.pool, 'notificaciones', 'destinatario_id = ?', [
          a.administrador.id,
        ]),
      ).toBe(0);
    });

    it('AGROCOM ve las de todas las cuentas y puede acotar por cuenta', async () => {
      const todas = await bandeja(superAcceso, '/plataforma/notificaciones');
      expect(todas.meta.total).toBe(2);
      const soloB = await bandeja(
        superAcceso,
        `/plataforma/notificaciones?cuenta_id=${b.cuenta.id}`,
      );
      expect(soloB.datos.map((n) => n.cuenta_id)).toEqual([b.cuenta.id]);
      expect((await get('/plataforma/notificaciones/contador', superAcceso)).json()).toEqual({
        no_leidas: 2,
      });
      expect(
        (await post(`/plataforma/notificaciones/${soloB.datos[0]?.id}/leer`, superAcceso))
          .statusCode,
      ).toBe(204);
      expect((await get('/plataforma/notificaciones/contador', superAcceso)).json()).toEqual({
        no_leidas: 1,
      });
      expect((await post('/plataforma/notificaciones/leer-todas', superAcceso)).json()).toEqual({
        marcadas: 1,
      });
      const [id] = (await bandeja(superAcceso, '/plataforma/notificaciones')).datos;
      expect(
        (await post(`/plataforma/notificaciones/${id?.id}/descartar`, superAcceso)).statusCode,
      ).toBe(204);
      expect((await post('/plataforma/notificaciones/999999/leer', superAcceso)).statusCode).toBe(
        404,
      );
    });

    it('la respuesta no trae secretos ni identificadores de red de la placa', async () => {
      const cuerpo =
        (await get('/notificaciones', adminA)).body +
        (await get('/plataforma/notificaciones', superAcceso)).body;
      for (const prohibido of ['clave', 'hash', 'mac', 'token', 'pin', 'ip"']) {
        expect(cuerpo.toLowerCase()).not.toContain(prohibido);
      }
    });

    it('las respuestas no se guardan en caché', async () => {
      const respuesta = await get('/notificaciones', adminA);
      expect(respuesta.headers['cache-control']).toBe('no-store');
    });
  });

  describe('latido y API de dispositivos', () => {
    const latido = (encabezado: string, extra: object = {}) =>
      prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/latidos',
        headers: { authorization: encabezado },
        payload: { firmware: '1.0.0', rssi: -60, puerta_abierta: false, ...extra },
      });
    const fila = async () => {
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT en_linea_desde, lector_responde, lector_cambio_at, lector_informado_at, ultimo_latido_at FROM dispositivos WHERE id = ?',
        [a.dispositivoPrincipal.id],
      );
      return filas[0];
    };

    it('el latido guarda lo que el lector informa y es opcional (firmware anterior)', async () => {
      expect((await latido(a.dispositivoPrincipal.encabezado)).statusCode).toBe(204);
      expect((await fila())?.lector_responde).toBeNull();
      expect(
        (await latido(a.dispositivoPrincipal.encabezado, { lector_responde: false })).statusCode,
      ).toBe(204);
      const f = await fila();
      expect(f?.lector_responde).toBe(0);
      expect(f?.lector_cambio_at).toBeInstanceOf(Date);
      expect(f?.lector_informado_at).toBeInstanceOf(Date);
      // Repetir el mismo valor no mueve «desde cuándo», pero sí anota que lo siguió informando.
      await prueba.pool.query('UPDATE dispositivos SET lector_informado_at = ? WHERE id = ?', [
        new Date(Date.now() - 3600_000),
        a.dispositivoPrincipal.id,
      ]);
      await latido(a.dispositivoPrincipal.encabezado, { lector_responde: false });
      const g = await fila();
      expect((g?.lector_cambio_at as Date).getTime()).toBe((f?.lector_cambio_at as Date).getTime());
      expect((g?.lector_informado_at as Date).getTime()).toBeGreaterThan(Date.now() - 60_000);
      // Un valor que no es booleano se rechaza (esquema estricto).
      expect(
        (await latido(a.dispositivoPrincipal.encabezado, { lector_responde: 'si' })).statusCode,
      ).toBe(400);
    });

    it('la racha continúa con latidos seguidos y se reinicia tras un hueco', async () => {
      await latido(a.dispositivoPrincipal.encabezado);
      const inicio = (await fila())?.en_linea_desde as Date;
      await latido(a.dispositivoPrincipal.encabezado);
      expect(((await fila())?.en_linea_desde as Date).getTime()).toBe(inicio.getTime());
      await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = ? WHERE id = ?', [
        new Date(Date.now() - 10 * MIN),
        a.dispositivoPrincipal.id,
      ]);
      await latido(a.dispositivoPrincipal.encabezado);
      expect(((await fila())?.en_linea_desde as Date).getTime()).toBeGreaterThan(inicio.getTime());
    });
  });

  describe('tareas periódicas', () => {
    it('están registradas con su período y llaman a las funciones con el reloj inyectado', async () => {
      const tareas = crearTareas(prueba.pool);
      expect(tareas.map((t) => t.nombre)).toEqual([
        'estado-de-placas',
        'aperturas-fallidas',
        'entrega-de-notificaciones',
        'depuracion-de-notificaciones',
        'incidentes-de-generacion-ruidosa',
      ]);
      await latidoA(a.dispositivoPrincipal.id, en(-16));
      const errores: unknown[] = [];
      await tareas[0]?.ejecutar(en(0), (e) => errores.push(e));
      await tareas[1]?.ejecutar(en(0), (e) => errores.push(e));
      await tareas[2]?.ejecutar(en(0), (e) => errores.push(e));
      expect(errores).toEqual([]);
      expect((await bandeja(adminA)).meta.total).toBe(1);
    });
  });
});

describe('estado de la placa en el inventario de AGROCOM (campos aditivos, ADR 0031 §18)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
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
    const sa = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    acceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena)).acceso;
    // Una placa detectada (sin vínculo) y otra vinculada al dispositivo de la puerta principal.
    await prueba.pool.query(
      "INSERT INTO placas (mac, firmware_version, ultimo_anuncio_at) VALUES ('AA:BB:CC:00:11:33', '1.0.0', NOW(3))",
    );
    const [resultado] = (await prueba.pool.query(
      "INSERT INTO placas (mac, firmware_version, ultimo_anuncio_at) VALUES ('AA:BB:CC:00:11:22', '1.0.0', NOW(3))",
    )) as unknown as [{ insertId: number }];
    await prueba.pool.query('UPDATE dispositivos SET placa_id = ? WHERE id = ?', [
      resultado.insertId,
      a.dispositivoPrincipal.id,
    ]);
  });

  const leer = async () =>
    (
      await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/plataforma/placas',
        headers: conUsuario({ acceso }),
      })
    ).json<{
      datos: {
        mac: string;
        estado: string;
        en_linea: boolean;
        estado_conexion: string | null;
        lector_responde: boolean | null;
        en_observacion: boolean;
      }[];
    }>().datos;
  const vinculada = async () => (await leer()).find((placa) => placa.estado === 'vinculada');
  const latido = (minutos: number) =>
    prueba.pool.query(
      'UPDATE dispositivos SET ultimo_latido_at = DATE_SUB(NOW(3), INTERVAL ? MINUTE), en_linea_desde = DATE_SUB(NOW(3), INTERVAL ? MINUTE), lector_responde = 0 WHERE id = ?',
      [minutos, minutos, a.dispositivoPrincipal.id],
    );

  it('sin latido o sin vínculo no hay estado; con latido, escala según el silencio', async () => {
    for (const placa of await leer()) {
      expect(placa).toMatchObject({
        estado_conexion: null,
        lector_responde: null,
        en_observacion: false,
      });
    }
    await latido(1);
    expect(await vinculada()).toMatchObject({
      estado_conexion: 'en_linea',
      en_linea: true,
      lector_responde: false,
    });
    await latido(10);
    expect(await vinculada()).toMatchObject({ estado_conexion: 'sin_conexion', en_linea: false });
    await latido(20);
    expect((await vinculada())?.estado_conexion).toBe('caida_sostenida');
    await latido(130);
    expect((await vinculada())?.estado_conexion).toBe('desaparecida');
  });
});
