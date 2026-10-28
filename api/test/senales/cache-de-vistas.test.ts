import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as listarConsumo } from '../../src/modules/senales/actions/listar-consumo-de-bolsa.js';
import { ejecutar as listarFlujo } from '../../src/modules/senales/actions/listar-flujo-de-cuentas.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, type Escenario } from '../helpers/fixtures.js';
import { evento } from '../helpers/senales.js';

/** 10-nov-2026 11:00 en La Paz. */
const AHORA = new Date('2026-11-10T15:00:00.000Z');
const PAGINA = { pagina: 1, por_pagina: 50 };

describe('vistas de plataforma con caché corta (reloj inyectado, W12)', () => {
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
  });

  const abrir = (cuando: Date) =>
    evento(prueba.pool, a.cuenta, {
      puertaId: a.puertaPrincipal.id,
      dispositivoId: a.dispositivoPrincipal.id,
      cuando,
    });
  const flujo = (ahora: Date, buscar: string | null = null) =>
    listarFlujo(
      prueba.pool,
      { dias: 7, soloAtipicas: false, buscar, orden: 'aperturas', sentido: 'desc' },
      PAGINA,
      ahora,
    );

  it('el flujo se reutiliza dentro de la vigencia y se recalcula al vencer', async () => {
    await abrir(new Date(AHORA.getTime() - 60_000));
    expect((await flujo(AHORA)).datos[0]?.aperturas_hoy).toBe(1);

    await abrir(new Date(AHORA.getTime() - 30_000));
    // Dentro de la vigencia: el mismo resultado, aunque haya una apertura nueva.
    expect((await flujo(new Date(AHORA.getTime() + 20_000))).datos[0]?.aperturas_hoy).toBe(1);
    // Vencida: se recalcula.
    expect((await flujo(new Date(AHORA.getTime() + 120_000))).datos[0]?.aperturas_hoy).toBe(2);
  });

  it('la búsqueda filtra sobre el resultado guardado sin recalcular ni mezclar cuentas', async () => {
    const b = await crearEscenario(prueba.pool, 'BBB');
    await abrir(new Date(AHORA.getTime() - 60_000));
    const todas = await flujo(AHORA);
    expect(todas.datos).toHaveLength(2);
    const soloB = await flujo(AHORA, b.cuenta.codigo);
    expect(soloB.datos.map((f) => f.cuenta.id)).toEqual([b.cuenta.id]);
    expect(soloB.meta.total).toBe(1);
  });

  it('el consumo se reutiliza dentro de la vigencia y se recalcula al vencer', async () => {
    const consumo = (ahora: Date) =>
      listarConsumo(
        prueba.pool,
        { estado: null, buscar: null, orden: 'porcentaje', sentido: 'desc' },
        PAGINA,
        ahora,
      );
    expect((await consumo(AHORA)).datos).toHaveLength(1);
    await crearEscenario(prueba.pool, 'CCC');
    expect((await consumo(new Date(AHORA.getTime() + 10_000))).datos).toHaveLength(1);
    expect((await consumo(new Date(AHORA.getTime() + 120_000))).datos).toHaveLength(2);
  });
});
