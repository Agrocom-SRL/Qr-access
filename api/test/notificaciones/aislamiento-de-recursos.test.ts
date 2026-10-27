import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as evaluar } from '../../src/modules/dispositivos/actions/evaluar-estado-de-placas.js';
import { ejecutar as depurar } from '../../src/modules/notificaciones/actions/depurar-notificaciones.js';
import { ejecutar as entregar } from '../../src/modules/notificaciones/actions/entregar-pendientes.js';
import { conBloqueoDeTarea } from '../../src/platform/db/bloqueo-de-tarea.js';
import { crearLimitadorDeConcurrencia } from '../../src/tareas.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
  crearSuperAdmin,
  type Escenario,
} from '../helpers/fixtures.js';
import { iniciarSesionDePlataforma } from '../helpers/http.js';

const MIN = 60_000;
const T0 = new Date(Date.now() + 30 * 24 * 3600_000);
const en = (minutos: number) => new Date(T0.getTime() + minutos * MIN);

/**
 * Un pool que deja la transacción de la tarea ABIERTA: el `COMMIT` espera a que el test lo libere. Así se prueba
 * que, con la transacción del detector o del entregador en pleno vuelo, una validación o un latido de la misma
 * cuenta no esperan (ADR 0032 §1).
 */
function conCommitRetenido(pool: Pool) {
  let liberar!: () => void;
  const compuerta = new Promise<void>((resolver) => {
    liberar = resolver;
  });
  let avisar!: () => void;
  const retenida = new Promise<void>((resolver) => {
    avisar = resolver;
  });
  const proxy = new Proxy(pool, {
    get(objetivo, propiedad) {
      if (propiedad === 'getConnection') {
        return async (): Promise<PoolConnection> => {
          const conexion = await objetivo.getConnection();
          const commit = conexion.commit.bind(conexion);
          conexion.commit = async () => {
            conexion.commit = commit;
            avisar();
            await compuerta;
            return commit();
          };
          return conexion;
        };
      }
      const valor: unknown = Reflect.get(objetivo, propiedad);
      return typeof valor === 'function' ? (valor.bind(objetivo) as unknown) : valor;
    },
  });
  return { pool: proxy, retenida, liberar };
}

describe('las tareas periódicas no retienen recursos de las puertas (ADR 0032 §1)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;

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
  });

  const latido = (id: string, ultimo: Date | null) =>
    prueba.pool.query(
      'UPDATE dispositivos SET ultimo_latido_at = ?, en_linea_desde = ? WHERE id = ?',
      [ultimo, ultimo, id],
    );
  const validar = async (escenario: Escenario, dispositivo: 'principal' | 'trasero') => {
    const puerta =
      dispositivo === 'principal' ? escenario.puertaPrincipal : escenario.puertaTrasera;
    const credencial =
      dispositivo === 'principal' ? escenario.dispositivoPrincipal : escenario.dispositivoTrasero;
    const qr = await crearQr(prueba.pool, escenario.cuenta, escenario.usuario.id, [puerta.id]);
    const inicio = Date.now();
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: credencial.encabezado },
      payload: { token: qr.texto, leido_en: new Date().toISOString() },
    });
    return { estado: respuesta.statusCode, ms: Date.now() - inicio, cuerpo: respuesta.body };
  };
  const enviarLatido = async (escenario: Escenario, dispositivo: 'principal' | 'trasero') => {
    const inicio = Date.now();
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/latidos',
      headers: {
        authorization: (dispositivo === 'principal'
          ? escenario.dispositivoPrincipal
          : escenario.dispositivoTrasero
        ).encabezado,
      },
      payload: { firmware: '1.0.0', rssi: -60, puerta_abierta: false },
    });
    return { estado: respuesta.statusCode, ms: Date.now() - inicio };
  };

  it('con la transacción del DETECTOR abierta, una validación y un latido de la misma cuenta no esperan', async () => {
    // El trasero ya está evaluado (en línea); el principal cae: el detector solo escribe el principal.
    await latido(a.dispositivoTrasero.id, en(-1));
    await evaluar(prueba.pool, en(0));
    await latido(a.dispositivoPrincipal.id, en(-16));

    const retenido = conCommitRetenido(prueba.pool);
    const pasada = evaluar(retenido.pool, en(0));
    await retenido.retenida;
    // La transacción sigue abierta: nada de lo suyo es visible todavía.
    expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);

    const validacion = await validar(a, 'trasero');
    const pulso = await enviarLatido(a, 'trasero');
    expect(validacion.estado, validacion.cuerpo).toBe(200);
    expect(pulso.estado).toBe(204);
    // Esperar un bloqueo costaría el tope de la base (50 s) o, como mínimo, el de la tarea (2 s).
    expect(validacion.ms).toBeLessThan(1500);
    expect(pulso.ms).toBeLessThan(1500);

    retenido.liberar();
    const resultado = await pasada;
    expect(resultado).toMatchObject({ errores: 0, avisos: 2 });
    expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
  });

  it('la ÚNICA fila que sí espera es la que el detector acaba de cambiar, y solo hasta su COMMIT', async () => {
    await latido(a.dispositivoPrincipal.id, en(-16));
    const retenido = conCommitRetenido(prueba.pool);
    const pasada = evaluar(retenido.pool, en(0));
    await retenido.retenida;
    let terminada = false;
    const validacion = validar(a, 'principal').then((r) => {
      terminada = true;
      return r;
    });
    await new Promise((resolver) => setTimeout(resolver, 700));
    expect(terminada).toBe(false);
    retenido.liberar();
    expect((await validacion).estado).toBe(200);
    await pasada;
  });

  it('con la transacción del ENTREGADOR abierta, una validación y un latido de la misma cuenta no esperan', async () => {
    await latido(a.dispositivoPrincipal.id, en(-16));
    await evaluar(prueba.pool, en(0));

    const retenido = conCommitRetenido(prueba.pool);
    const pasada = entregar(retenido.pool, en(0));
    await retenido.retenida;
    expect(await contarFilas(prueba.pool, 'notificaciones')).toBe(0);

    const validacion = await validar(a, 'principal');
    const pulso = await enviarLatido(a, 'principal');
    expect(validacion.estado, validacion.cuerpo).toBe(200);
    expect(pulso.estado).toBe(204);
    expect(validacion.ms).toBeLessThan(1500);
    expect(pulso.ms).toBeLessThan(1500);

    retenido.liberar();
    expect((await pasada).entregadas).toBe(2);
  });

  it('el detector no bloquea a las placas que no cambian: otra cuenta y otras placas de la misma siguen libres', async () => {
    await latido(a.dispositivoPrincipal.id, en(-16));
    await latido(b.dispositivoPrincipal.id, en(-1));
    const retenido = conCommitRetenido(prueba.pool);
    const pasada = evaluar(retenido.pool, en(0));
    await retenido.retenida;
    const deB = await validar(b, 'principal');
    expect(deB.estado, deB.cuerpo).toBe(200);
    expect(deB.ms).toBeLessThan(1500);
    retenido.liberar();
    await pasada;
  });

  it('si otra pasada tiene el bloqueo de la cuenta, esta se salta sin escribir ni esperar', async () => {
    await latido(a.dispositivoPrincipal.id, en(-16));
    const [cuentas] = await prueba.pool.query<RowDataPacket[]>('SELECT id FROM cuentas');
    expect(cuentas.length).toBeGreaterThan(0);
    const otra = await prueba.pool.getConnection();
    try {
      await otra.query('SELECT GET_LOCK(?, 0)', [`estado_placas:${a.cuenta.id}`]);
      const inicio = Date.now();
      const resultado = await evaluar(prueba.pool, en(0));
      expect(Date.now() - inicio).toBeLessThan(1500);
      expect(resultado).toMatchObject({ ocupadas: 1, avisos: 0, placasActualizadas: 0 });
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
    } finally {
      await otra.query('DO RELEASE_LOCK(?)', [`estado_placas:${a.cuenta.id}`]);
      otra.release();
    }
    // Liberado el bloqueo, la siguiente pasada avisa.
    expect((await evaluar(prueba.pool, en(1))).avisos).toBe(2);
  });

  it('compare-and-set: dos pasadas simultáneas con la misma foto encolan el aviso UNA vez', async () => {
    await latido(a.dispositivoPrincipal.id, en(-16));
    const resultados = await Promise.all([
      evaluar(prueba.pool, en(0)),
      evaluar(prueba.pool, en(0)),
      evaluar(prueba.pool, en(0)),
    ]);
    expect(resultados.reduce((total, r) => total + r.avisos, 0)).toBe(2);
    expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
  });

  it('las conexiones vuelven al pool con el tope de bloqueo original (no se contaminan)', async () => {
    await latido(a.dispositivoPrincipal.id, en(-16));
    await evaluar(prueba.pool, en(0));
    await entregar(prueba.pool, en(0));
    await depurar(prueba.pool, en(0));
    const [globales] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT @@global.innodb_lock_wait_timeout AS valor',
    );
    const conexiones = await Promise.all(
      Array.from({ length: 4 }, () => prueba.pool.getConnection()),
    );
    try {
      for (const conexion of conexiones) {
        const [sesiones] = await conexion.query<RowDataPacket[]>(
          'SELECT @@session.innodb_lock_wait_timeout AS valor',
        );
        expect(sesiones[0]?.valor).toBe(globales[0]?.valor);
      }
    } finally {
      for (const conexion of conexiones) conexion.release();
    }
  });

  it('conBloqueoDeTarea libera el bloqueo aunque la función falle', async () => {
    await expect(
      conBloqueoDeTarea(prueba.pool, 'prueba_de_bloqueo', () => Promise.reject(new Error('x'))),
    ).rejects.toThrow('x');
    const otra = await conBloqueoDeTarea(prueba.pool, 'prueba_de_bloqueo', () =>
      Promise.resolve(1),
    );
    expect(otra).toEqual({ obtenido: true, valor: 1 });
  });

  it('el limitador de concurrencia deja correr como mucho N tareas a la vez', async () => {
    const adquirir = crearLimitadorDeConcurrencia(2);
    let simultaneas = 0;
    let maximo = 0;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        const liberar = await adquirir();
        simultaneas += 1;
        maximo = Math.max(maximo, simultaneas);
        await new Promise((resolver) => setTimeout(resolver, 10));
        simultaneas -= 1;
        liberar();
      }),
    );
    expect(maximo).toBe(2);
  });
});

describe('entrega robusta del outbox', () => {
  let prueba: AppDePrueba;
  let a: Escenario;

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
    await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena);
  });

  const caer = (id: string, minutos: number) =>
    prueba.pool.query(
      'UPDATE dispositivos SET ultimo_latido_at = ?, en_linea_desde = ? WHERE id = ?',
      [en(minutos), en(minutos), id],
    );
  const cola = async () => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT id, audiencia, estado, intentos, proximo_intento_at, ultimo_error FROM cola_de_notificaciones ORDER BY id',
    );
    return filas;
  };

  it('un fallo TRANSITORIO (bloqueo) no cuenta como intento ni agota el mensaje', async () => {
    await caer(a.dispositivoPrincipal.id, -16);
    await evaluar(prueba.pool, en(0));
    await entregar(prueba.pool, en(0));
    // Segunda placa caída: el mensaje nuevo debe actualizar el incidente abierto del administrador.
    await caer(a.dispositivoTrasero.id, 1 - 16);
    await evaluar(prueba.pool, en(1));

    // Otra transacción sostiene el incidente abierto: el entregador espera 2 s y cede.
    const retenedora = await prueba.pool.getConnection();
    await retenedora.beginTransaction();
    await retenedora.query(
      'SELECT id FROM notificaciones WHERE destinatario_id = ? AND abierta = 1 FOR UPDATE',
      [a.administrador.id],
    );
    const errores: unknown[] = [];
    let resultado;
    try {
      resultado = await entregar(prueba.pool, en(1), (e) => errores.push(e));
    } finally {
      await retenedora.rollback();
      retenedora.release();
    }
    expect(errores).toHaveLength(1);
    expect(resultado).toMatchObject({ reintentos: 1, fallidas: 0 });
    const fila = (await cola()).find((m) => m.audiencia === 'cuenta' && m.estado === 'pendiente');
    expect(fila).toMatchObject({ intentos: 0, ultimo_error: 'ER_LOCK_WAIT_TIMEOUT' });

    // Pasada la espera, se entrega.
    const despues = await entregar(prueba.pool, en(3));
    expect(despues.entregadas).toBeGreaterThanOrEqual(1);
    expect((await cola()).every((m) => m.estado === 'entregada')).toBe(true);
  }, 20_000);

  it('una fallida reciente vuelve a la cola tras la espera larga, con un solo intento más, y deja rastro', async () => {
    const insertar = (clave: string, creada: Date, actualizada: Date) =>
      prueba.pool.query(
        `INSERT INTO cola_de_notificaciones (tenant_id, audiencia, canal, agrupacion_clave, carga, estado, intentos, proximo_intento_at, clave_unica, created_at, updated_at)
         VALUES (?, 'cuenta', 'app', 'x:sitio:1', '{}', 'fallida', 8, ?, ?, ?, ?)`,
        [a.cuenta.id, creada, clave, creada, actualizada],
      );
    await insertar('reciente-espero', en(-120), en(-60)); // espera de 6 h no cumplida
    await insertar('vieja-sin-vigencia', en(-5 * 24 * 60), en(-12 * 60)); // más de 3 días de vida
    await insertar('elegible', en(-24 * 60), en(-7 * 60));

    const errores: unknown[] = [];
    const primera = await entregar(prueba.pool, en(0), (e) => errores.push(e));
    expect(primera.reprogramadas).toBe(1);
    expect(errores.map((e) => (e as Error).name)).toEqual(['MensajeFallidoReprogramado']);
    const reprogramada = (await cola()).find((m) => m.estado === 'pendiente');
    expect(reprogramada).toMatchObject({ intentos: 7 });

    // Un fallo más (la carga es inválida) y vuelve a fallida, esperando otras 6 h.
    const segunda = await entregar(prueba.pool, en(0.1), () => undefined);
    expect(segunda.fallidas).toBe(1);
    expect((await cola()).filter((m) => m.estado === 'fallida')).toHaveLength(3);
    // (El reloj de los tests va 30 días adelantado: se fija cuándo falló, como lo haría `ahora`.)
    await prueba.pool.query(
      "UPDATE cola_de_notificaciones SET updated_at = ? WHERE estado = 'fallida'",
      [en(0.1)],
    );
    const tercera = await entregar(prueba.pool, en(1), () => undefined);
    expect(tercera.reprogramadas).toBe(0);
  });

  it('orden por grupo: un mensaje no pasa por encima de un pendiente anterior del mismo grupo', async () => {
    await caer(a.dispositivoPrincipal.id, -16);
    await evaluar(prueba.pool, en(0));
    await caer(a.dispositivoTrasero.id, 1 - 16);
    await evaluar(prueba.pool, en(1));
    const mensajes = await cola();
    const delPropietario = mensajes.filter((m) => m.audiencia === 'cuenta');
    expect(delPropietario).toHaveLength(2);
    // El primero está en espera de un reintento; el segundo ya tocaba.
    await prueba.pool.query(
      'UPDATE cola_de_notificaciones SET proximo_intento_at = ? WHERE id = ?',
      [en(60), delPropietario[0]?.id],
    );

    const resultado = await entregar(prueba.pool, en(2));
    const despues = await cola();
    expect(despues.find((m) => m.id === delPropietario[1]?.id)?.estado).toBe('pendiente');
    expect(resultado.entregadas).toBe(2); // el de AGROCOM (otro destino): dos mensajes suyos
    expect(
      await contarFilas(prueba.pool, 'notificaciones', 'destinatario_id = ?', [a.administrador.id]),
    ).toBe(0);

    // Cuando le toca al primero, el segundo lo sigue en la misma pasada o en la siguiente, y en orden.
    await entregar(prueba.pool, en(61));
    await entregar(prueba.pool, en(62));
    expect((await cola()).every((m) => m.estado === 'entregada')).toBe(true);
    const [incidente] = await prueba.pool
      .query<RowDataPacket[]>('SELECT cantidad FROM notificaciones WHERE destinatario_id = ?', [
        a.administrador.id,
      ])
      .then(([filas]) => filas);
    expect(incidente?.cantidad).toBe(2);
  });

  it('una fotografía vieja re-driveada no pisa a una más nueva ya entregada', async () => {
    await caer(a.dispositivoPrincipal.id, -16);
    await evaluar(prueba.pool, en(0));
    await caer(a.dispositivoTrasero.id, 1 - 16);
    await evaluar(prueba.pool, en(1));
    const [primero, segundo] = (await cola()).filter((m) => m.audiencia === 'cuenta');
    // El primero quedó fallido; el segundo se entrega.
    await prueba.pool.query("UPDATE cola_de_notificaciones SET estado = 'fallida' WHERE id = ?", [
      primero?.id,
    ]);
    await entregar(prueba.pool, en(2));
    expect((await cola()).find((m) => m.id === segundo?.id)?.estado).toBe('entregada');
    // Vuelve a pendiente (re-drive manual): se descarta como superado.
    await prueba.pool.query("UPDATE cola_de_notificaciones SET estado = 'pendiente' WHERE id = ?", [
      primero?.id,
    ]);
    const resultado = await entregar(prueba.pool, en(3));
    expect(resultado.omitidas).toBe(1);
    expect((await cola()).find((m) => m.id === primero?.id)).toMatchObject({
      estado: 'omitida',
      ultimo_error: 'mensaje.superado',
    });
  });

  it('un solo entregador a la vez: el segundo ve el bloqueo ocupado y no hace nada', async () => {
    await caer(a.dispositivoPrincipal.id, -16);
    await evaluar(prueba.pool, en(0));
    const otra = await prueba.pool.getConnection();
    try {
      await otra.query('SELECT GET_LOCK(?, 0)', ['entrega_de_notificaciones']);
      const resultado = await entregar(prueba.pool, en(0));
      expect(resultado).toMatchObject({ ocupada: true, entregadas: 0 });
    } finally {
      await otra.query('DO RELEASE_LOCK(?)', ['entrega_de_notificaciones']);
      otra.release();
    }
    expect((await entregar(prueba.pool, en(0))).entregadas).toBe(2);
  });

  it('la cuenta de la notificación sale del contexto, no de la carga del mensaje', async () => {
    await caer(a.dispositivoPrincipal.id, -16);
    await evaluar(prueba.pool, en(0));
    // La carga miente sobre la cuenta; la notificación debe quedar en la cuenta dueña del mensaje.
    await prueba.pool.query(
      "UPDATE cola_de_notificaciones SET carga = JSON_SET(carga, '$.datos.cuenta.id', '999999')",
    );
    await entregar(prueba.pool, en(0));
    expect(await contarFilas(prueba.pool, 'notificaciones', 'cuenta_id <> ?', [a.cuenta.id])).toBe(
      0,
    );
    expect(await contarFilas(prueba.pool, 'notificaciones')).toBe(2);
  });
});

describe('baja de cuenta y retención', () => {
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
  });

  const caer = (id: string, minutos: number) =>
    prueba.pool.query(
      'UPDATE dispositivos SET ultimo_latido_at = ?, en_linea_desde = ? WHERE id = ?',
      [en(minutos), en(minutos), id],
    );

  it('al dar de baja una cuenta se cierran sus incidentes abiertos (propios y de AGROCOM) y se retira lo pendiente', async () => {
    await caer(a.dispositivoPrincipal.id, -16);
    await evaluar(prueba.pool, en(0));
    await entregar(prueba.pool, en(0));
    await caer(a.dispositivoTrasero.id, 1 - 16);
    await evaluar(prueba.pool, en(1)); // quedan mensajes pendientes
    expect(await contarFilas(prueba.pool, 'notificaciones', 'abierta = 1')).toBe(2);

    const baja = await prueba.app.inject({
      method: 'DELETE',
      url: `/api/v1/plataforma/cuentas/${a.cuenta.id}`,
      headers: { authorization: `Bearer ${acceso}` },
      payload: { codigo: 'AAA' },
    });
    expect(baja.statusCode, baja.body).toBe(204);

    expect(await contarFilas(prueba.pool, 'notificaciones', 'abierta = 1')).toBe(0);
    expect(
      await contarFilas(prueba.pool, 'notificaciones', 'abierta = 0 AND resuelta_at IS NOT NULL'),
    ).toBe(2);
    expect(await contarFilas(prueba.pool, 'cola_de_notificaciones', "estado = 'pendiente'")).toBe(
      0,
    );
    expect(
      await contarFilas(prueba.pool, 'cola_de_notificaciones', "ultimo_error = 'cuenta.eliminada'"),
    ).toBe(2);
  });

  it('la depuración retira por lotes, una transacción por cuenta, con soft delete, sin tocar lo reciente ni lo abierto', async () => {
    const b = await crearEscenario(prueba.pool, 'BBB');
    const viejo = en(-200 * 24 * 60);
    for (const escenario of [a, b]) {
      for (let i = 0; i < 5; i += 1) {
        await prueba.pool.query(
          `INSERT INTO notificaciones (tenant_id, cuenta_id, destinatario_id, tipo, severidad, agrupacion_clave, clave_unica, abierta, miembros, datos, novedad_at, resuelta_at)
           VALUES (?, ?, ?, 'placa.recuperada', 'info', ?, ?, 0, '[]', '{}', ?, ?)`,
          [
            escenario.cuenta.id,
            escenario.cuenta.id,
            escenario.administrador.id,
            `g:${i}`,
            `c${i}`,
            viejo,
            viejo,
          ],
        );
        await prueba.pool.query(
          `INSERT INTO cola_de_notificaciones (tenant_id, audiencia, canal, agrupacion_clave, carga, estado, proximo_intento_at, clave_unica, updated_at)
           VALUES (?, 'cuenta', 'app', 'x', '{}', 'entregada', ?, ?, ?)`,
          [escenario.cuenta.id, viejo, `q${i}`, viejo],
        );
      }
    }
    await prueba.pool.query(
      `INSERT INTO notificaciones (tenant_id, cuenta_id, destinatario_id, tipo, severidad, agrupacion_clave, abierta, miembros, datos, novedad_at)
       VALUES (?, ?, ?, 'placa.caida_sostenida', 'aviso', 'g:abierta', 1, '[]', '{}', ?)`,
      [a.cuenta.id, a.cuenta.id, a.administrador.id, viejo],
    );
    const errores: unknown[] = [];
    expect(await depurar(prueba.pool, en(0), (e) => errores.push(e))).toBe(20);
    expect(errores).toEqual([]);
    // Soft delete: las filas siguen, marcadas.
    expect(await contarFilas(prueba.pool, 'notificaciones')).toBe(11);
    expect(await contarFilas(prueba.pool, 'notificaciones', 'deleted_at IS NULL')).toBe(1);
    expect(await contarFilas(prueba.pool, 'cola_de_notificaciones', 'deleted_at IS NULL')).toBe(0);
    // Repetir no retira nada más.
    expect(await depurar(prueba.pool, en(0))).toBe(0);
  });

  it('las consultas de retención usan sus índices', async () => {
    const [notificaciones] = await prueba.pool.query<RowDataPacket[]>(
      'EXPLAIN SELECT t.id FROM notificaciones AS t WHERE t.abierta = 0 AND t.novedad_at < NOW() AND t.deleted_at IS NULL',
    );
    const [mensajes] = await prueba.pool.query<RowDataPacket[]>(
      "EXPLAIN SELECT t.id FROM cola_de_notificaciones AS t WHERE t.estado IN ('entregada', 'omitida', 'fallida') AND t.updated_at < NOW() AND t.deleted_at IS NULL",
    );
    expect(String(notificaciones[0]?.key)).toBe('idx_notificaciones_retencion');
    expect(String(mensajes[0]?.key)).toBe('idx_cola_de_notificaciones_retencion');
  });
});
