import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as evaluar } from '../../src/modules/dispositivos/actions/evaluar-aperturas-fallidas.js';
import { ejecutar as entregar } from '../../src/modules/notificaciones/actions/entregar-pendientes.js';
import { crearTareas } from '../../src/tareas.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearSuperAdmin,
  type DispositivoDePrueba,
  type Escenario,
  type PuertaDePrueba,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, iniciarSesionDePlataforma } from '../helpers/http.js';

interface Notificacion {
  id: string;
  tipo: string;
  severidad: string;
  cuenta_id: string;
  cantidad: number;
  resuelta: boolean;
  datos: {
    cuenta: { id: string };
    sitio: { id: string } | null;
    placas: {
      dispositivo_id: string;
      puerta_nombre: string;
      fallos?: number;
      causa?: string | null;
    }[];
  };
}

const MIN = 60_000;
const T0 = new Date(Date.now() + 30 * 24 * 3600_000);
const en = (minutos: number) => new Date(T0.getTime() + minutos * MIN);

describe('aperturas que fallan: constancia de falta de respuesta y aviso agrupado (ADR 0031 §18)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let adminA: string;
  let adminB: string;
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
    const sa = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    superAcceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena)).acceso;
  });

  /** Habilita el sensor «desde siempre» (salvo que el test pida otro instante): se juzga todo lo del escenario. */
  const habilitarSensor = (dispositivo: DispositivoDePrueba, desde: Date = new Date(0)) =>
    prueba.pool.query(
      'UPDATE dispositivos SET sensor_instalado = 1, sensor_habilitado_at = ? WHERE id = ?',
      [desde, dispositivo.id],
    );

  /** Una apertura que el servidor ordenó a esa hora: el evento permitido, escrito directo. */
  async function apertura(
    escenario: Escenario,
    dispositivo: DispositivoDePrueba,
    puerta: PuertaDePrueba,
    ocurrido: Date,
  ): Promise<string> {
    const [resultado] = await prueba.pool.query(
      "INSERT INTO lecturas (tenant_id, puerta_id, dispositivo_id, metodo, resultado, motivo_code, ocurrido_at) VALUES (?, ?, ?, 'qr', 'permitido', 'acceso.permitido', ?)",
      [escenario.cuenta.id, puerta.id, dispositivo.id, ocurrido],
    );
    return String((resultado as { insertId: number }).insertId);
  }

  /** Lo que la placa informó (o la constancia del servidor), escrito directo con la hora que se pida. */
  async function informe(
    escenario: Escenario,
    dispositivo: DispositivoDePrueba,
    puerta: PuertaDePrueba,
    eventoId: string,
    resultado: 'ejecutada' | 'fallida' | 'sin_confirmacion',
    causa: string,
    registrada: Date,
    origen: 'placa' | 'servidor' = 'placa',
  ): Promise<void> {
    await prueba.pool.query(
      'INSERT INTO confirmaciones_apertura (tenant_id, evento_acceso_id, dispositivo_id, puerta_id, origen, resultado, causa, registrada_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        escenario.cuenta.id,
        eventoId,
        dispositivo.id,
        puerta.id,
        origen,
        resultado,
        causa,
        registrada,
      ],
    );
  }

  const aperturaA = (ocurrido: Date) =>
    apertura(a, a.dispositivoPrincipal, a.puertaPrincipal, ocurrido);
  const fallaA = async (ocurrido: Date) =>
    informe(
      a,
      a.dispositivoPrincipal,
      a.puertaPrincipal,
      await aperturaA(ocurrido),
      'fallida',
      'puerta_no_abrio',
      ocurrido,
    );

  const pasada = async (ahora: Date) => {
    const evaluacion = await evaluar(prueba.pool, ahora);
    const entrega = await entregar(prueba.pool, ahora);
    return { evaluacion, entrega };
  };
  const get = (url: string, acceso: string) =>
    prueba.app.inject({ method: 'GET', url: `/api/v1${url}`, headers: conUsuario({ acceso }) });
  const bandeja = async (acceso: string, url = '/notificaciones') =>
    (await get(url, acceso)).json<{ datos: Notificacion[]; meta: { total: number } }>();
  const filasDe = async (sql: string, params: unknown[] = []) =>
    (await prueba.pool.query<RowDataPacket[]>(sql, params))[0];
  const enGrupo = async (id: string): Promise<number | undefined> => {
    const fila = (await filasDe('SELECT apertura_fallida FROM dispositivos WHERE id = ?', [id]))[0];
    return fila === undefined ? undefined : Number(fila.apertura_fallida);
  };

  describe('constancia de falta de respuesta', () => {
    it('antes del plazo (90 s) no es nada; pasado el plazo queda sin_confirmacion / sin_respuesta del servidor', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      const evento = await aperturaA(en(-1));
      const antes = await pasada(en(-0.1)); // 54 s después de la orden
      expect(antes.evaluacion.constancias).toBe(0);
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);

      const despues = await pasada(en(1)); // 120 s
      expect(despues.evaluacion.constancias).toBe(1);
      expect(await filasDe('SELECT * FROM confirmaciones_apertura')).toMatchObject([
        {
          evento_acceso_id: evento,
          dispositivo_id: a.dispositivoPrincipal.id,
          origen: 'servidor',
          resultado: 'sin_confirmacion',
          causa: 'sin_respuesta',
        },
      ]);
      // Una sola falla no avisa: un caso aislado no es noticia.
      expect(despues.evaluacion.avisos).toBe(0);
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
    });

    it('el detector no rehace nada si se repite: ni otra constancia ni otro aviso', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await aperturaA(en(-3));
      await aperturaA(en(-2));
      const primera = await pasada(en(0));
      expect(primera.evaluacion).toMatchObject({ constancias: 2, avisos: 2 });
      const segunda = await pasada(en(0));
      expect(segunda.evaluacion).toMatchObject({
        constancias: 0,
        avisos: 0,
        dispositivosActualizados: 0,
      });
      const tercera = await pasada(en(5));
      expect(tercera.evaluacion).toMatchObject({ constancias: 0, avisos: 0 });
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(2);
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
    });

    it('sin sensor habilitado el silencio de la placa no es una falla: nada que dejar ni avisar', async () => {
      await aperturaA(en(-5));
      await aperturaA(en(-4));
      const resultado = await pasada(en(0));
      expect(resultado.evaluacion).toMatchObject({ constancias: 0, avisos: 0 });
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);
    });

    it('si la placa ya informó (aunque sea sin_sensor) no se deja constancia', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      const evento = await aperturaA(en(-5));
      await informe(
        a,
        a.dispositivoPrincipal,
        a.puertaPrincipal,
        evento,
        'sin_confirmacion',
        'sin_sensor',
        en(-5),
      );
      expect((await pasada(en(0))).evaluacion.constancias).toBe(0);
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(1);
    });

    it('los rechazos no son aperturas: no esperan informe', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await prueba.pool.query(
        "INSERT INTO lecturas (tenant_id, puerta_id, dispositivo_id, metodo, resultado, motivo_code, ocurrido_at) VALUES (?, ?, ?, 'qr', 'rechazado', 'qr.vencido', ?)",
        [a.cuenta.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, en(-5)],
      );
      expect((await pasada(en(0))).evaluacion.constancias).toBe(0);
    });

    it('las aperturas de hace más de 24 h no se reabren al desplegar: no generan constancias', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await aperturaA(en(-25 * 60));
      expect((await pasada(en(0))).evaluacion.constancias).toBe(0);
    });
  });

  describe('habilitar el sensor no juzga el pasado', () => {
    it('las aperturas anteriores a la habilitación no dejan constancia ni avisan; las posteriores sí', async () => {
      await aperturaA(en(-30));
      await aperturaA(en(-20));
      await habilitarSensor(a.dispositivoPrincipal, en(-10));
      const antes = await pasada(en(0));
      expect(antes.evaluacion).toMatchObject({ constancias: 0, avisos: 0 });
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(0);

      await aperturaA(en(-5));
      expect((await pasada(en(0))).evaluacion.constancias).toBe(1);
    });

    it('un `sin_sensor` informado antes de habilitar el sensor tampoco cuenta como falla', async () => {
      for (const minuto of [-30, -25, -20]) {
        await informe(
          a,
          a.dispositivoPrincipal,
          a.puertaPrincipal,
          await aperturaA(en(minuto)),
          'sin_confirmacion',
          'sin_sensor',
          en(minuto),
        );
      }
      await habilitarSensor(a.dispositivoPrincipal, en(-10));
      expect((await pasada(en(0))).evaluacion).toMatchObject({ avisos: 0, constancias: 0 });
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
    });

    it('un evento de otro método (pulsador) no es una apertura ordenada por QR: no se juzga', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      const evento = await aperturaA(en(-5));
      await prueba.pool.query("UPDATE lecturas SET metodo = 'pulsador' WHERE id = ?", [evento]);
      expect((await pasada(en(0))).evaluacion.constancias).toBe(0);
    });
  });

  describe('la constancia se sella con la hora en que venció el plazo', () => {
    it('tras una caída del detector, la constancia lleva orden + plazo y no corre la ventana de 60 min', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      const primero = await aperturaA(en(-5));
      await aperturaA(en(-4));
      // El detector vuelve cinco horas después.
      const resultado = await pasada(en(300));
      expect(resultado.evaluacion).toMatchObject({ constancias: 2, avisos: 0 });
      const [fila] = await filasDe(
        'SELECT registrada_at, TIMESTAMPDIFF(SECOND, e.ocurrido_at, c.registrada_at) AS despues FROM confirmaciones_apertura AS c JOIN lecturas AS e ON e.id = c.evento_acceso_id WHERE c.evento_acceso_id = ?',
        [primero],
      );
      expect(Number(fila?.despues)).toBe(90);
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
    });

    it('la misma caída, pero con el detector a tiempo dentro de la ventana, sí avisa', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await aperturaA(en(-5));
      await aperturaA(en(-4));
      expect((await pasada(en(30))).evaluacion).toMatchObject({ constancias: 2, avisos: 2 });
    });
  });

  describe('aviso `apertura.fallida`', () => {
    it('dos fallas en la ventana abren UN aviso para el administrador y otro para AGROCOM, severidad `aviso`', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await fallaA(en(-10));
      expect((await pasada(en(-9))).evaluacion.avisos).toBe(0);
      await fallaA(en(-8));
      const resultado = await pasada(en(-7));
      expect(resultado.evaluacion).toMatchObject({ avisos: 2, dispositivosActualizados: 1 });
      expect(resultado.entrega.entregadas).toBe(2);
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(1);

      const propia = await bandeja(adminA);
      expect(propia.meta.total).toBe(1);
      expect(propia.datos[0]).toMatchObject({
        tipo: 'apertura.fallida',
        severidad: 'aviso',
        cantidad: 1,
        resuelta: false,
        cuenta_id: a.cuenta.id,
      });
      expect(propia.datos[0]?.datos.sitio?.id).toBe(a.sitioId);
      expect(propia.datos[0]?.datos.placas).toMatchObject([
        {
          dispositivo_id: a.dispositivoPrincipal.id,
          puerta_nombre: a.puertaPrincipal.nombre,
          fallos: 2,
          causa: 'puerta_no_abrio',
        },
      ]);
      const deAgrocom = await bandeja(superAcceso, '/plataforma/notificaciones');
      expect(deAgrocom.datos.map((n) => [n.tipo, n.cuenta_id])).toEqual([
        ['apertura.fallida', a.cuenta.id],
      ]);
    });

    it('agrupa por sitio: dos puertas del mismo sitio son UN aviso con las dos', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await habilitarSensor(a.dispositivoTrasero);
      await fallaA(en(-10));
      await fallaA(en(-9));
      await pasada(en(-8));
      for (const minuto of [-7, -6]) {
        await informe(
          a,
          a.dispositivoTrasero,
          a.puertaTrasera,
          await apertura(a, a.dispositivoTrasero, a.puertaTrasera, en(minuto)),
          'fallida',
          'rele_no_accionado',
          en(minuto),
        );
      }
      await pasada(en(-5));
      const propia = await bandeja(adminA);
      expect(propia.meta.total).toBe(1);
      expect(propia.datos[0]?.cantidad).toBe(2);
      expect(propia.datos[0]?.datos.placas.map((p) => p.puerta_nombre).sort()).toEqual(
        [a.puertaPrincipal.nombre, a.puertaTrasera.nombre].sort(),
      );
    });

    it('una falla informada por la placa y otra por falta de respuesta suman', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await fallaA(en(-10));
      await aperturaA(en(-5));
      const resultado = await pasada(en(0));
      expect(resultado.evaluacion).toMatchObject({ constancias: 1, avisos: 2 });
    });

    it('con el sensor habilitado, `sin_sensor` cuenta como falla (la placa no ve su contacto); sin sensor, no', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      for (const minuto of [-8, -7, -6]) {
        await informe(
          a,
          a.dispositivoPrincipal,
          a.puertaPrincipal,
          await aperturaA(en(minuto)),
          'sin_confirmacion',
          'sin_sensor',
          en(minuto),
        );
      }
      const resultado = await pasada(en(0));
      expect(resultado.evaluacion.avisos).toBe(2);
      expect((await bandeja(adminA)).datos[0]?.datos.placas[0]).toMatchObject({
        fallos: 3,
        causa: 'sin_sensor',
      });
      // El informe se guardó tal cual lo dijo la placa: no se reescribe como sin_respuesta.
      expect(
        await contarFilas(prueba.pool, 'confirmaciones_apertura', "causa = 'sin_sensor'"),
      ).toBe(3);
    });

    it('una placa sin el sensor habilitado no entra al grupo por muchas fallas que tenga registradas', async () => {
      await fallaA(en(-10));
      await fallaA(en(-9));
      const resultado = await pasada(en(0));
      expect(resultado.evaluacion).toMatchObject({ avisos: 0, dispositivosActualizados: 0 });
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
    });

    it('si se deshabilita el sensor, la puerta sale del grupo y su aviso se cierra', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await fallaA(en(-10));
      await fallaA(en(-9));
      await pasada(en(-8));
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(1);
      await prueba.pool.query(
        'UPDATE dispositivos SET sensor_instalado = 0, sensor_habilitado_at = NULL WHERE id = ?',
        [a.dispositivoPrincipal.id],
      );
      await pasada(en(-7));
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
      expect((await bandeja(adminA)).datos[0]?.resuelta).toBe(true);
    });

    it('una apertura ejecutada después saca a la puerta del grupo y cierra el aviso', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await fallaA(en(-10));
      await fallaA(en(-9));
      await pasada(en(-8));
      expect((await bandeja(adminA)).datos[0]?.resuelta).toBe(false);

      await informe(
        a,
        a.dispositivoPrincipal,
        a.puertaPrincipal,
        await aperturaA(en(-3)),
        'ejecutada',
        'puerta_abrio',
        en(-3),
      );
      const resultado = await pasada(en(-2));
      expect(resultado.evaluacion.avisos).toBe(2);
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
      expect((await bandeja(adminA)).datos[0]).toMatchObject({
        tipo: 'apertura.fallida',
        resuelta: true,
      });
      expect((await bandeja(superAcceso, '/plataforma/notificaciones')).datos[0]?.resuelta).toBe(
        true,
      );
    });

    it('si las fallas salen de la ventana (60 min), el aviso se cierra solo', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await fallaA(en(-10));
      await fallaA(en(-9));
      await pasada(en(-8));
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(1);
      await pasada(en(40));
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(1);
      const resultado = await pasada(en(60));
      expect(resultado.evaluacion.dispositivosActualizados).toBe(1);
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
      expect((await bandeja(adminA)).datos[0]?.resuelta).toBe(true);
    });

    it('una confirmación TARDÍA de la placa se impone a la constancia y puede sacar a la puerta del grupo', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      const primero = await aperturaA(en(-6));
      const segundo = await aperturaA(en(-5));
      await pasada(en(0));
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(1);
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura', "origen = 'servidor'")).toBe(
        2,
      );

      // La placa estuvo sin red y recién ahora cuenta que el segundo sí abrió.
      await informe(
        a,
        a.dispositivoPrincipal,
        a.puertaPrincipal,
        segundo,
        'ejecutada',
        'puerta_abrio',
        en(1),
      );
      const resultado = await pasada(en(2));
      expect(resultado.evaluacion.avisos).toBe(2);
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
      expect(primero).not.toBe(segundo);
    });

    it('el mínimo y la ventana salen de la configuración de la plataforma', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 1 WHERE clave = 'apertura.fallidas_minimo'",
      );
      await habilitarSensor(a.dispositivoPrincipal);
      await fallaA(en(-3));
      expect((await pasada(en(-2))).evaluacion.avisos).toBe(2);
    });

    it('el plazo de confirmación sale de la configuración', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 600 WHERE clave = 'apertura.plazo_confirmacion_segundos'",
      );
      await habilitarSensor(a.dispositivoPrincipal);
      await aperturaA(en(-5));
      expect((await pasada(en(0))).evaluacion.constancias).toBe(0);
      expect((await pasada(en(6))).evaluacion.constancias).toBe(1);
    });

    it('una placa revocada sale del grupo y su aviso se cierra', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await fallaA(en(-10));
      await fallaA(en(-9));
      await pasada(en(-8));
      await prueba.pool.query('UPDATE dispositivos SET revocado_at = ? WHERE id = ?', [
        en(-7),
        a.dispositivoPrincipal.id,
      ]);
      await pasada(en(-6));
      expect(await enGrupo(a.dispositivoPrincipal.id)).toBe(0);
      expect((await bandeja(adminA)).datos[0]?.resuelta).toBe(true);
    });
  });

  describe('aislamiento y concurrencia', () => {
    it('la falla en A no toca la bandeja ni la cola de B, y cada aviso lleva su propia cuenta', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await habilitarSensor(b.dispositivoPrincipal);
      await fallaA(en(-10));
      await fallaA(en(-9));
      await pasada(en(-8));
      expect((await bandeja(adminB)).meta.total).toBe(0);
      expect(
        await contarFilas(prueba.pool, 'cola_de_notificaciones', 'tenant_id = ?', [b.cuenta.id]),
      ).toBe(0);
      expect(
        await contarFilas(prueba.pool, 'confirmaciones_apertura', 'tenant_id = ?', [b.cuenta.id]),
      ).toBe(0);

      // Ahora también falla B: cada cuenta ve solo lo suyo y AGROCOM ve ambas.
      for (const minuto of [-7, -6]) {
        const evento = await apertura(b, b.dispositivoPrincipal, b.puertaPrincipal, en(minuto));
        await informe(
          b,
          b.dispositivoPrincipal,
          b.puertaPrincipal,
          evento,
          'fallida',
          'puerta_no_abrio',
          en(minuto),
        );
      }
      await pasada(en(-5));
      const deB = await bandeja(adminB);
      expect(deB.datos.map((n) => n.cuenta_id)).toEqual([b.cuenta.id]);
      expect(deB.datos[0]?.datos.placas.map((p) => p.dispositivo_id)).toEqual([
        b.dispositivoPrincipal.id,
      ]);
      expect((await bandeja(adminA)).datos.map((n) => n.cuenta_id)).toEqual([a.cuenta.id]);
      const deAgrocom = await bandeja(superAcceso, '/plataforma/notificaciones');
      expect(deAgrocom.datos.map((n) => n.cuenta_id).sort()).toEqual(
        [a.cuenta.id, b.cuenta.id].sort(),
      );
    });

    it('un Miembro no recibe el aviso: solo el administrador de la cuenta (por permiso, no por nombre)', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await fallaA(en(-10));
      await fallaA(en(-9));
      await pasada(en(-8));
      const miembro = (await iniciarSesion(prueba.app, a.usuario.pin)).acceso;
      expect((await get('/notificaciones', miembro)).statusCode).toBe(403);
      expect(
        await contarFilas(prueba.pool, 'notificaciones', 'destinatario_id = ?', [a.usuario.id]),
      ).toBe(0);
    });

    it('dos pasadas simultáneas dejan UNA constancia por apertura y UN aviso', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await aperturaA(en(-5));
      await aperturaA(en(-4));
      await Promise.all([evaluar(prueba.pool, en(0)), evaluar(prueba.pool, en(0))]);
      await entregar(prueba.pool, en(0));
      expect(await contarFilas(prueba.pool, 'confirmaciones_apertura')).toBe(2);
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
      expect((await bandeja(adminA)).meta.total).toBe(1);
    });

    it('recorre todas las cuentas en una pasada, cada una en su propio contexto', async () => {
      await habilitarSensor(a.dispositivoPrincipal);
      await habilitarSensor(b.dispositivoPrincipal);
      await aperturaA(en(-5));
      await aperturaA(en(-4));
      await apertura(b, b.dispositivoPrincipal, b.puertaPrincipal, en(-5));
      const errores: unknown[] = [];
      const resultado = await evaluar(prueba.pool, en(0), (e) => errores.push(e));
      expect(errores).toEqual([]);
      expect(resultado).toMatchObject({ cuentas: 2, constancias: 3, errores: 0, ocupadas: 0 });
      expect(
        await contarFilas(prueba.pool, 'confirmaciones_apertura', 'tenant_id = ?', [a.cuenta.id]),
      ).toBe(2);
      expect(
        await contarFilas(prueba.pool, 'confirmaciones_apertura', 'tenant_id = ?', [b.cuenta.id]),
      ).toBe(1);
    });

    it('queda registrada como tarea periódica, con el reloj inyectado', async () => {
      const tarea = crearTareas(prueba.pool).find(
        (candidata) => candidata.nombre === 'aperturas-fallidas',
      );
      expect(tarea?.cadaMs).toBe(60_000);
      await habilitarSensor(a.dispositivoPrincipal);
      await aperturaA(en(-5));
      const errores: unknown[] = [];
      const resultado = (await tarea?.ejecutar(en(0), (e) => errores.push(e))) as {
        constancias: number;
      };
      expect(errores).toEqual([]);
      expect(resultado.constancias).toBe(1);
    });
  });

  it('el detector nunca abre ni cambia un evento ni un QR: solo agrega filas de confirmación', async () => {
    await habilitarSensor(a.dispositivoPrincipal);
    const evento = await aperturaA(en(-5));
    const antes = await filasDe('SELECT * FROM lecturas WHERE id = ?', [evento]);
    await pasada(en(0));
    expect(await filasDe('SELECT * FROM lecturas WHERE id = ?', [evento])).toEqual(antes);
    expect(await contarFilas(prueba.pool, 'lecturas')).toBe(1);
  });
});
