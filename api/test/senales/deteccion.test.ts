import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as entregar } from '../../src/modules/notificaciones/actions/entregar-pendientes.js';
import { ejecutar as detectarUsoMasivo } from '../../src/modules/senales/actions/detectar-uso-masivo.js';
import { crearTareas } from '../../src/tareas.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
  crearSuperAdmin,
  crearUsuarioConPin,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, iniciarSesionDePlataforma } from '../helpers/http.js';
import { aperturasPropias, evento, qrPropio, sesion } from '../helpers/senales.js';

/** 10-nov-2026 11:00 en La Paz (15:00 UTC): el día local arranca a las 04:00 UTC. */
const AHORA = new Date('2026-11-10T15:00:00.000Z');
const MIN = 60_000;
const HORA = 3_600_000;
const DIA = 24 * HORA;
const hace = (ms: number, desde: Date = AHORA) => new Date(desde.getTime() - ms);

interface Pasada {
  revisados: number;
  senales: number;
  omitidos: number;
  errores: number;
  ocupadas: number;
}

interface IncidenteFila extends RowDataPacket {
  id: string;
  tenant_id: string;
  usuario_id: string;
  tipo: string;
  gravedad: string;
  origen: string;
  descripcion: string | null;
  evidencia: string | { qr_ids: string[]; evento_acceso_ids: string[] };
  clave_unica: string;
}

interface Notificacion {
  tipo: string;
  severidad: string;
  cantidad: number;
  datos: {
    senal?: {
      tipo: string;
      usuario_id: string;
      gravedad: string;
      incidente_id: string | null;
      dia: string;
      valor: number;
      umbral: number;
    };
    bolsa?: { mes: string; dia: string; usado: number | null; tope: number | null };
    flujo?: {
      dia: string;
      aperturas: number;
      usuarios_activos: number;
      por_usuario: number;
      umbral_por_usuario: number;
      base: number | null;
    };
  };
}

describe('señales de abuso: detectores con reloj inyectado (ADR 0030 §4 y §5, W12)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let arbolB: Arbol;
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
    arbol = await armarArbol(prueba.pool, a);
    arbolB = await armarArbol(prueba.pool, b);
    adminA = (await iniciarSesion(prueba.app, a.administrador.pin)).acceso;
    adminB = (await iniciarSesion(prueba.app, b.administrador.pin)).acceso;
    const sa = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    superAcceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena)).acceso;
  });

  const tarea = async (nombre: string, ahora: Date = AHORA): Promise<Pasada> => {
    const t = crearTareas(prueba.pool).find((candidata) => candidata.nombre === nombre);
    expect(t, `tarea ${nombre}`).toBeDefined();
    const errores: unknown[] = [];
    const resultado = (await t?.ejecutar(ahora, (e) => errores.push(e))) as Pasada;
    expect(errores).toEqual([]);
    return resultado;
  };
  const filas = async <T extends RowDataPacket>(sql: string, params: unknown[] = []) =>
    (await prueba.pool.query<T[]>(sql, params))[0];
  const incidentes = () => filas<IncidenteFila>('SELECT * FROM incidentes_uso ORDER BY id');
  /** El primer incidente abierto; falla si no hay ninguno. */
  const primerIncidente = async (): Promise<IncidenteFila> => {
    const [primero] = await incidentes();
    if (primero === undefined) throw new Error('no se abrió ningún incidente');
    return primero;
  };
  const evidenciaDe = (fila: IncidenteFila) =>
    typeof fila.evidencia === 'string'
      ? (JSON.parse(fila.evidencia) as { qr_ids: string[]; evento_acceso_ids: string[] })
      : fila.evidencia;
  const colaDe = () =>
    filas('SELECT tenant_id, audiencia, canal, carga FROM cola_de_notificaciones ORDER BY id');
  const entregarTodo = (ahora: Date = AHORA) => entregar(prueba.pool, ahora);
  const bandeja = async (acceso: string, url = '/notificaciones') => {
    const r = await prueba.app.inject({
      method: 'GET',
      url: `/api/v1${url}`,
      headers: conUsuario({ acceso }),
    });
    expect(r.statusCode, r.body).toBe(200);
    return r.json<{ datos: Notificacion[] }>().datos;
  };
  const excepcion = (cuentaId: string, clave: string, valor: number, usuarioId: string | null) =>
    prueba.pool.query(
      'INSERT INTO excepciones_de_limite (tenant_id, usuario_id, clave, valor) VALUES (?, ?, ?, ?)',
      [cuentaId, usuarioId, clave, valor],
    );

  /** `n` aperturas con QR propios del usuario de la cuenta A, en la puerta principal. */
  const aperturasDe = (usuarioId: string, n: number, hasta: Date = AHORA) =>
    aperturasPropias(
      prueba.pool,
      a.cuenta,
      usuarioId,
      a.puertaPrincipal,
      a.dispositivoPrincipal.id,
      n,
      hasta,
    );

  it('las tareas de señales están registradas con su nombre y su período', () => {
    const tareas = crearTareas(prueba.pool);
    const nombres = [
      'senal-uso-masivo',
      'senal-uso-imposible',
      'senal-qr-reenviado',
      'senal-pin-compartido',
      'senal-bolsa',
      'senal-flujo-atipico',
    ];
    for (const nombre of nombres) {
      const t = tareas.find((candidata) => candidata.nombre === nombre);
      expect(t, nombre).toBeDefined();
      expect(t?.cadaMs).toBeGreaterThanOrEqual(300_000);
    }
  });

  describe('uso masivo: más de N aperturas con el QR propio en el día, N por nivel', () => {
    it('abre un incidente del sistema para el Guardia que pasa su N (12) y avisa a su Administrador y a AGROCOM', async () => {
      const ids = await aperturasDe(arbol.guardia.id, 13);
      expect(await tarea('senal-uso-masivo')).toEqual({
        revisados: 1,
        senales: 1,
        omitidos: 0,
        errores: 0,
        ocupadas: 0,
      });

      const incidente = await primerIncidente();
      expect(incidente).toMatchObject({
        tenant_id: a.cuenta.id,
        usuario_id: arbol.guardia.id,
        tipo: 'uso_masivo',
        gravedad: 'media',
        origen: 'sistema',
        descripcion: 'aperturas=13;umbral=12',
        clave_unica: `uso_masivo:${arbol.guardia.id}:2026-11-10`,
      });
      // La evidencia son ids de intentos: ni QR, ni token, ni hash.
      const evidencia = evidenciaDe(incidente);
      expect(evidencia.evento_acceso_ids.sort()).toEqual([...ids].sort());
      expect(evidencia.qr_ids).toEqual([]);

      // Un aviso para quien administra su rama (su Administrador) y otro para AGROCOM.
      const cola = await colaDe();
      expect(cola).toHaveLength(2);
      expect(cola.map((fila) => String(fila.audiencia)).sort()).toEqual(['cuenta', 'plataforma']);
      expect(cola.every((fila) => String(fila.tenant_id) === a.cuenta.id)).toBe(true);

      await entregarTodo();
      const deAdmin = await bandeja(adminA);
      expect(deAdmin).toHaveLength(1);
      expect(deAdmin[0]).toMatchObject({
        tipo: 'senal.uso',
        severidad: 'aviso',
        datos: {
          senal: {
            tipo: 'uso_masivo',
            usuario_id: arbol.guardia.id,
            gravedad: 'media',
            incidente_id: incidente.id,
            dia: '2026-11-10',
            valor: 13,
            umbral: 12,
          },
        },
      });
      expect(await bandeja(superAcceso, '/plataforma/notificaciones')).toHaveLength(1);
      // El otro propietario no ve nada de la cuenta A.
      expect(await bandeja(adminB)).toEqual([]);
    });

    it('el uso normal no dispara: exactamente N, otro nivel con su N más alto, QR de otros o pulsador', async () => {
      await aperturasDe(arbol.guardia.id, 12); // «más de N»: con N todavía es normal
      await aperturasDe(arbol.titular1.id, 13); // N del Titular = 30
      // 13 aperturas con QR que NO son propios (los que el usuario genera para visitas los usan otros).
      for (let i = 0; i < 13; i++) {
        const qr = await crearQr(prueba.pool, a.cuenta, arbol.miembro1.id, [a.puertaPrincipal.id], {
          usadoAt: hace(i * MIN),
        });
        await evento(prueba.pool, a.cuenta, {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: a.dispositivoPrincipal.id,
          qrId: qr.id,
          cuando: hace(i * MIN),
        });
      }
      // Pulsador de salida: no es una apertura por QR.
      for (let i = 0; i < 20; i++) {
        await evento(prueba.pool, a.cuenta, {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: null,
          metodo: 'pulsador',
          cuando: hace(i * MIN),
        });
      }
      expect(await tarea('senal-uso-masivo')).toMatchObject({ senales: 0, errores: 0 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
    });

    it('cada nivel tiene su N: el Titular dispara con 31, no con 30', async () => {
      await aperturasDe(arbol.titular1.id, 30);
      expect(await tarea('senal-uso-masivo')).toMatchObject({ senales: 0 });
      await aperturasDe(arbol.titular1.id, 1, hace(40 * MIN));
      expect(await tarea('senal-uso-masivo')).toMatchObject({ senales: 1 });
      expect((await incidentes())[0]).toMatchObject({ usuario_id: arbol.titular1.id });
    });

    it('la gravedad sube a alta desde el triple del N', async () => {
      await aperturasDe(arbol.guardia.id, 36);
      await tarea('senal-uso-masivo');
      expect((await incidentes())[0]).toMatchObject({ gravedad: 'alta' });
      await entregarTodo();
      expect((await bandeja(adminA))[0]).toMatchObject({ severidad: 'critica' });
    });

    it('es idempotente por usuario y día: volver a correrlo no duplica incidente ni aviso', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      await tarea('senal-uso-masivo');
      const otra = await tarea('senal-uso-masivo', new Date(AHORA.getTime() + 10 * MIN));
      expect(otra).toMatchObject({ revisados: 1, senales: 0, omitidos: 1 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
      expect(await contarFilas(prueba.pool, 'avisos_de_senal')).toBe(1);
    });

    it('el día siguiente, si persiste, abre otro incidente pero ACTUALIZA el mismo aviso abierto', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      await tarea('senal-uso-masivo');
      await entregarTodo();
      const manana = new Date(AHORA.getTime() + DIA);
      await aperturasDe(arbol.guardia.id, 13, manana);
      expect(await tarea('senal-uso-masivo', manana)).toMatchObject({ senales: 1 });
      await entregarTodo(manana);

      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(2);
      const deAdmin = await bandeja(adminA);
      expect(deAdmin).toHaveLength(1);
      expect(deAdmin[0]?.datos.senal?.dia).toBe('2026-11-11');
    });

    it('lo de antier no cuenta hoy', async () => {
      await aperturasDe(arbol.guardia.id, 13, hace(2 * DIA));
      expect(await tarea('senal-uso-masivo')).toMatchObject({ revisados: 0, senales: 0 });
    });

    it('revisa también AYER: lo que cruzó el N justo antes de medianoche no se pierde', async () => {
      // 23:55 del 9-nov en La Paz (03:55 UTC del 10): las 13 aperturas son de ayer; la pasada corre a las 00:05 locales.
      await aperturasDe(arbol.guardia.id, 13, new Date('2026-11-10T03:55:00.000Z'));
      const pasada = new Date('2026-11-10T04:05:00.000Z');
      expect(await tarea('senal-uso-masivo', pasada)).toMatchObject({ revisados: 1, senales: 1 });
      expect((await primerIncidente()).clave_unica).toBe(
        `uso_masivo:${arbol.guardia.id}:2026-11-09`,
      );
      // Idempotente: otra pasada no lo repite.
      expect(await tarea('senal-uso-masivo', new Date(pasada.getTime() + 5 * MIN))).toMatchObject({
        senales: 0,
        omitidos: 1,
      });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
    });

    it('tope por pasada: en una avalancha corta la pasada y la siguiente sigue con el resto', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      await aperturasDe(arbol.titular1.id, 31);
      const errores: unknown[] = [];
      const pasar = (ahora: Date) =>
        detectarUsoMasivo(prueba.pool, ahora, (e) => errores.push(e), 500, 1);
      // Con tope de 1 señal por pasada: la primera abre una; la segunda omite esa y abre la otra.
      expect(await pasar(AHORA)).toMatchObject({ senales: 1 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
      expect(await pasar(new Date(AHORA.getTime() + MIN))).toMatchObject({
        senales: 1,
        omitidos: 1,
      });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(2);
      expect(await pasar(new Date(AHORA.getTime() + 2 * MIN))).toMatchObject({
        senales: 0,
        omitidos: 2,
      });
      expect(errores).toEqual([]);
    });

    it('cuenta TODAS las filas, también las repeticiones de un mismo intento (ADR 0032 §4.3)', async () => {
      const qr = await qrPropio(
        prueba.pool,
        a.cuenta,
        arbol.guardia.id,
        [a.puertaPrincipal.id],
        AHORA,
      );
      for (let i = 0; i < 13; i++) {
        await evento(prueba.pool, a.cuenta, {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: a.dispositivoPrincipal.id,
          qrId: qr.id,
          cuando: hace(i * 1000),
        });
      }
      expect(await tarea('senal-uso-masivo')).toMatchObject({ senales: 1 });
    });

    it('una excepción de usuario sube su N; una de cuenta lo baja para todos', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      await excepcion(a.cuenta.id, 'senal.uso_masivo_guardia', 50, arbol.guardia.id);
      expect(await tarea('senal-uso-masivo')).toMatchObject({ senales: 0, omitidos: 1 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);

      // Una excepción de la cuenta B que BAJA el N no deja a su usuario sin revisar (busca con el piso más bajo).
      await excepcion(b.cuenta.id, 'senal.uso_masivo_guardia', 5, null);
      await aperturasPropias(
        prueba.pool,
        b.cuenta,
        arbolB.guardia.id,
        b.puertaPrincipal,
        b.dispositivoPrincipal.id,
        6,
        AHORA,
      );
      expect(await tarea('senal-uso-masivo')).toMatchObject({ senales: 1 });
      const incidente = await primerIncidente();
      expect(incidente).toMatchObject({ tenant_id: b.cuenta.id, usuario_id: arbolB.guardia.id });
    });

    it('cada cuenta cuenta lo suyo: aislamiento entre cuentas', async () => {
      await aperturasDe(arbol.guardia.id, 8);
      await aperturasPropias(
        prueba.pool,
        b.cuenta,
        arbolB.guardia.id,
        b.puertaPrincipal,
        b.dispositivoPrincipal.id,
        13,
        AHORA,
      );
      await tarea('senal-uso-masivo');
      const lista = await incidentes();
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({ tenant_id: b.cuenta.id, usuario_id: arbolB.guardia.id });
      const cola = await colaDe();
      expect(cola.every((fila) => String(fila.tenant_id) === b.cuenta.id)).toBe(true);
      await entregarTodo();
      expect(await bandeja(adminA)).toEqual([]);
      expect(await bandeja(adminB)).toHaveLength(1);
    });

    it('si otra pasada tiene el bloqueo de la cuenta, el aviso espera: queda el incidente y la próxima pasada lo completa', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      const otra = await prueba.pool.getConnection();
      try {
        await otra.query('SELECT GET_LOCK(?, 0)', [`senales:${a.cuenta.id}`]);
        expect(await tarea('senal-uso-masivo')).toMatchObject({
          revisados: 1,
          senales: 0,
          ocupadas: 1,
          errores: 0,
        });
        // El incidente ya está (idempotente por su clave), pero aún no hay aviso ni constancia.
        expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
        expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
        expect(await contarFilas(prueba.pool, 'avisos_de_senal')).toBe(0);
      } finally {
        await otra.query('DO RELEASE_LOCK(?)', [`senales:${a.cuenta.id}`]);
        otra.release();
      }
      expect(await tarea('senal-uso-masivo', new Date(AHORA.getTime() + MIN))).toMatchObject({
        senales: 1,
        ocupadas: 0,
      });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
    });

    it('si la pasada cayó entre el incidente y el aviso, el aviso de la siguiente pasada lleva el enlace al incidente', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      const otra = await prueba.pool.getConnection();
      try {
        await otra.query('SELECT GET_LOCK(?, 0)', [`senales:${a.cuenta.id}`]);
        await tarea('senal-uso-masivo');
      } finally {
        await otra.query('DO RELEASE_LOCK(?)', [`senales:${a.cuenta.id}`]);
        otra.release();
      }
      // Quedó el incidente, sin aviso: la siguiente pasada recibe `null` al registrarlo de nuevo y debe recuperar su id.
      const incidente = await primerIncidente();
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
      await tarea('senal-uso-masivo', new Date(AHORA.getTime() + MIN));
      await entregarTodo(new Date(AHORA.getTime() + MIN));
      const avisos = await bandeja(superAcceso, '/plataforma/notificaciones');
      expect(avisos).toHaveLength(1);
      expect(avisos[0]?.datos.senal?.incidente_id).toBe(incidente.id);
    });

    it('dos pasadas a la vez (dos instancias) no duplican incidente, constancia ni aviso', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      await Promise.all([tarea('senal-uso-masivo'), tarea('senal-uso-masivo')]);
      await tarea('senal-uso-masivo', new Date(AHORA.getTime() + MIN));
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
      expect(await contarFilas(prueba.pool, 'avisos_de_senal')).toBe(1);
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
    });

    it('a quien ya no opera (suspendido o dado de baja) no se le abre nada, sin error', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba', estado_impuesto_por = ? WHERE id = ?",
        [a.administrador.id, arbol.guardia.id],
      );
      expect(await tarea('senal-uso-masivo')).toMatchObject({
        senales: 0,
        omitidos: 1,
        errores: 0,
      });
      await prueba.pool.query('UPDATE usuarios SET deleted_at = NOW(3) WHERE id = ?', [
        arbol.guardia.id,
      ]);
      expect(await tarea('senal-uso-masivo')).toMatchObject({ senales: 0, errores: 0 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('un Administrador no tiene superior en la cuenta: el aviso va solo a AGROCOM', async () => {
      await aperturasDe(a.administrador.id, 41);
      expect(await tarea('senal-uso-masivo')).toMatchObject({ senales: 1 });
      expect((await colaDe()).map((fila) => String(fila.audiencia))).toEqual(['plataforma']);
    });

    it('recorre TODOS los hallazgos con cursor aunque la página sea chica', async () => {
      const otros = [arbol.guardia, arbol.miembro1, arbol.miembro2];
      await aperturasDe(arbol.guardia.id, 13);
      await aperturasDe(arbol.miembro1.id, 21);
      await aperturasDe(arbol.miembro2.id, 21);
      const { ejecutar } = await import('../../src/modules/senales/actions/detectar-uso-masivo.js');
      const resultado = await ejecutar(prueba.pool, AHORA, () => undefined, 1);
      expect(resultado).toMatchObject({ revisados: 3, senales: 3, errores: 0 });
      expect(new Set((await incidentes()).map((i) => i.usuario_id))).toEqual(
        new Set(otros.map((u) => u.id)),
      );
    });
  });

  describe('uso imposible: el QR propio usado en puertas que no alcanzan a recorrerse', () => {
    async function dosSitios() {
      const { crearPuerta, crearDispositivo, crearSitio } = await import('../helpers/fixtures.js');
      const sitio2 = await crearSitio(prueba.pool, a.cuenta, 'Sitio lejano');
      const puerta2 = await crearPuerta(prueba.pool, a.cuenta, sitio2, 'Puerta lejana');
      const dispositivo2 = await crearDispositivo(prueba.pool, a.cuenta, puerta2.id);
      return { puerta2, dispositivo2 };
    }
    const uso = async (
      usuarioId: string,
      puertaId: string,
      dispositivoId: string,
      cuando: Date,
    ) => {
      const qr = await qrPropio(prueba.pool, a.cuenta, usuarioId, [puertaId], cuando);
      return evento(prueba.pool, a.cuenta, { puertaId, dispositivoId, qrId: qr.id, cuando });
    };

    it('dos usos en sitios distintos con 5 minutos de diferencia: incidente de gravedad alta y aviso', async () => {
      const { puerta2, dispositivo2 } = await dosSitios();
      const e1 = await uso(
        arbol.miembro1.id,
        a.puertaPrincipal.id,
        a.dispositivoPrincipal.id,
        hace(30 * MIN),
      );
      const e2 = await uso(arbol.miembro1.id, puerta2.id, dispositivo2.id, hace(25 * MIN));
      expect(await tarea('senal-uso-imposible')).toMatchObject({ revisados: 1, senales: 1 });
      const incidente = await primerIncidente();
      expect(incidente).toMatchObject({
        usuario_id: arbol.miembro1.id,
        tipo: 'uso_imposible',
        gravedad: 'alta',
        origen: 'sistema',
      });
      expect(evidenciaDe(incidente).evento_acceso_ids.sort()).toEqual([e1, e2].sort());
      // Su rama: el Titular no recibe avisos de la cuenta (no tiene el permiso); sí su Administrador.
      await entregarTodo();
      expect(await bandeja(adminA)).toHaveLength(1);
      expect((await bandeja(adminA))[0]).toMatchObject({ severidad: 'critica' });
    });

    it('sitios distintos con más de 10 minutos de diferencia es un recorrido posible: no dispara', async () => {
      const { puerta2, dispositivo2 } = await dosSitios();
      await uso(arbol.miembro1.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, hace(60 * MIN));
      await uso(arbol.miembro1.id, puerta2.id, dispositivo2.id, hace(40 * MIN));
      expect(await tarea('senal-uso-imposible')).toMatchObject({ revisados: 0, senales: 0 });
    });

    it('dos puertas del mismo sitio: 10 s dispara, 30 s no (umbral de 20 s)', async () => {
      await uso(arbol.guardia.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, hace(60 * MIN));
      await uso(
        arbol.guardia.id,
        a.puertaTrasera.id,
        a.dispositivoTrasero.id,
        hace(60 * MIN - 30_000),
      );
      expect(await tarea('senal-uso-imposible')).toMatchObject({ revisados: 0 });
      await uso(arbol.miembro1.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, hace(50 * MIN));
      await uso(
        arbol.miembro1.id,
        a.puertaTrasera.id,
        a.dispositivoTrasero.id,
        hace(50 * MIN - 10_000),
      );
      expect(await tarea('senal-uso-imposible')).toMatchObject({ revisados: 1, senales: 1 });
    });

    it('con el umbral del mismo sitio en 0 solo se juzgan sitios distintos', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 0 WHERE clave = 'senal.uso_imposible_entre_puertas_segundos'",
      );
      await uso(arbol.miembro1.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, hace(50 * MIN));
      await uso(arbol.miembro1.id, a.puertaTrasera.id, a.dispositivoTrasero.id, hace(50 * MIN));
      expect(await tarea('senal-uso-imposible')).toMatchObject({ revisados: 0 });
    });

    it('la misma puerta, otro usuario o un QR que no es propio no son uso imposible', async () => {
      const { puerta2, dispositivo2 } = await dosSitios();
      // misma puerta dos veces seguidas
      await uso(arbol.miembro1.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, hace(30 * MIN));
      await uso(arbol.miembro1.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, hace(29 * MIN));
      // dos usuarios distintos, una cada uno
      await uso(
        arbol.miembro1b.id,
        a.puertaPrincipal.id,
        a.dispositivoPrincipal.id,
        hace(20 * MIN),
      );
      await uso(arbol.miembro2.id, puerta2.id, dispositivo2.id, hace(19 * MIN));
      // QR de visitas (no propios) del mismo usuario en dos sitios a la vez
      for (const [puerta, dispositivo] of [
        [a.puertaPrincipal.id, a.dispositivoPrincipal.id],
        [puerta2.id, dispositivo2.id],
      ] as const) {
        const qr = await crearQr(prueba.pool, a.cuenta, arbol.titular2.id, [puerta], {
          usadoAt: hace(10 * MIN),
        });
        await evento(prueba.pool, a.cuenta, {
          puertaId: puerta,
          dispositivoId: dispositivo,
          qrId: qr.id,
          cuando: hace(10 * MIN),
        });
      }
      expect(await tarea('senal-uso-imposible')).toMatchObject({ revisados: 0, senales: 0 });
    });

    it('es idempotente por día', async () => {
      const { puerta2, dispositivo2 } = await dosSitios();
      await uso(arbol.miembro1.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, hace(30 * MIN));
      await uso(arbol.miembro1.id, puerta2.id, dispositivo2.id, hace(29 * MIN));
      await tarea('senal-uso-imposible');
      expect(await tarea('senal-uso-imposible', new Date(AHORA.getTime() + 5 * MIN))).toMatchObject(
        {
          senales: 0,
          omitidos: 1,
        },
      );
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
    });
  });

  describe('QR reenviado: un QR ya usado que sigue llegando a los lectores', () => {
    async function qrUsado(generadorId: string) {
      return qrPropio(prueba.pool, a.cuenta, generadorId, [a.puertaPrincipal.id], hace(2 * HORA));
    }
    const rechazo = (qrId: string, dispositivoId: string, puertaId: string, cuando: Date) =>
      evento(prueba.pool, a.cuenta, {
        puertaId,
        dispositivoId,
        qrId,
        resultado: 'rechazado',
        motivo: 'qr.usado',
        cuando,
      });

    it('tres lectores distintos: gravedad alta, con el QR y los intentos como evidencia', async () => {
      const qr = await qrUsado(arbol.miembro1.id);
      const ids = [
        await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(30 * MIN)),
        await rechazo(qr.id, a.dispositivoTrasero.id, a.puertaTrasera.id, hace(20 * MIN)),
      ];
      // Un tercer lector: otra puerta con su dispositivo.
      const { crearPuerta, crearDispositivo } = await import('../helpers/fixtures.js');
      const p3 = await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Lateral');
      const d3 = await crearDispositivo(prueba.pool, a.cuenta, p3.id);
      ids.push(await rechazo(qr.id, d3.id, p3.id, hace(10 * MIN)));
      expect(await tarea('senal-qr-reenviado')).toMatchObject({ revisados: 1, senales: 1 });
      const incidente = await primerIncidente();
      expect(incidente).toMatchObject({
        usuario_id: arbol.miembro1.id,
        tipo: 'qr_reenviado',
        gravedad: 'alta',
        origen: 'sistema',
      });
      const evidencia = evidenciaDe(incidente);
      expect(evidencia.qr_ids).toEqual([qr.id]);
      expect(evidencia.evento_acceso_ids.sort()).toEqual([...ids].sort());
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
    });

    it('dos lectores y tres rechazos: gravedad media y avisa', async () => {
      const qr = await qrUsado(arbol.miembro1.id);
      await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(30 * MIN));
      await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(29 * MIN));
      await rechazo(qr.id, a.dispositivoTrasero.id, a.puertaTrasera.id, hace(10 * MIN));
      await tarea('senal-qr-reenviado');
      expect((await incidentes())[0]).toMatchObject({ gravedad: 'media' });
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
    });

    it('un solo lector que relee tres veces es uso normal: no dispara', async () => {
      const qr = await qrUsado(arbol.miembro1.id);
      for (let i = 0; i < 3; i++) {
        await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(i * 1000));
      }
      expect(await tarea('senal-qr-reenviado')).toMatchObject({ senales: 0, omitidos: 1 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('los repetidos cuentan: un lector que insiste 9 veces deja constancia baja, sin aviso', async () => {
      const qr = await qrUsado(arbol.miembro1.id);
      for (let i = 0; i < 9; i++) {
        await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(i * 1000));
      }
      expect(await tarea('senal-qr-reenviado')).toMatchObject({ senales: 1 });
      expect((await incidentes())[0]).toMatchObject({ gravedad: 'baja' });
      // La gravedad baja no se avisa (ADR 0030 §4.1), pero la constancia evita repetirlo.
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
      expect(await contarFilas(prueba.pool, 'avisos_de_senal')).toBe(1);
    });

    it('otros motivos de rechazo, rechazos viejos y por debajo del mínimo no cuentan', async () => {
      const qr = await qrUsado(arbol.miembro1.id);
      for (const motivo of ['qr.vencido', 'qr.anulado', 'qr.otra_puerta']) {
        for (let i = 0; i < 4; i++) {
          await evento(prueba.pool, a.cuenta, {
            puertaId: a.puertaPrincipal.id,
            dispositivoId: a.dispositivoPrincipal.id,
            qrId: qr.id,
            resultado: 'rechazado',
            motivo,
            cuando: hace(i * MIN),
          });
        }
      }
      // tres rechazos qr.usado, pero hace dos días (fuera de la ventana de 24 h)
      for (let i = 0; i < 3; i++) {
        await rechazo(qr.id, a.dispositivoTrasero.id, a.puertaTrasera.id, hace(2 * DIA + i * MIN));
      }
      // dos rechazos de lectores distintos: bajo el mínimo
      const qr2 = await qrUsado(arbol.miembro1b.id);
      await rechazo(qr2.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(MIN));
      await rechazo(qr2.id, a.dispositivoTrasero.id, a.puertaTrasera.id, hace(2 * MIN));
      expect(await tarea('senal-qr-reenviado')).toMatchObject({ revisados: 0, senales: 0 });
    });

    it('un solo incidente por generador y día aunque reenvíe varios QR, y es idempotente', async () => {
      for (let n = 0; n < 2; n++) {
        const qr = await qrUsado(arbol.miembro1.id);
        for (let i = 0; i < 3; i++) {
          await rechazo(
            qr.id,
            i % 2 === 0 ? a.dispositivoPrincipal.id : a.dispositivoTrasero.id,
            i % 2 === 0 ? a.puertaPrincipal.id : a.puertaTrasera.id,
            hace((n * 10 + i) * MIN),
          );
        }
      }
      // También con una página de un solo hallazgo: el generador se une antes de juzgarlo.
      const { ejecutar } =
        await import('../../src/modules/senales/actions/detectar-qr-reenviado.js');
      expect(await ejecutar(prueba.pool, AHORA, () => undefined, 1)).toMatchObject({
        revisados: 1,
        senales: 1,
      });
      expect(evidenciaDe(await primerIncidente()).qr_ids).toHaveLength(2);
      expect(await tarea('senal-qr-reenviado')).toMatchObject({ senales: 0, omitidos: 1 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
    });

    it('QR de otra cuenta no se mezclan: cada generador en la suya', async () => {
      const qr = await qrUsado(arbol.miembro1.id);
      await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(MIN));
      await rechazo(qr.id, a.dispositivoTrasero.id, a.puertaTrasera.id, hace(2 * MIN));
      await rechazo(qr.id, a.dispositivoTrasero.id, a.puertaTrasera.id, hace(3 * MIN));
      const qrB = await qrPropio(
        prueba.pool,
        b.cuenta,
        arbolB.miembro1.id,
        [b.puertaPrincipal.id],
        hace(HORA),
      );
      await evento(prueba.pool, b.cuenta, {
        puertaId: b.puertaPrincipal.id,
        dispositivoId: b.dispositivoPrincipal.id,
        qrId: qrB.id,
        resultado: 'rechazado',
        cuando: hace(MIN),
      });
      await tarea('senal-qr-reenviado');
      const lista = await incidentes();
      expect(lista).toHaveLength(1);
      expect(lista[0]?.tenant_id).toBe(a.cuenta.id);
    });
  });

  describe('PIN compartido: sesiones activas desde muchas IP distintas', () => {
    const activa = (usuarioId: string, ip: string, hace_ms: number = HORA) =>
      sesion(prueba.pool, a.cuenta, usuarioId, {
        ip,
        actividad: hace(hace_ms),
        expira: new Date(AHORA.getTime() + 7 * DIA),
      });

    it('4 IP distintas: incidente de gravedad media y aviso, sin la IP en ninguna parte', async () => {
      for (const ip of ['190.1.1.1', '190.1.1.2', '190.1.1.3', '2800:cd0::1']) {
        await activa(arbol.guardia.id, ip);
      }
      expect(await tarea('senal-pin-compartido')).toMatchObject({ revisados: 1, senales: 1 });
      const incidente = await primerIncidente();
      expect(incidente).toMatchObject({
        usuario_id: arbol.guardia.id,
        tipo: 'pin_compartido',
        gravedad: 'media',
        origen: 'sistema',
        descripcion: 'ips=4;sesiones=4;umbral=4',
      });
      await entregarTodo();
      const salida = JSON.stringify([
        incidente,
        await bandeja(adminA),
        await bandeja(superAcceso, '/plataforma/notificaciones'),
        await colaDe(),
      ]);
      expect(salida).not.toMatch(/190\.1\.1|2800:cd0/);
    });

    it('el uso normal no dispara: tres aparatos, mismas IP repetidas, sesiones cerradas o inactivas', async () => {
      // tres IP distintas (teléfono, tablet y navegador)
      for (const ip of ['190.1.1.1', '190.1.1.2', '190.1.1.3']) await activa(arbol.guardia.id, ip);
      // muchas sesiones pero desde una sola IP (todos en la misma red)
      for (let i = 0; i < 6; i++) await activa(arbol.miembro1.id, '181.0.0.9');
      // 4 IP pero revocadas
      for (const ip of ['1.1.1.1', '1.1.1.2', '1.1.1.3', '1.1.1.4']) {
        await sesion(prueba.pool, a.cuenta, arbol.miembro2.id, {
          ip,
          actividad: hace(HORA),
          expira: new Date(AHORA.getTime() + DIA),
          revocada: hace(30 * MIN),
        });
      }
      // 4 IP vivas pero sin actividad desde hace tres días
      for (const ip of ['2.2.2.1', '2.2.2.2', '2.2.2.3', '2.2.2.4']) {
        await activa(arbol.miembro1b.id, ip, 3 * DIA);
      }
      // 4 IP pero con la sesión ya vencida
      for (const ip of ['3.3.3.1', '3.3.3.2', '3.3.3.3', '3.3.3.4']) {
        await sesion(prueba.pool, a.cuenta, arbol.titular2.id, {
          ip,
          actividad: hace(HORA),
          expira: hace(MIN),
        });
      }
      expect(await tarea('senal-pin-compartido')).toMatchObject({ revisados: 0, senales: 0 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('es idempotente por día, respeta la excepción de la cuenta y no mezcla cuentas', async () => {
      for (const ip of ['1.1.1.1', '1.1.1.2', '1.1.1.3', '1.1.1.4']) {
        await activa(arbol.guardia.id, ip);
      }
      await tarea('senal-pin-compartido');
      expect(await tarea('senal-pin-compartido', new Date(AHORA.getTime() + MIN))).toMatchObject({
        senales: 0,
        omitidos: 1,
      });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);

      // La cuenta B tiene la misma dispersión pero AGROCOM subió su mínimo a 6.
      await excepcion(b.cuenta.id, 'senal.pin_compartido_ips_minimo', 6, null);
      for (const ip of ['9.9.9.1', '9.9.9.2', '9.9.9.3', '9.9.9.4']) {
        await sesion(prueba.pool, b.cuenta, arbolB.guardia.id, {
          ip,
          actividad: hace(HORA),
          expira: new Date(AHORA.getTime() + DIA),
        });
      }
      expect(
        await tarea('senal-pin-compartido', new Date(AHORA.getTime() + 2 * MIN)),
      ).toMatchObject({
        senales: 0,
        omitidos: 2,
      });
      expect((await incidentes()).map((i) => i.tenant_id)).toEqual([a.cuenta.id]);
    });
  });

  describe('flujo atípico de la cuenta: aperturas por usuario activo muy por encima de lo habitual', () => {
    /** `n` aperturas en el día de `hasta`, repartidas entre los usuarios dados, con QR de visitas. */
    async function flujo(n: number, hasta: Date = AHORA) {
      for (let i = 0; i < n; i++) {
        await evento(prueba.pool, a.cuenta, {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: a.dispositivoPrincipal.id,
          cuando: new Date(hasta.getTime() - i * 5_000),
        });
      }
    }
    /** La cuenta A solo tiene al administrador y 7 más del árbol: se deja con pocos usuarios activos. */
    async function dejarUsuarios(total: number) {
      const [lista] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT id FROM usuarios WHERE tenant_id = ? ORDER BY id',
        [a.cuenta.id],
      );
      for (const fila of lista.slice(total)) {
        await prueba.pool.query(
          "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba', estado_impuesto_por = ? WHERE id = ?",
          [a.administrador.id, fila.id],
        );
      }
    }

    it('un plan chico con 60 aperturas entre 2 usuarios (30 por usuario) avisa al propietario y a AGROCOM', async () => {
      await dejarUsuarios(2);
      await flujo(60);
      expect(await tarea('senal-flujo-atipico')).toMatchObject({ revisados: 1, senales: 1 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
      expect((await colaDe()).map((fila) => String(fila.audiencia)).sort()).toEqual([
        'cuenta',
        'plataforma',
      ]);
      await entregarTodo();
      const [aviso] = await bandeja(adminA);
      expect(aviso).toMatchObject({
        tipo: 'flujo.atipico',
        severidad: 'aviso',
        datos: {
          flujo: {
            dia: '2026-11-10',
            aperturas: 60,
            usuarios_activos: 2,
            por_usuario: 30,
            umbral_por_usuario: 25,
            base: null,
          },
        },
      });
      expect(await bandeja(superAcceso, '/plataforma/notificaciones')).toHaveLength(1);
      expect(await bandeja(adminB)).toEqual([]);
    });

    it('uso normal: pocas aperturas, o muchas pero repartidas entre muchos usuarios, no disparan', async () => {
      await dejarUsuarios(2);
      await flujo(49); // bajo el mínimo de 50 aperturas
      expect(await tarea('senal-flujo-atipico')).toMatchObject({ revisados: 0, senales: 0 });
      // Una cuenta con 8 usuarios y 60 aperturas: 7,5 por usuario, un tráfico normal.
      await flujo(60);
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'activo', estado_desde = NULL, estado_motivo = NULL, estado_impuesto_por = NULL WHERE tenant_id = ?",
        [a.cuenta.id],
      );
      expect(await tarea('senal-flujo-atipico')).toMatchObject({
        revisados: 1,
        senales: 0,
        omitidos: 1,
      });
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
    });

    it('el pulsador y los rechazos no son flujo de aperturas por QR', async () => {
      await dejarUsuarios(2);
      for (let i = 0; i < 80; i++) {
        await evento(prueba.pool, a.cuenta, {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: null,
          metodo: i % 2 === 0 ? 'pulsador' : 'qr',
          resultado: i % 2 === 0 ? 'permitido' : 'rechazado',
          cuando: hace((i * MIN) / 2),
        });
      }
      expect(await tarea('senal-flujo-atipico')).toMatchObject({ revisados: 0 });
    });

    it('cuenta las repeticiones de un mismo intento (ADR 0032 §4.3)', async () => {
      await dejarUsuarios(2);
      const qr = await qrPropio(
        prueba.pool,
        a.cuenta,
        a.administrador.id,
        [a.puertaPrincipal.id],
        AHORA,
      );
      for (let i = 0; i < 60; i++) {
        await evento(prueba.pool, a.cuenta, {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: a.dispositivoPrincipal.id,
          qrId: qr.id,
          cuando: hace(i * 1000),
        });
      }
      expect(await tarea('senal-flujo-atipico')).toMatchObject({ senales: 1 });
    });

    it('avisa una vez por día; al día siguiente actualiza el MISMO aviso; y respeta la excepción de la cuenta', async () => {
      await dejarUsuarios(2);
      await flujo(60);
      await tarea('senal-flujo-atipico');
      expect(
        await tarea('senal-flujo-atipico', new Date(AHORA.getTime() + 15 * MIN)),
      ).toMatchObject({
        senales: 0,
        omitidos: 1,
      });
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
      await entregarTodo();

      const manana = new Date(AHORA.getTime() + DIA);
      await flujo(60, manana);
      expect(await tarea('senal-flujo-atipico', manana)).toMatchObject({ senales: 1 });
      await entregarTodo(manana);
      const deAdmin = await bandeja(adminA);
      expect(deAdmin).toHaveLength(1);
      expect(deAdmin[0]?.datos.flujo?.dia).toBe('2026-11-11');

      // AGROCOM sube el mínimo de la cuenta: el mismo flujo deja de ser atípico.
      await excepcion(a.cuenta.id, 'senal.flujo_aperturas_por_usuario', 100, null);
      const pasado = new Date(manana.getTime() + DIA);
      await flujo(60, pasado);
      // Revisa hoy y ayer: el de ayer ya estaba avisado y el de hoy ya no cruza el umbral de la cuenta.
      expect(await tarea('senal-flujo-atipico', pasado)).toMatchObject({ senales: 0, omitidos: 2 });
    });

    it('revisa también el día anterior: no se pierde lo que cruzó el umbral antes de medianoche', async () => {
      await dejarUsuarios(2);
      // Ayer 23:50 hora local = hoy 03:50 UTC.
      const ayerTarde = new Date('2026-11-10T03:50:00.000Z');
      await flujo(60, ayerTarde);
      expect(await tarea('senal-flujo-atipico')).toMatchObject({ senales: 1 });
      const [aviso] = await filas<RowDataPacket>(
        'SELECT carga FROM cola_de_notificaciones LIMIT 1',
      );
      expect(JSON.stringify(aviso?.carga)).toContain('2026-11-09');
    });
  });

  describe('bolsa mensual: de la marca de la generación a la bandeja del propietario y de AGROCOM', () => {
    const marca = async (
      tipo: 'bolsa.aviso' | 'bolsa.superada',
      claveUnica: string,
      cuando: Date,
      escenario: Escenario = a,
      usuarioId: string = arbol.miembro1.id,
    ) => {
      const { marcaDeBolsa } = await import('../helpers/senales.js');
      return marcaDeBolsa(prueba.pool, escenario.cuenta, usuarioId, {
        tipo,
        claveUnica,
        cuando,
        valor: tipo === 'bolsa.aviso' ? 4000 : 5001,
        tope: 5000,
      });
    };

    it('el 80 % llega al propietario de la cuenta y a AGROCOM, una sola vez', async () => {
      const segundo = await crearUsuarioConPin(prueba.pool, a.cuenta, 'AD09', [
        a.rolAdministradorId,
      ]);
      await marca('bolsa.aviso', 'bolsa.aviso:2026-11', hace(HORA));
      expect(await tarea('senal-bolsa')).toMatchObject({ revisados: 1, senales: 1 });
      expect(await tarea('senal-bolsa', new Date(AHORA.getTime() + 5 * MIN))).toMatchObject({
        senales: 0,
        omitidos: 1,
      });
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(2);
      await entregarTodo();
      const [aviso] = await bandeja(adminA);
      expect(aviso).toMatchObject({
        tipo: 'bolsa.aviso',
        severidad: 'info',
        datos: { bolsa: { mes: '2026-11', usado: 4000, tope: 5000 } },
      });
      // Es de toda la cuenta: llega a todos los Administradores con permiso, a nadie más.
      const deSegundo = (await iniciarSesion(prueba.app, segundo.pin)).acceso;
      expect(await bandeja(deSegundo)).toHaveLength(1);
      const titular = (await iniciarSesion(prueba.app, arbol.titular1.pin)).acceso;
      const delTitular = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/notificaciones',
        headers: conUsuario({ acceso: titular }),
      });
      expect(delTitular.statusCode).toBe(403);
      expect(await bandeja(superAcceso, '/plataforma/notificaciones')).toHaveLength(1);
      expect(await bandeja(adminB)).toEqual([]);
    });

    it('superada: un aviso por cuenta y mes que se ACTUALIZA los días siguientes, y no corta nada', async () => {
      await marca('bolsa.superada', 'bolsa.superada:2026-11-10', hace(HORA));
      await tarea('senal-bolsa');
      await entregarTodo();
      const manana = new Date(AHORA.getTime() + DIA);
      await marca('bolsa.superada', 'bolsa.superada:2026-11-11', hace(HORA, manana));
      expect(await tarea('senal-bolsa', manana)).toMatchObject({ senales: 1, omitidos: 1 });
      await entregarTodo(manana);
      const deAdmin = await bandeja(adminA);
      expect(deAdmin).toHaveLength(1);
      expect(deAdmin[0]).toMatchObject({
        tipo: 'bolsa.superada',
        severidad: 'aviso',
        datos: { bolsa: { dia: '2026-11-11', usado: 5001, tope: 5000 } },
      });
      // La bolsa nunca corta: el usuario sigue en estado activo y no se creó ningún incidente.
      expect(await contarFilas(prueba.pool, 'usuarios', "estado <> 'activo'")).toBe(0);
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('recupera lo que quedó sin avisar por una caída, pero no marcas de hace más de 3 días', async () => {
      await marca('bolsa.aviso', 'bolsa.aviso:2026-11', hace(2 * DIA));
      await marca('bolsa.superada', 'bolsa.superada:2026-11-05', hace(5 * DIA));
      expect(await tarea('senal-bolsa')).toMatchObject({ revisados: 1, senales: 1 });
    });

    it('cada cuenta recibe lo suyo y a una cuenta dada de baja no se le avisa', async () => {
      await marca('bolsa.aviso', 'bolsa.aviso:2026-11', hace(HORA));
      await marca('bolsa.aviso', 'bolsa.aviso:2026-11', hace(HORA), b, arbolB.miembro1.id);
      await prueba.pool.query('UPDATE cuentas SET deleted_at = NOW(3) WHERE id = ?', [b.cuenta.id]);
      expect(await tarea('senal-bolsa')).toMatchObject({ revisados: 2, senales: 1, omitidos: 1 });
      const cola = await colaDe();
      expect(cola.every((fila) => String(fila.tenant_id) === a.cuenta.id)).toBe(true);
    });

    it('recorre todas las marcas con cursor aunque la página sea chica', async () => {
      for (const [i, escenario, usuario] of [
        [1, a, arbol.miembro1.id],
        [2, b, arbolB.miembro1.id],
      ] as const) {
        await marca('bolsa.aviso', `bolsa.aviso:2026-11`, hace(i * HORA), escenario, usuario);
        await marca(
          'bolsa.superada',
          'bolsa.superada:2026-11-10',
          hace(i * HORA),
          escenario,
          usuario,
        );
      }
      const { ejecutar } = await import('../../src/modules/senales/actions/avisar-bolsa.js');
      expect(await ejecutar(prueba.pool, AHORA, () => undefined, 1)).toMatchObject({
        revisados: 4,
        senales: 4,
      });
    });
  });

  describe('las señales solo observan: nunca limitan ni tocan la validación', () => {
    it('con las seis señales abiertas, el usuario sigue activo, genera y su QR sigue abriendo', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      for (const nombre of [
        'senal-uso-masivo',
        'senal-uso-imposible',
        'senal-qr-reenviado',
        'senal-pin-compartido',
        'senal-bolsa',
        'senal-flujo-atipico',
      ]) {
        await tarea(nombre);
      }
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
      const [guardia] = await filas<RowDataPacket>(
        'SELECT estado, estado_impuesto_por FROM usuarios WHERE id = ?',
        [arbol.guardia.id],
      );
      expect(guardia).toMatchObject({ estado: 'activo', estado_impuesto_por: null });

      // Su QR propio vigente sigue validando en la puerta, igual que antes de la señal.
      const qr = await crearQr(prueba.pool, a.cuenta, arbol.guardia.id, [a.puertaPrincipal.id]);
      await prueba.pool.query('UPDATE qr_accesos SET es_propio = 1 WHERE id = ?', [qr.id]);
      const abre = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token: qr.texto, leido_en: new Date().toISOString() },
      });
      expect(abre.statusCode).toBe(200);
      expect(abre.json<{ abrir: boolean }>().abrir).toBe(true);

      // Y puede seguir pidiendo su QR propio (el reemplazo no queda frenado por la señal).
      const guardiaToken = (await iniciarSesion(prueba.app, arbol.guardia.pin)).acceso;
      const pide = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos',
        headers: conUsuario({ acceso: guardiaToken }),
        payload: { propio: true, puerta_ids: [a.puertaPrincipal.id] },
      });
      expect([200, 201]).toContain(pide.statusCode);
    });

    it('los incidentes del sistema nacen sin resolver: no cuentan para la reincidencia hasta que una persona los confirme', async () => {
      await aperturasDe(arbol.guardia.id, 13);
      await tarea('senal-uso-masivo');
      const incidente = await primerIncidente();
      expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
      const r = await prueba.app.inject({
        method: 'GET',
        url: `/api/v1/incidentes/${incidente.id}`,
        headers: conUsuario({ acceso: adminA }),
      });
      expect(r.json<{ estado: string; origen: string }>()).toMatchObject({
        estado: 'sin_resolver',
        origen: 'sistema',
      });
    });
  });
});
