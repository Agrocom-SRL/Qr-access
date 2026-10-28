import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RepositorioDeActividadDeTodas } from '../../src/modules/accesos/repository.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearDispositivo,
  crearEscenario,
  crearPuerta,
  crearSitio,
  type Escenario,
} from '../helpers/fixtures.js';

/**
 * Uso imposible con volumen (ADR 0030 §4, ola W12): la consulta empareja aperturas de un mismo usuario y su costo debe
 * acotarse por la ventana de emparejamiento (índice `(tenant_id, ocurrido_at)`), no por el total de eventos de la cuenta.
 */
const AHORA = new Date('2026-11-10T15:00:00.000Z');
const SEG = 1000;
const ENTRE_SITIOS = 600;
const ENTRE_PUERTAS = 20;

interface Punto {
  readonly usuarioId: string;
  readonly puertaId: string;
  readonly sitioId: string;
  readonly cuando: Date;
}

describe('uso imposible: volumen y equivalencia (W12)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let arbol: Arbol;
  let puertas: { id: string; sitioId: string; dispositivoId: string }[];

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
    const sitio2 = await crearSitio(prueba.pool, a.cuenta, 'Sitio lejano');
    const lejana = await crearPuerta(prueba.pool, a.cuenta, sitio2, 'Puerta lejana');
    const disp = await crearDispositivo(prueba.pool, a.cuenta, lejana.id);
    puertas = [
      {
        id: a.puertaPrincipal.id,
        sitioId: a.sitioId,
        dispositivoId: a.dispositivoPrincipal.id,
      },
      {
        id: a.puertaTrasera.id,
        sitioId: a.sitioId,
        dispositivoId: a.dispositivoTrasero.id,
      },
      { id: lejana.id, sitioId: sitio2, dispositivoId: disp.id },
    ];
  });

  /** Inserta en bloque, directo con SQL: un QR propio usado por evento, y su apertura por QR. */
  async function sembrar(pool: Pool, puntos: readonly Punto[]): Promise<void> {
    const LOTE = 1000;
    for (let i = 0; i < puntos.length; i += LOTE) {
      const lote = puntos.slice(i, i + LOTE);
      const [cab] = await pool.query<RowDataPacket[] & { insertId: number }>(
        'INSERT INTO qr_accesos (tenant_id, generado_por, token_hash, vence_at, usado_at, es_propio) VALUES ?',
        [
          lote.map((p, k) => [
            a.cuenta.id,
            p.usuarioId,
            `v${String(i + k).padStart(63, '0')}`,
            new Date(AHORA.getTime() + 3_600_000),
            p.cuando,
            1,
          ]),
        ],
      );
      const primero = (cab as unknown as { insertId: number }).insertId;
      await pool.query(
        'INSERT INTO lecturas (tenant_id, puerta_id, dispositivo_id, qr_acceso_id, metodo, resultado, motivo_code, ocurrido_at) VALUES ?',
        [
          lote.map((p, k) => {
            const puerta = puertas.find((x) => x.id === p.puertaId);
            return [
              a.cuenta.id,
              p.puertaId,
              puerta?.dispositivoId ?? null,
              primero + k,
              'qr',
              'permitido',
              'acceso.permitido',
              p.cuando,
            ];
          }),
        ],
      );
    }
  }

  const usuarios = () => [arbol.miembro1.id, arbol.miembro1b.id, arbol.miembro2.id];

  /** Un generador pseudoaleatorio determinista (LCG) para que el test sea reproducible. */
  function aleatorio(semilla: number): () => number {
    let estado = semilla;
    return () => {
      estado = (estado * 1664525 + 1013904223) % 4294967296;
      return estado / 4294967296;
    };
  }

  it('devuelve exactamente los pares que da la definición (fuerza bruta en memoria)', async () => {
    const azar = aleatorio(7);
    const puntos: Punto[] = [];
    for (let i = 0; i < 900; i++) {
      const puerta = puertas[Math.floor(azar() * puertas.length)];
      const usuario = usuarios()[Math.floor(azar() * 3)];
      if (puerta === undefined || usuario === undefined) throw new Error('semilla');
      // Dos horas de actividad en segundos redondos: abundan los pares cerca de los umbrales.
      puntos.push({
        usuarioId: usuario,
        puertaId: puerta.id,
        sitioId: puerta.sitioId,
        cuando: new Date(AHORA.getTime() - Math.floor(azar() * 7200) * SEG),
      });
    }
    await sembrar(prueba.pool, puntos);

    // Los ids siguen el orden de inserción; el emparejamiento exige `id` posterior y hora no anterior.
    const esperado = new Map<string, number>();
    puntos.forEach((t, i) => {
      puntos.forEach((e, j) => {
        if (j <= i || t.usuarioId !== e.usuarioId || t.puertaId === e.puertaId) return;
        const dif = (e.cuando.getTime() - t.cuando.getTime()) / SEG;
        if (dif < 0) return;
        const limite = t.sitioId === e.sitioId ? ENTRE_PUERTAS : ENTRE_SITIOS;
        if (dif <= limite) esperado.set(t.usuarioId, (esperado.get(t.usuarioId) ?? 0) + 1);
      });
    });
    expect(esperado.size).toBeGreaterThan(0);

    const filas = await new RepositorioDeActividadDeTodas(prueba.pool).usosImposibles(
      new Date(AHORA.getTime() - 24 * 3_600_000),
      AHORA,
      ENTRE_SITIOS,
      ENTRE_PUERTAS,
      100,
      null,
    );
    const obtenido = new Map(filas.map((f) => [f.usuario_id, Number(f.total)]));
    expect(obtenido).toEqual(esperado);

    // De a una por página, con el cursor (cuenta, usuario): las mismas, sin repetir ni perder.
    const paginadas: string[] = [];
    let cursor: { cuentaId: string; usuarioId: string } | null = null;
    for (let pagina = 0; pagina < 10; pagina++) {
      const [fila] = await new RepositorioDeActividadDeTodas(prueba.pool).usosImposibles(
        new Date(AHORA.getTime() - 24 * 3_600_000),
        AHORA,
        ENTRE_SITIOS,
        ENTRE_PUERTAS,
        1,
        cursor,
      );
      if (fila === undefined) break;
      paginadas.push(fila.usuario_id);
      cursor = { cuentaId: fila.tenant_id, usuarioId: fila.usuario_id };
    }
    expect(paginadas).toEqual([...obtenido.keys()]);
  });

  it('con 20 000 eventos en una cuenta termina pronto y lee la cuenta por índice', async () => {
    // 20 000 aperturas repartidas en 23 h, separadas más que los umbrales de cada usuario: ningún par imposible, salvo
    // el que se planta al final. Una consulta sin cota de emparejamiento compara cada apertura con todas las posteriores.
    const puntos: Punto[] = [];
    const inicio = AHORA.getTime() - 23 * 3_600_000;
    for (let i = 0; i < 20_000; i++) {
      const usuario = usuarios()[i % 3];
      // Cada usuario usa una sola puerta distinta: sin pares de puertas distintas, salvo el planteado.
      const puerta = puertas[i % 3];
      if (usuario === undefined || puerta === undefined) throw new Error('indice');
      puntos.push({
        usuarioId: usuario,
        puertaId: puerta.id,
        sitioId: puerta.sitioId,
        cuando: new Date(inicio + Math.floor((i * 82_800_000) / 20_000)),
      });
    }
    // Un par imposible real: el mismo usuario (miembro1) en dos sitios con 2 minutos de diferencia.
    const principal = puertas[0];
    const lejana = puertas[2];
    if (principal === undefined || lejana === undefined) throw new Error('puertas');
    puntos.push(
      {
        usuarioId: arbol.miembro1.id,
        puertaId: principal.id,
        sitioId: principal.sitioId,
        cuando: new Date(AHORA.getTime() - 60 * 60_000),
      },
      {
        usuarioId: arbol.miembro1.id,
        puertaId: lejana.id,
        sitioId: lejana.sitioId,
        cuando: new Date(AHORA.getTime() - 58 * 60_000),
      },
    );
    await sembrar(prueba.pool, puntos);
    // Estadísticas al día, como en producción: el plan no depende de la carga recién hecha.
    await prueba.pool.query('ANALYZE TABLE lecturas, qr_accesos');

    // Registra cada SQL para pedirle su plan a MariaDB.
    const consultas: { sql: string; params: unknown[] }[] = [];
    const espia = {
      query: (sql: string, params: unknown[]) => {
        consultas.push({ sql, params });
        return prueba.pool.query(sql, params);
      },
    } as unknown as Pool;
    const repositorio = new RepositorioDeActividadDeTodas(espia);

    const t0 = Date.now();
    const filas = await repositorio.usosImposibles(
      new Date(AHORA.getTime() - 24 * 3_600_000),
      AHORA,
      ENTRE_SITIOS,
      ENTRE_PUERTAS,
      100,
      null,
    );
    const ms = Date.now() - t0;

    expect(filas).toHaveLength(1);
    expect(String(filas[0]?.usuario_id)).toBe(arbol.miembro1.id);
    // El par plantado más las aperturas de fondo de miembro1 en la puerta principal, hasta 10 min antes de la lejana.
    const horaLejana = AHORA.getTime() - 58 * 60_000;
    const esperados = puntos.filter(
      (p) =>
        p.usuarioId === arbol.miembro1.id &&
        p.puertaId === principal.id &&
        horaLejana - p.cuando.getTime() >= 0 &&
        horaLejana - p.cuando.getTime() <= ENTRE_SITIOS * SEG,
    ).length;
    expect(esperados).toBeGreaterThan(1);
    expect(Number(filas[0]?.total)).toBe(esperados);
    // Una lectura por índice de la ventana de la cuenta, y el emparejamiento acotado en memoria. Margen holgado para CI.
    expect(ms).toBeLessThan(5_000);

    // La lectura de la cuenta (la que alimenta el emparejamiento) entra por un índice, no recorre la tabla entera. La
    // previa, que lista las cuentas con actividad, sí puede barrer la ventana: es lineal y una por página.
    const deLaCuenta = consultas.filter((consulta) => consulta.sql.includes('t.tenant_id = ?'));
    expect(deLaCuenta).toHaveLength(1);
    const [plan] = await prueba.pool.query<RowDataPacket[]>(
      // eslint-disable-next-line no-restricted-syntax -- el SQL lo armó el repositorio con `?`; los valores van aparte.
      `EXPLAIN ${deLaCuenta[0]?.sql ?? ''}`,
      deLaCuenta[0]?.params,
    );
    const eventos = plan.filter((fila) => fila.table === 't');
    expect(eventos).toHaveLength(1);
    expect(String(eventos[0]?.type)).not.toMatch(/^(ALL|index)$/);
    expect(eventos[0]?.key).not.toBeNull();
  }, 120_000);
});
