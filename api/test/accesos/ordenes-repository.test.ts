import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RepositorioDeOrdenesDeApertura } from '../../src/modules/accesos/ordenes-repository.js';
import { RepositorioDeLecturas } from '../../src/modules/accesos/repository.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import { SinContextoDeCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../src/platform/db/transaccion.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearDispositivo,
  crearEscenario,
  type DispositivoDePrueba,
  type Escenario,
} from '../helpers/fixtures.js';

const ahora = new Date('2026-11-10T15:00:00.000Z');
const en = (ms: number): Date => new Date(ahora.getTime() + ms);

/**
 * El repositorio de órdenes que usan la app y, después, la placa: cada transición es un compare-and-set. Se prueba
 * directo (sin HTTP) con el contexto de la cuenta, como lo corre el plugin de autenticación.
 */
describe('RepositorioDeOrdenesDeApertura (ADR 0035 §3)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let segundaPlaca: DispositivoDePrueba;

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
    // La puerta principal de A lleva dos placas: la de afuera y la de adentro.
    await prueba.pool.query("UPDATE dispositivos SET sentido = 'salida' WHERE id = ?", [
      a.dispositivoPrincipal.id,
    ]);
    segundaPlaca = await crearDispositivo(prueba.pool, a.cuenta, a.puertaPrincipal.id, {
      sentido: 'entrada',
    });
  });

  const enCuenta = <T>(escenario: Escenario, fn: () => Promise<T>): Promise<T> =>
    ContextoCuenta.ejecutarEn(escenario.cuenta.id, fn);
  const repo = () => new RepositorioDeOrdenesDeApertura(prueba.pool);

  /** Una orden pendiente de `usuario` sobre la puerta de `escenario`, con su lectura. */
  async function crearOrden(
    escenario: Escenario,
    puertaId: string,
    opciones: { clave?: string; vence?: Date; usuarioId?: string } = {},
  ): Promise<string> {
    const usuarioId = opciones.usuarioId ?? escenario.usuario.id;
    return enCuenta(escenario, () =>
      enTransaccion(prueba.pool, async (tx) => {
        const lecturaId = await new RepositorioDeLecturas(prueba.pool).registrarManual(tx, {
          puertaId,
          usuarioId,
          resultado: 'permitido',
          motivoCode: 'manual.ordenada',
          ocurridoAt: ahora,
        });
        return repo().crear(tx, {
          puertaId,
          usuarioId,
          lecturaId,
          claveIdempotencia: opciones.clave ?? 'a'.repeat(64),
          creadaAt: ahora,
          venceAt: opciones.vence ?? en(15_000),
        });
      }),
    );
  }
  const estadoDe = async (id: string) => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT estado, dispositivo_id, entregada_at, resuelta_at FROM ordenes_apertura WHERE id = ?',
      [id],
    );
    return filas[0];
  };
  const entregar = (
    escenario: Escenario,
    id: string,
    puertaId: string,
    dispositivoId: string,
    cuando = ahora,
  ) =>
    enCuenta(escenario, () =>
      enTransaccion(prueba.pool, (tx) => repo().entregar(tx, id, puertaId, dispositivoId, cuando)),
    );

  it('una orden nace pendiente, de la puerta, sin placa ni sentido', async () => {
    const id = await crearOrden(a, a.puertaPrincipal.id);
    expect(await estadoDe(id)).toMatchObject({
      estado: 'pendiente',
      dispositivo_id: null,
      entregada_at: null,
      resuelta_at: null,
    });
    const orden = await enCuenta(a, () => repo().buscarPorId(id));
    expect(orden).toMatchObject({ puerta_id: a.puertaPrincipal.id, usuario_id: a.usuario.id });
  });

  it('una sola orden viva por puerta (índice único): la segunda choca', async () => {
    await crearOrden(a, a.puertaPrincipal.id, { clave: '1'.repeat(64) });
    await expect(
      crearOrden(a, a.puertaPrincipal.id, { clave: '2'.repeat(64) }),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    // En otra puerta sí.
    await crearOrden(a, a.puertaTrasera.id, { clave: '3'.repeat(64) });
  });

  it('la tabla no admite una orden de más de 30 s', async () => {
    await expect(crearOrden(a, a.puertaPrincipal.id, { vence: en(31_000) })).rejects.toMatchObject({
      errno: 4025,
    });
  });

  describe('entregar: atómica, una sola vez, a una sola placa', () => {
    it('la primera placa de la puerta la toma y queda registrada', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      expect(await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id)).toBe(true);
      expect(await estadoDe(id)).toMatchObject({
        estado: 'entregada',
        dispositivo_id: a.dispositivoPrincipal.id,
      });
      expect((await estadoDe(id))?.entregada_at).toBeInstanceOf(Date);
    });

    it('con dos placas en la puerta, solo una la toma; la otra no recibe nada', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      const resultados = await Promise.all([
        entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id),
        entregar(a, id, a.puertaPrincipal.id, segundaPlaca.id),
      ]);
      expect(resultados.filter(Boolean)).toHaveLength(1);
      const ganadora = resultados[0] ? a.dispositivoPrincipal.id : segundaPlaca.id;
      expect((await estadoDe(id))?.dispositivo_id).toBe(ganadora);
    });

    it('una orden ya entregada no se vuelve a entregar', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id);
      expect(await entregar(a, id, a.puertaPrincipal.id, segundaPlaca.id)).toBe(false);
      expect((await estadoDe(id))?.dispositivo_id).toBe(a.dispositivoPrincipal.id);
    });

    it('una orden vencida no se entrega, ni siquiera un milisegundo después', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id, { vence: en(15_000) });
      expect(
        await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, en(15_000)),
      ).toBe(false);
      expect(
        await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, en(20_000)),
      ).toBe(false);
      expect((await estadoDe(id))?.estado).toBe('pendiente');
      expect(
        await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, en(14_999)),
      ).toBe(true);
    });

    it('la placa de otra puerta no la recibe', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      expect(await entregar(a, id, a.puertaTrasera.id, a.dispositivoTrasero.id)).toBe(false);
      expect((await estadoDe(id))?.estado).toBe('pendiente');
    });

    it('aislamiento: ni otra cuenta ni una placa de otra cuenta pueden tomarla', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      expect(await entregar(b, id, a.puertaPrincipal.id, b.dispositivoPrincipal.id)).toBe(false);
      expect((await estadoDe(id))?.estado).toBe('pendiente');
    });

    it('buscarEntregableDeLaPuerta ofrece la pendiente vigente y no la vencida ni la ya tomada', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      expect(
        (await enCuenta(a, () => repo().buscarEntregableDeLaPuerta(a.puertaPrincipal.id, ahora)))
          ?.id,
      ).toBe(id);
      expect(
        await enCuenta(a, () =>
          repo().buscarEntregableDeLaPuerta(a.puertaPrincipal.id, en(16_000)),
        ),
      ).toBeNull();
      expect(
        await enCuenta(a, () => repo().buscarEntregableDeLaPuerta(a.puertaTrasera.id, ahora)),
      ).toBeNull();
      await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id);
      expect(
        await enCuenta(a, () => repo().buscarEntregableDeLaPuerta(a.puertaPrincipal.id, ahora)),
      ).toBeNull();
      // Entregada sigue «viva» para la puerta (no admite otra orden).
      expect((await enCuenta(a, () => repo().buscarVivaDeLaPuerta(a.puertaPrincipal.id)))?.id).toBe(
        id,
      );
    });
  });

  describe('resolver: solo la placa que la tomó, una sola vez', () => {
    const resolver = (
      escenario: Escenario,
      id: string,
      dispositivoId: string,
      estado: 'ejecutada' | 'fallida' = 'ejecutada',
    ) =>
      enCuenta(escenario, () =>
        enTransaccion(prueba.pool, (tx) =>
          repo().resolver(tx, id, dispositivoId, estado, en(2_000)),
        ),
      );

    it('entregada pasa a ejecutada; repetirlo no cambia nada', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id);
      expect(await resolver(a, id, a.dispositivoPrincipal.id)).toBe(true);
      expect(await estadoDe(id)).toMatchObject({ estado: 'ejecutada' });
      expect(await resolver(a, id, a.dispositivoPrincipal.id, 'fallida')).toBe(false);
      expect((await estadoDe(id))?.estado).toBe('ejecutada');
    });

    it('puede quedar fallida', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id);
      expect(await resolver(a, id, a.dispositivoPrincipal.id, 'fallida')).toBe(true);
      expect((await estadoDe(id))?.estado).toBe('fallida');
    });

    it('la otra placa de la puerta no puede resolver una orden que no tomó', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id);
      expect(await resolver(a, id, segundaPlaca.id)).toBe(false);
      expect((await estadoDe(id))?.estado).toBe('entregada');
    });

    it('una orden que nadie entregó no se puede resolver', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      expect(await resolver(a, id, a.dispositivoPrincipal.id)).toBe(false);
    });

    it('otra cuenta no resuelve la orden', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      await entregar(a, id, a.puertaPrincipal.id, a.dispositivoPrincipal.id);
      expect(await resolver(b, id, a.dispositivoPrincipal.id)).toBe(false);
    });
  });

  describe('vencer', () => {
    const vencer = (escenario: Escenario, id: string, cuando: Date) =>
      enCuenta(escenario, () => enTransaccion(prueba.pool, (tx) => repo().vencer(tx, id, cuando)));

    it('solo vence una orden viva cuyo plazo ya pasó', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      expect(await vencer(a, id, en(14_000))).toBe(false);
      expect(await vencer(a, id, en(15_000))).toBe(true);
      expect(await estadoDe(id)).toMatchObject({ estado: 'vencida' });
      expect(await vencer(a, id, en(30_000))).toBe(false);
    });

    it('una entregada que nadie resolvió también vence; una ejecutada, no', async () => {
      const entregada = await crearOrden(a, a.puertaPrincipal.id, { clave: '4'.repeat(64) });
      await entregar(a, entregada, a.puertaPrincipal.id, a.dispositivoPrincipal.id);
      expect(await vencer(a, entregada, en(20_000))).toBe(true);

      const ejecutada = await crearOrden(a, a.puertaPrincipal.id, { clave: '5'.repeat(64) });
      await entregar(a, ejecutada, a.puertaPrincipal.id, a.dispositivoPrincipal.id);
      await enCuenta(a, () =>
        enTransaccion(prueba.pool, (tx) =>
          repo().resolver(tx, ejecutada, a.dispositivoPrincipal.id, 'ejecutada', en(1_000)),
        ),
      );
      expect(await vencer(a, ejecutada, en(20_000))).toBe(false);
      expect((await estadoDe(ejecutada))?.estado).toBe('ejecutada');
    });

    it('una orden vencida libera la puerta para otra', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id, { clave: '6'.repeat(64) });
      await vencer(a, id, en(20_000));
      await crearOrden(a, a.puertaPrincipal.id, { clave: '7'.repeat(64) });
    });

    it('otra cuenta no la vence', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      expect(await vencer(b, id, en(20_000))).toBe(false);
    });
  });

  describe('consultas con la cuenta del contexto', () => {
    it('buscarDelUsuario no devuelve la orden de otro usuario ni de otra cuenta', async () => {
      const id = await crearOrden(a, a.puertaPrincipal.id);
      expect(await enCuenta(a, () => repo().buscarDelUsuario(id, a.usuario.id))).not.toBeNull();
      expect(await enCuenta(a, () => repo().buscarDelUsuario(id, a.administrador.id))).toBeNull();
      expect(await enCuenta(b, () => repo().buscarDelUsuario(id, a.usuario.id))).toBeNull();
    });

    it('buscarPorClave es por usuario y por cuenta', async () => {
      const clave = 'c'.repeat(64);
      const id = await crearOrden(a, a.puertaPrincipal.id, { clave });
      expect((await enCuenta(a, () => repo().buscarPorClave(a.usuario.id, clave)))?.id).toBe(id);
      expect(await enCuenta(a, () => repo().buscarPorClave(a.administrador.id, clave))).toBeNull();
      expect(await enCuenta(b, () => repo().buscarPorClave(a.usuario.id, clave))).toBeNull();
    });

    it('sin contexto de cuenta falla cerrado', async () => {
      await expect(repo().buscarPorId('1')).rejects.toBeInstanceOf(SinContextoDeCuenta);
    });
  });
});
