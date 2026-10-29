import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as vencerOrdenes } from '../../src/modules/accesos/actions/vencer-ordenes.js';
import { GRACIA_DE_RESULTADO_MS } from '../../src/modules/accesos/domain/apertura-manual.js';
import { ejecutar as evaluarAperturas } from '../../src/modules/dispositivos/actions/evaluar-aperturas-fallidas.js';
import { ejecutar as entregarAvisos } from '../../src/modules/notificaciones/actions/entregar-pendientes.js';
import { crearTareas } from '../../src/tareas.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { contarFilas, crearEscenario, marcarEnLinea, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion } from '../helpers/http.js';
import {
  confirmacionesDe,
  crearOrdenDePrueba,
  ENTORNO_DE_ORDENES,
  ordenDe,
} from '../helpers/ordenes.js';

const T0 = new Date(Date.now() + 30 * 24 * 3600_000);
const en = (segundos: number): Date => new Date(T0.getTime() + segundos * 1000);

describe('vencer-ordenes: el proceso periódico que cierra las órdenes sin resolver (ADR 0035 §3)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;

  beforeAll(async () => {
    prueba = await crearAppDePrueba(undefined, ENTORNO_DE_ORDENES);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
  });

  /** Una orden creada en `T0` con su plazo normal (15 s). */
  const orden = (
    escenario: Escenario,
    estado: 'pendiente' | 'entregada',
    opciones: { creadaAt?: Date } = {},
  ) =>
    crearOrdenDePrueba(
      prueba.pool,
      escenario,
      escenario.puertaPrincipal.id,
      estado === 'entregada'
        ? {
            estado,
            dispositivoId: escenario.dispositivoPrincipal.id,
            creadaAt: opciones.creadaAt ?? T0,
          }
        : { estado, creadaAt: opciones.creadaAt ?? T0 },
    );
  const pasada = (ahora: Date) => vencerOrdenes(prueba.pool, ahora);

  describe('una orden pendiente que nadie tomó', () => {
    it('al vencer su plazo pasa a vencida, con la hora de la pasada y SIN constancia: no hay placa que no contestó', async () => {
      const pendiente = await orden(a, 'pendiente');

      const resultado = await pasada(en(16));

      expect(resultado).toMatchObject({ cuentas: 1, vencidas: 1, constancias: 0, errores: 0 });
      expect(await ordenDe(prueba.pool, pendiente.id)).toMatchObject({ estado: 'vencida' });
      expect((await ordenDe(prueba.pool, pendiente.id))?.resuelta_at).toEqual(en(16));
      expect(await confirmacionesDe(prueba.pool, pendiente.lecturaId)).toHaveLength(0);
    });

    it('dentro de su plazo no se toca', async () => {
      const pendiente = await orden(a, 'pendiente');
      const resultado = await pasada(en(14));
      expect(resultado).toMatchObject({ cuentas: 0, vencidas: 0 });
      expect(await ordenDe(prueba.pool, pendiente.id)).toMatchObject({ estado: 'pendiente' });
    });
  });

  describe('una orden entregada a una placa que no informó', () => {
    it('dentro de la gracia para informar (el sensor aún observa) no se toca', async () => {
      const entregada = await orden(a, 'entregada');
      // Pasó el plazo de la orden pero no la gracia: la placa todavía puede informar.
      const resultado = await pasada(en(15 + GRACIA_DE_RESULTADO_MS / 1000 - 1));
      expect(resultado.vencidas).toBe(0);
      expect(await ordenDe(prueba.pool, entregada.id)).toMatchObject({ estado: 'entregada' });
      expect(await confirmacionesDe(prueba.pool, entregada.lecturaId)).toHaveLength(0);
    });

    it('agotada la gracia pasa a vencida y deja la constancia sin_confirmacion/sin_respuesta del servidor', async () => {
      const entregada = await orden(a, 'entregada');
      const venceElPlazo = en(15 + GRACIA_DE_RESULTADO_MS / 1000);

      const resultado = await pasada(en(15 + GRACIA_DE_RESULTADO_MS / 1000 + 5));

      expect(resultado).toMatchObject({ vencidas: 1, constancias: 1 });
      expect(await ordenDe(prueba.pool, entregada.id)).toMatchObject({ estado: 'vencida' });
      const filas = await confirmacionesDe(prueba.pool, entregada.lecturaId);
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        tenant_id: a.cuenta.id,
        evento_acceso_id: entregada.lecturaId,
        dispositivo_id: a.dispositivoPrincipal.id,
        puerta_id: a.puertaPrincipal.id,
        origen: 'servidor',
        resultado: 'sin_confirmacion',
        causa: 'sin_respuesta',
      });
      // Sellada con el instante en que se agotó el plazo, no con la hora de la pasada.
      expect(filas[0]?.registrada_at).toEqual(venceElPlazo);
    });

    it('una orden que la placa ya resolvió no se toca ni deja constancia', async () => {
      const entregada = await orden(a, 'entregada');
      await prueba.pool.query("UPDATE ordenes_apertura SET estado = 'ejecutada' WHERE id = ?", [
        entregada.id,
      ]);
      expect((await pasada(en(300))).vencidas).toBe(0);
      expect(await ordenDe(prueba.pool, entregada.id)).toMatchObject({ estado: 'ejecutada' });
      expect(await confirmacionesDe(prueba.pool, entregada.lecturaId)).toHaveLength(0);
    });
  });

  describe('idempotencia, varias cuentas y concurrencia', () => {
    it('repetir la pasada no cambia nada: ni otra transición ni otra constancia', async () => {
      const entregada = await orden(a, 'entregada');
      const primera = await pasada(en(300));
      expect(primera).toMatchObject({ vencidas: 1, constancias: 1 });

      const segunda = await pasada(en(301));

      expect(segunda).toMatchObject({ cuentas: 0, vencidas: 0, constancias: 0 });
      expect(await confirmacionesDe(prueba.pool, entregada.lecturaId)).toHaveLength(1);
      expect((await ordenDe(prueba.pool, entregada.id))?.resuelta_at).toEqual(en(300));
    });

    it('barre todas las cuentas y cada constancia queda en la cuenta de su orden (sin cruzar)', async () => {
      const deA = await orden(a, 'entregada');
      const deB = await orden(b, 'entregada');
      const pendienteDeB = await crearOrdenDePrueba(prueba.pool, b, b.puertaTrasera.id, {
        creadaAt: T0,
      });

      const resultado = await pasada(en(300));

      expect(resultado).toMatchObject({ cuentas: 2, vencidas: 3, constancias: 2, errores: 0 });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT c.tenant_id, c.dispositivo_id, c.puerta_id, o.tenant_id AS tenant_orden, o.dispositivo_id AS dispositivo_orden FROM confirmaciones_apertura AS c JOIN ordenes_apertura AS o ON o.lectura_id = c.evento_acceso_id',
      );
      expect(filas).toHaveLength(2);
      for (const fila of filas) {
        expect(String(fila.tenant_id)).toBe(String(fila.tenant_orden));
        expect(String(fila.dispositivo_id)).toBe(String(fila.dispositivo_orden));
      }
      expect(await confirmacionesDe(prueba.pool, deA.lecturaId)).toHaveLength(1);
      expect(await confirmacionesDe(prueba.pool, deB.lecturaId)).toHaveLength(1);
      expect(await confirmacionesDe(prueba.pool, pendienteDeB.lecturaId)).toHaveLength(0);
    });

    it('un fallo en una cuenta no frena a las demás y se informa', async () => {
      await orden(a, 'pendiente');
      await orden(b, 'pendiente');
      // La cuenta de A se rompe a mitad de la pasada: su transacción falla, la de B sigue.
      const original = prueba.pool.getConnection.bind(prueba.pool);
      let primera = true;
      prueba.pool.getConnection = async () => {
        const conexion = await original();
        const query = conexion.query.bind(conexion) as (...args: unknown[]) => Promise<unknown>;
        conexion.query = (async (sql: unknown, ...resto: unknown[]) => {
          if (typeof sql === 'string' && sql.startsWith('UPDATE ordenes_apertura') && primera) {
            primera = false;
            throw new Error('falla simulada');
          }
          return query(sql, ...resto);
        }) as typeof conexion.query;
        return conexion;
      };
      const errores: unknown[] = [];
      try {
        const resultado = await vencerOrdenes(prueba.pool, en(60), (e) => errores.push(e));
        expect(resultado).toMatchObject({ cuentas: 2, vencidas: 1, errores: 1 });
        expect(errores).toHaveLength(1);
      } finally {
        prueba.pool.getConnection = original;
      }
      // La siguiente pasada termina lo que faltó.
      expect((await pasada(en(61))).vencidas).toBe(1);
    });

    it('si otra pasada tiene la cuenta, se salta y no hace nada (se reintenta en la próxima)', async () => {
      const entregada = await orden(a, 'entregada');
      const conexion = await prueba.pool.getConnection();
      try {
        await conexion.query('SELECT GET_LOCK(?, 0)', [`ordenes:${a.cuenta.id}`]);
        const resultado = await pasada(en(300));
        expect(resultado).toMatchObject({ ocupadas: 1, vencidas: 0 });
        expect(await ordenDe(prueba.pool, entregada.id)).toMatchObject({ estado: 'entregada' });
      } finally {
        await conexion.query('DO RELEASE_LOCK(?)', [`ordenes:${a.cuenta.id}`]);
        conexion.release();
      }
      expect((await pasada(en(301))).vencidas).toBe(1);
    });
  });

  describe('efectos para la app y la puerta', () => {
    it('una orden vencida libera la puerta: se puede pedir otra', async () => {
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 1');
      await marcarEnLinea(prueba.pool, a.dispositivoPrincipal.id);
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const ahora = new Date();
      await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
        estado: 'entregada',
        dispositivoId: a.dispositivoPrincipal.id,
        creadaAt: new Date(ahora.getTime() - 20_000),
        venceAt: new Date(ahora.getTime() - 5_000),
      });
      const pedir = () =>
        prueba.app.inject({
          method: 'POST',
          url: `/api/v1/puertas/${a.puertaPrincipal.id}/abrir`,
          headers: { ...conUsuario(sesion), 'idempotency-key': randomUUID() },
        });

      // Entregada y dentro de la gracia: la puerta sigue ocupada (el relé puede estar activo).
      expect((await pedir()).statusCode).toBe(409);
      await pasada(new Date(ahora.getTime() + GRACIA_DE_RESULTADO_MS + 1_000));
      expect((await pedir()).statusCode).toBe(202);
    });

    it('queda registrada como tarea periódica y corre con el reloj inyectado', async () => {
      const entregada = await orden(a, 'entregada');
      const tarea = crearTareas(prueba.pool).find((t) => t.nombre === 'vencer-ordenes');
      expect(tarea).toBeDefined();
      expect(tarea?.cadaMs).toBeLessThanOrEqual(30_000);

      await tarea?.ejecutar(en(300), () => undefined);

      expect(await ordenDe(prueba.pool, entregada.id)).toMatchObject({ estado: 'vencida' });
    });
  });
});

/**
 * Las aperturas manuales fallidas alimentan el mismo aviso `apertura.fallida` que las de QR (ADR 0035 §6): mismo
 * umbral, mismo sensor habilitado, sin duplicar avisos.
 */
describe('aperturas manuales fallidas y el aviso apertura.fallida (ADR 0031 §18, ADR 0035 §6)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;

  beforeAll(async () => {
    prueba = await crearAppDePrueba(undefined, ENTORNO_DE_ORDENES);
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
  });

  const habilitarSensor = () =>
    prueba.pool.query(
      'UPDATE dispositivos SET sensor_instalado = 1, sensor_habilitado_at = ? WHERE id = ?',
      [new Date(0), a.dispositivoPrincipal.id],
    );
  /** Una orden entregada a la placa sin respuesta, creada en `desde` segundos de `T0`, y la pasada que la vence. */
  const ordenSinRespuesta = async (desde: number) => {
    await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
      estado: 'entregada',
      dispositivoId: a.dispositivoPrincipal.id,
      creadaAt: en(desde),
    });
    await vencerOrdenes(prueba.pool, en(desde + 15 + GRACIA_DE_RESULTADO_MS / 1000 + 1));
  };
  const detectar = async (ahora: Date) => {
    const evaluacion = await evaluarAperturas(prueba.pool, ahora);
    await entregarAvisos(prueba.pool, ahora);
    return evaluacion;
  };
  const enGrupo = async (): Promise<number> => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT apertura_fallida FROM dispositivos WHERE id = ?',
      [a.dispositivoPrincipal.id],
    );
    return Number(filas[0]?.apertura_fallida);
  };

  it('dos órdenes manuales sin respuesta en la ventana abren UN aviso para la cuenta y otro para AGROCOM', async () => {
    await habilitarSensor();
    await ordenSinRespuesta(0);
    expect((await detectar(en(60))).avisos).toBe(0);
    expect(await enGrupo()).toBe(0);

    await ordenSinRespuesta(120);
    const evaluacion = await detectar(en(200));

    expect(evaluacion).toMatchObject({ avisos: 2, dispositivosActualizados: 1 });
    expect(await enGrupo()).toBe(1);
    // Dos mensajes en la cola: el de la cuenta y el de AGROCOM, no uno por cada orden fallida.
    expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
  });

  it('una falla por QR y otra manual suman al MISMO umbral y producen un solo aviso, sin duplicar', async () => {
    await habilitarSensor();
    // Falla 1: apertura por QR sin respuesta de la placa.
    const [lectura] = await prueba.pool.query(
      "INSERT INTO lecturas (tenant_id, puerta_id, dispositivo_id, metodo, resultado, motivo_code, ocurrido_at) VALUES (?, ?, ?, 'qr', 'permitido', 'acceso.permitido', ?)",
      [a.cuenta.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, en(0)],
    );
    await prueba.pool.query(
      "INSERT INTO confirmaciones_apertura (tenant_id, evento_acceso_id, dispositivo_id, puerta_id, origen, resultado, causa, registrada_at) VALUES (?, ?, ?, ?, 'placa', 'fallida', 'puerta_no_abrio', ?)",
      [
        a.cuenta.id,
        (lectura as { insertId: number }).insertId,
        a.dispositivoPrincipal.id,
        a.puertaPrincipal.id,
        en(0),
      ],
    );
    expect((await detectar(en(30))).avisos).toBe(0);

    // Falla 2: una orden manual sin respuesta. Con la del QR llegan al mínimo (2).
    await ordenSinRespuesta(60);
    expect((await detectar(en(150))).avisos).toBe(2);

    // Una tercera falla manual no vuelve a avisar: el grupo (la placa) es el mismo.
    await ordenSinRespuesta(200);
    expect((await detectar(en(300))).avisos).toBe(0);
    expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
    expect(await detectar(en(301))).toMatchObject({
      avisos: 0,
      constancias: 0,
      dispositivosActualizados: 0,
    });
  });

  it('una falla que informa la propia placa por la API también cuenta', async () => {
    await habilitarSensor();
    const ahora = new Date();
    for (let vez = 0; vez < 2; vez += 1) {
      const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
        estado: 'entregada',
        dispositivoId: a.dispositivoPrincipal.id,
        creadaAt: new Date(ahora.getTime() - 5_000),
      });
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/dispositivos/ordenes/${orden.id}/resultado`,
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { resultado: 'fallida', causa: 'puerta_no_abrio' },
      });
      expect(respuesta.statusCode).toBe(204);
    }

    const evaluacion = await detectar(new Date(ahora.getTime() + 2_000));

    expect(evaluacion).toMatchObject({ avisos: 2, dispositivosActualizados: 1 });
    expect(await enGrupo()).toBe(1);
  });

  it('con el sensor sin habilitar el silencio de la placa no es una falla, también en el modo manual', async () => {
    await ordenSinRespuesta(0);
    await ordenSinRespuesta(120);
    expect(await detectar(en(200))).toMatchObject({ avisos: 0, dispositivosActualizados: 0 });
    expect(await enGrupo()).toBe(0);
  });

  it('una apertura manual ejecutada pone a la puerta al día: las fallas anteriores dejan de contar', async () => {
    await habilitarSensor();
    await ordenSinRespuesta(0);
    const orden = await crearOrdenDePrueba(prueba.pool, a, a.puertaPrincipal.id, {
      estado: 'ejecutada',
      dispositivoId: a.dispositivoPrincipal.id,
      creadaAt: en(100),
    });
    await prueba.pool.query(
      "INSERT INTO confirmaciones_apertura (tenant_id, evento_acceso_id, dispositivo_id, puerta_id, origen, resultado, causa, registrada_at) VALUES (?, ?, ?, ?, 'placa', 'ejecutada', 'puerta_abrio', ?)",
      [a.cuenta.id, orden.lecturaId, a.dispositivoPrincipal.id, a.puertaPrincipal.id, en(105)],
    );
    await ordenSinRespuesta(200);
    // Solo una falla desde la última apertura ejecutada: no alcanza el mínimo.
    expect((await detectar(en(300))).avisos).toBe(0);
  });
});
