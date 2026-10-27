import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as listarFlujo } from '../../src/modules/senales/actions/listar-flujo-de-cuentas.js';
import { crearTareas } from '../../src/tareas.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearSuperAdmin,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma } from '../helpers/http.js';
import { evento, qrPropio, repeticionDe, sesion } from '../helpers/senales.js';

/**
 * Integración de las olas W7 (repeticiones, `eventos_acceso.repetido_de_id`) y W8 (`sesiones.instalacion_id`) con los
 * detectores de la ola W12 (ADR 0030, «Tareas de integración», y D-37). Cada prueba FALLA si alguien olvida la tarea:
 * una relectura del mismo QR no es otra apertura ni otro intento, y dos aparatos tras una misma IP son dos.
 */

/** 10-nov-2026 11:00 en La Paz (15:00 UTC). */
const AHORA = new Date('2026-11-10T15:00:00.000Z');
const MIN = 60_000;
const HORA = 3_600_000;
const DIA = 24 * HORA;
const hace = (ms: number) => new Date(AHORA.getTime() - ms);

interface Pasada {
  revisados: number;
  senales: number;
  omitidos: number;
  errores: number;
  ocupadas: number;
}
interface IncidenteFila extends RowDataPacket {
  usuario_id: string;
  tipo: string;
  gravedad: string;
  descripcion: string | null;
}

describe('señales: integración con las repeticiones (W7) y las instalaciones (W8)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let arbol: Arbol;
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
    arbol = await armarArbol(prueba.pool, a);
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
  const incidentes = async () =>
    (await prueba.pool.query<IncidenteFila[]>('SELECT * FROM incidentes_uso ORDER BY id'))[0];

  /** Una apertura por QR propio (y su repetición `repeticiones` veces, a 1 s una de otra). */
  async function aperturaConRepeticiones(
    usuarioId: string,
    cuando: Date,
    repeticiones: number,
    donde: { puertaId: string; dispositivoId: string } = {
      puertaId: a.puertaPrincipal.id,
      dispositivoId: a.dispositivoPrincipal.id,
    },
  ) {
    const qr = await qrPropio(prueba.pool, a.cuenta, usuarioId, [donde.puertaId], cuando);
    const base = { ...donde, qrId: qr.id, cuando };
    const id = await evento(prueba.pool, a.cuenta, base);
    for (let i = 1; i <= repeticiones; i++) {
      await repeticionDe(prueba.pool, a.cuenta, { ...base, id }, i);
    }
    return id;
  }

  describe('(a) las aperturas se cuentan DISTINTAS, no filas', () => {
    it('uso masivo: 6 aperturas con 4 repeticiones cada una (30 filas) NO pasan el N de 12', async () => {
      for (let i = 0; i < 6; i++) {
        await aperturaConRepeticiones(arbol.guardia.id, hace(i * MIN), 4);
      }
      expect(await contarFilas(prueba.pool, 'eventos_acceso')).toBe(30);
      expect(await tarea('senal-uso-masivo')).toMatchObject({ revisados: 0, senales: 0 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('uso masivo: 13 aperturas distintas disparan, y las repeticiones no suman al valor', async () => {
      for (let i = 0; i < 13; i++) {
        await aperturaConRepeticiones(arbol.guardia.id, hace(i * MIN), 2);
      }
      expect(await tarea('senal-uso-masivo')).toMatchObject({ revisados: 1, senales: 1 });
      expect((await incidentes())[0]).toMatchObject({
        tipo: 'uso_masivo',
        gravedad: 'media',
        descripcion: 'aperturas=13;umbral=12',
      });
    });

    it('uso imposible: la repetición de una apertura no forma un par con la apertura de la otra puerta', async () => {
      // O1 en la puerta principal, B en la trasera 25 s después (más de los 20 s del mismo sitio: no es un par).
      // Una repetición de O1 a los 14 s quedaría a 11 s de B y formaría un par falso si se contara.
      const inicio = hace(60 * MIN);
      await aperturaConRepeticiones(arbol.guardia.id, inicio, 0);
      const qrB = await qrPropio(
        prueba.pool,
        a.cuenta,
        arbol.guardia.id,
        [a.puertaTrasera.id],
        inicio,
      );
      await evento(prueba.pool, a.cuenta, {
        puertaId: a.puertaTrasera.id,
        dispositivoId: a.dispositivoTrasero.id,
        qrId: qrB.id,
        cuando: new Date(inicio.getTime() + 25_000),
      });
      const [original] = (
        await prueba.pool.query<RowDataPacket[]>(
          'SELECT id, puerta_id, dispositivo_id, qr_acceso_id FROM eventos_acceso WHERE puerta_id = ?',
          [a.puertaPrincipal.id],
        )
      )[0];
      await repeticionDe(
        prueba.pool,
        a.cuenta,
        {
          id: String(original?.id),
          puertaId: a.puertaPrincipal.id,
          dispositivoId: a.dispositivoPrincipal.id,
          qrId: String(original?.qr_acceso_id),
          cuando: inicio,
        },
        14,
      );
      expect(await tarea('senal-uso-imposible')).toMatchObject({ revisados: 0, senales: 0 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('flujo atípico: 60 filas de 20 aperturas y 2 repeticiones cada una no son un flujo atípico', async () => {
      const [lista] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT id FROM usuarios WHERE tenant_id = ? ORDER BY id',
        [a.cuenta.id],
      );
      for (const fila of lista.slice(2)) {
        await prueba.pool.query(
          "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba', estado_impuesto_por = ? WHERE id = ?",
          [a.administrador.id, fila.id],
        );
      }
      for (let i = 0; i < 20; i++) {
        const base = {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: a.dispositivoPrincipal.id,
          cuando: hace(i * 5_000),
        };
        const id = await evento(prueba.pool, a.cuenta, base);
        await repeticionDe(prueba.pool, a.cuenta, { ...base, id }, 1);
        await repeticionDe(prueba.pool, a.cuenta, { ...base, id }, 2);
      }
      // 60 filas ≥ 50 aperturas mínimas y 30 por usuario ≥ 25: SIN el filtro sería atípico. Con 20 distintas, no.
      expect(await contarFilas(prueba.pool, 'eventos_acceso')).toBe(60);
      expect(await tarea('senal-flujo-atipico')).toMatchObject({ senales: 0 });
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
    });

    it('las vistas de plataforma cuentan aperturas y rechazos distintos', async () => {
      const [lista] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT id FROM usuarios WHERE tenant_id = ? ORDER BY id',
        [a.cuenta.id],
      );
      for (const fila of lista.slice(2)) {
        await prueba.pool.query(
          "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba', estado_impuesto_por = ? WHERE id = ?",
          [a.administrador.id, fila.id],
        );
      }
      // 5 aperturas con 3 repeticiones y 2 rechazos con 3 repeticiones: 26 filas, 5 aperturas y 2 rechazos distintos.
      const ahora = Date.now();
      for (let i = 0; i < 5; i++) {
        const base = {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: a.dispositivoPrincipal.id,
          cuando: new Date(ahora - 60_000 - i * 30_000),
        };
        const id = await evento(prueba.pool, a.cuenta, base);
        for (let r = 1; r <= 3; r++) await repeticionDe(prueba.pool, a.cuenta, { ...base, id }, r);
      }
      for (let i = 0; i < 2; i++) {
        const base = {
          puertaId: a.puertaPrincipal.id,
          dispositivoId: a.dispositivoPrincipal.id,
          resultado: 'rechazado' as const,
          motivo: 'qr.usado',
          cuando: new Date(ahora - 10_000 - i * 40_000),
        };
        const id = await evento(prueba.pool, a.cuenta, base);
        for (let r = 1; r <= 3; r++) await repeticionDe(prueba.pool, a.cuenta, { ...base, id }, r);
      }
      expect(await contarFilas(prueba.pool, 'eventos_acceso')).toBe(28);

      const detalle = await prueba.app.inject({
        method: 'GET',
        url: `/api/v1/plataforma/cuentas/${a.cuenta.id}/flujo?dias=7`,
        headers: conUsuario({ acceso: superAcceso }),
      });
      expect(detalle.statusCode, detalle.body).toBe(200);
      const hoy = detalle
        .json<{ serie: { aperturas: number; rechazos: number }[] }>()
        .serie.reduce((suma, dia) => ({
          aperturas: suma.aperturas + dia.aperturas,
          rechazos: suma.rechazos + dia.rechazos,
        }));
      expect(hoy).toEqual({ aperturas: 5, rechazos: 2 });

      const lista7 = await listarFlujo(
        prueba.pool,
        { dias: 7, soloAtipicas: false, buscar: null, orden: 'aperturas', sentido: 'desc' },
        { pagina: 1, por_pagina: 50 },
        new Date(ahora + 10 * DIA),
      );
      // Mismo cálculo con el reloj corrido: las aperturas «de hoy» son las distintas.
      expect(lista7.datos.every((fila) => fila.aperturas_hoy <= 5)).toBe(true);
    });
  });

  describe('(b) QR reenviado exige el umbral sobre intentos distintos', () => {
    const rechazo = (qrId: string, dispositivoId: string, puertaId: string, cuando: Date) =>
      evento(prueba.pool, a.cuenta, {
        puertaId,
        dispositivoId,
        qrId,
        resultado: 'rechazado',
        motivo: 'qr.usado',
        cuando,
      });

    it('un solo intento distinto releído 9 veces (10 filas) es solo constancia baja, no «lectores»', async () => {
      const qr = await qrPropio(
        prueba.pool,
        a.cuenta,
        arbol.miembro1.id,
        [a.puertaPrincipal.id],
        hace(2 * HORA),
      );
      const base = {
        puertaId: a.puertaPrincipal.id,
        dispositivoId: a.dispositivoPrincipal.id,
        qrId: qr.id,
        resultado: 'rechazado' as const,
        motivo: 'qr.usado',
        cuando: hace(30 * MIN),
      };
      const id = await evento(prueba.pool, a.cuenta, base);
      for (let i = 1; i <= 9; i++) await repeticionDe(prueba.pool, a.cuenta, { ...base, id }, i);
      expect(await tarea('senal-qr-reenviado')).toMatchObject({ senales: 1 });
      expect((await incidentes())[0]).toMatchObject({ tipo: 'qr_reenviado', gravedad: 'baja' });
      expect(await contarFilas(prueba.pool, 'cola_de_notificaciones')).toBe(0);
    });

    it('dos lectores donde uno solo tiene un intento distinto y el resto son repeticiones: no es media', async () => {
      const qr = await qrPropio(
        prueba.pool,
        a.cuenta,
        arbol.miembro1.id,
        [a.puertaPrincipal.id, a.puertaTrasera.id],
        hace(2 * HORA),
      );
      // Tres intentos distintos del lector principal (alcanzan el mínimo de 3)...
      for (let i = 0; i < 3; i++) {
        await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace((30 + i) * MIN));
      }
      // ...y el lector trasero ve un intento original FUERA de la ventana de la tarea y solo repeticiones adentro.
      const originalViejo = await rechazo(
        qr.id,
        a.dispositivoTrasero.id,
        a.puertaTrasera.id,
        new Date(AHORA.getTime() - 3 * DIA),
      );
      await evento(prueba.pool, a.cuenta, {
        puertaId: a.puertaTrasera.id,
        dispositivoId: a.dispositivoTrasero.id,
        qrId: qr.id,
        resultado: 'rechazado',
        motivo: 'qr.usado',
        cuando: hace(10 * MIN),
        repetidoDeId: originalViejo,
      });
      expect(await tarea('senal-qr-reenviado')).toMatchObject({ senales: 0, omitidos: 1 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('dos lectores con intentos distintos cada uno siguen siendo media', async () => {
      const qr = await qrPropio(
        prueba.pool,
        a.cuenta,
        arbol.miembro1.id,
        [a.puertaPrincipal.id, a.puertaTrasera.id],
        hace(2 * HORA),
      );
      await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(30 * MIN));
      await rechazo(qr.id, a.dispositivoPrincipal.id, a.puertaPrincipal.id, hace(29 * MIN));
      await rechazo(qr.id, a.dispositivoTrasero.id, a.puertaTrasera.id, hace(10 * MIN));
      await tarea('senal-qr-reenviado');
      expect((await incidentes())[0]).toMatchObject({ gravedad: 'media' });
    });
  });

  describe('(c) PIN compartido suma las instalaciones distintas', () => {
    const activa = (usuarioId: string, ip: string, instalacion?: string) =>
      sesion(prueba.pool, a.cuenta, usuarioId, {
        ip,
        actividad: hace(HORA),
        expira: new Date(AHORA.getTime() + 7 * DIA),
        ...(instalacion === undefined ? {} : { instalacion }),
      });

    it('4 instalaciones tras una sola IP (una oficina) disparan; antes contaban como 1', async () => {
      for (const instalacion of ['inst-1', 'inst-2', 'inst-3', 'inst-4']) {
        await activa(arbol.guardia.id, '181.0.0.9', instalacion);
      }
      expect(await tarea('senal-pin-compartido')).toMatchObject({ revisados: 1, senales: 1 });
      expect((await incidentes())[0]).toMatchObject({
        tipo: 'pin_compartido',
        gravedad: 'media',
        descripcion: 'ips=1;instalaciones=4;sesiones=4;umbral=4',
      });
    });

    it('una sola instalación que rota de IP (datos móviles) cuenta por la mayor medida, no por la suma', async () => {
      // 3 IP y 1 instalación: la dispersión es 3 (< 4): no dispara. Sumar daría 4 y dispararía.
      for (const ip of ['190.1.1.1', '190.1.1.2', '190.1.1.3']) {
        await activa(arbol.guardia.id, ip, 'inst-1');
      }
      expect(await tarea('senal-pin-compartido')).toMatchObject({ revisados: 0, senales: 0 });
    });

    it('con dos instalaciones y una sola IP la dispersión es 2 (umbral bajado a 2 para esa cuenta)', async () => {
      await prueba.pool.query(
        "INSERT INTO excepciones_de_limite (tenant_id, usuario_id, clave, valor) VALUES (?, NULL, 'senal.pin_compartido_ips_minimo', 2)",
        [a.cuenta.id],
      );
      await activa(arbol.guardia.id, '181.0.0.9', 'inst-1');
      await activa(arbol.guardia.id, '181.0.0.9', 'inst-2');
      expect(await tarea('senal-pin-compartido')).toMatchObject({ revisados: 1, senales: 1 });
      const [incidente] = await incidentes();
      expect(incidente).toMatchObject({ descripcion: 'ips=1;instalaciones=2;sesiones=2;umbral=2' });
    });
  });
});
