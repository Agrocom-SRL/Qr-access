import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  conflictoDeSentido,
  SENTIDOS,
  type Sentido,
} from '../../src/modules/dispositivos/domain/sentido.js';
import { RepositorioDeDispositivos } from '../../src/modules/dispositivos/repository.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../src/platform/db/transaccion.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearDispositivo,
  crearEscenario,
  crearPuerta,
  crearSuperAdmin,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma, type Problema } from '../helpers/http.js';

describe('conflictoDeSentido (puro)', () => {
  const caso = (existentes: Sentido[], nuevo: Sentido) => conflictoDeSentido(existentes, nuevo);

  it('una puerta vacía admite cualquier ubicación', () => {
    for (const sentido of SENTIDOS) expect(caso([], sentido)).toBeNull();
  });

  it('entrada y salida conviven', () => {
    expect(caso(['entrada'], 'salida')).toBeNull();
    expect(caso(['salida'], 'entrada')).toBeNull();
  });

  it('la misma ubicación dos veces es un conflicto de ese lado', () => {
    for (const sentido of SENTIDOS) expect(caso([sentido], sentido)).toBe('mismo_sentido');
  });

  it('`ambos` es exclusivo: no se mezcla con entrada ni con salida, en ningún orden', () => {
    expect(caso(['ambos'], 'entrada')).toBe('sentido_en_conflicto');
    expect(caso(['ambos'], 'salida')).toBe('sentido_en_conflicto');
    expect(caso(['entrada'], 'ambos')).toBe('sentido_en_conflicto');
    expect(caso(['salida'], 'ambos')).toBe('sentido_en_conflicto');
    expect(caso(['entrada', 'salida'], 'ambos')).toBe('sentido_en_conflicto');
  });
});

describe('dispositivos: una o dos placas por puerta según su sentido (ADR 0035 §4)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let puertaId: string;
  let contador = 0;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    puertaId = (await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Con dos placas')).id;
  });

  async function nuevaPlaca(): Promise<string> {
    contador += 1;
    const mac = `AA:BB:CC:00:00:${contador.toString(16).toUpperCase().padStart(2, '0')}`;
    const [resultado] = await prueba.pool.query<RowDataPacket[] & { insertId: number }>(
      'INSERT INTO placas (mac) VALUES (?)',
      [mac],
    );
    return String(resultado.insertId);
  }

  /** Vincula una placa nueva a la puerta con ese sentido, como lo hace el alta del dispositivo (misma transacción). */
  const vincular = async (sentido?: Sentido): Promise<string> => {
    const placaId = await nuevaPlaca();
    return ContextoCuenta.ejecutarEn(a.cuenta.id, () =>
      enTransaccion(prueba.pool, (tx) =>
        new RepositorioDeDispositivos(prueba.pool).crearParaPlaca(tx, {
          placaId,
          puertaId,
          nombre: 'Lector',
          claveHash: 'hash',
          ...(sentido === undefined ? {} : { sentido }),
        }),
      ),
    );
  };
  const sentidos = async (): Promise<string[]> => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT sentido FROM dispositivos WHERE puerta_id = ? AND revocado_at IS NULL ORDER BY id',
      [puertaId],
    );
    return filas.map((fila) => String(fila.sentido));
  };

  it('sin indicar sentido la placa queda como `ambos`', async () => {
    await vincular();
    expect(await sentidos()).toEqual(['ambos']);
  });

  it('entrada y salida conviven en la misma puerta', async () => {
    await vincular('entrada');
    await vincular('salida');
    expect(await sentidos()).toEqual(['entrada', 'salida']);
  });

  it('`ambos` y luego `entrada`: 409 dispositivo.sentido_en_conflicto y la segunda no se crea', async () => {
    await vincular('ambos');
    await expect(vincular('entrada')).rejects.toMatchObject({
      code: 'dispositivo.sentido_en_conflicto',
      status: 409,
    });
    expect(await sentidos()).toEqual(['ambos']);
  });

  it('`entrada` y luego `ambos`: 409 dispositivo.sentido_en_conflicto', async () => {
    await vincular('entrada');
    await expect(vincular('ambos')).rejects.toMatchObject({
      code: 'dispositivo.sentido_en_conflicto',
    });
    await expect(vincular()).rejects.toMatchObject({ code: 'dispositivo.sentido_en_conflicto' });
    expect(await sentidos()).toEqual(['entrada']);
  });

  it('dos placas en el mismo lado: 409 puerta.con_dispositivo', async () => {
    await vincular('salida');
    await expect(vincular('salida')).rejects.toMatchObject({
      code: 'puerta.con_dispositivo',
      status: 409,
    });
    await vincular('ambos').catch(() => undefined);
    expect(await sentidos()).toEqual(['salida']);
  });

  it('revocada la placa de un lado, ese lado vuelve a admitir otra', async () => {
    const id = await vincular('entrada');
    await prueba.pool.query('UPDATE dispositivos SET revocado_at = NOW(3) WHERE id = ?', [id]);
    await vincular('ambos');
    expect(await sentidos()).toEqual(['ambos']);
  });

  it('la base también impide dos placas en servicio del mismo lado, aunque se salte la acción', async () => {
    await crearDispositivo(prueba.pool, a.cuenta, puertaId, { sentido: 'entrada' });
    await expect(
      crearDispositivo(prueba.pool, a.cuenta, puertaId, { sentido: 'entrada' }),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('el sentido solo admite los tres valores (CHECK de la base)', async () => {
    await expect(
      prueba.pool.query(
        "INSERT INTO dispositivos (tenant_id, puerta_id, sentido, nombre, clave_hash) VALUES (?, ?, 'arriba', 'x', 'x')",
        [a.cuenta.id, puertaId],
      ),
    ).rejects.toMatchObject({ errno: 4025 });
  });

  it('dos vinculaciones simultáneas con `ambos` y `entrada` no pueden quedar las dos', async () => {
    const resultados = await Promise.allSettled([vincular('ambos'), vincular('entrada')]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await sentidos()).toHaveLength(1);
  });
});

describe('placas de AGROCOM: el sentido en la vinculación y en el inventario', () => {
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
    const admin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    acceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', admin.contrasena)).acceso;
  });

  const plataforma = (method: 'GET' | 'POST', url: string, payload?: object) =>
    prueba.app.inject({
      method,
      url: `/api/v1/plataforma${url}`,
      headers: conUsuario({ acceso }),
      ...(payload === undefined ? {} : { payload }),
    });

  it('el inventario expone el sentido del dispositivo de cada placa vinculada', async () => {
    const [placa] = await prueba.pool
      .query<RowDataPacket[] & { insertId: number }>(
        "INSERT INTO placas (mac, ultimo_anuncio_at) VALUES ('AA:BB:CC:00:11:99', NOW(3))",
      )
      .then(([resultado]) => [resultado]);
    await prueba.pool.query(
      "UPDATE dispositivos SET placa_id = ?, sentido = 'entrada' WHERE id = ?",
      [placa?.insertId, a.dispositivoPrincipal.id],
    );
    const respuesta = await plataforma('GET', '/placas');
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    const { datos } = respuesta.json<{
      datos: { dispositivo: { sentido: string } | null }[];
    }>();
    expect(datos[0]?.dispositivo).toMatchObject({ sentido: 'entrada' });
  });

  it('pedir vincular a una puerta que ya tiene placas en otro lado en `entrada` y `salida`: 409 sentido_en_conflicto (la nueva es `ambos`)', async () => {
    const puerta = await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Doble');
    await crearDispositivo(prueba.pool, a.cuenta, puerta.id, { sentido: 'entrada' });
    await prueba.pool.query(
      "INSERT INTO placas (mac, ultimo_anuncio_at) VALUES ('AA:BB:CC:00:22:33', NOW(3))",
    );
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT id FROM placas WHERE mac = 'AA:BB:CC:00:22:33'",
    );
    const respuesta = await plataforma('POST', `/placas/${String(filas[0]?.id)}/vincular`, {
      cuenta_id: a.cuenta.id,
      puerta_id: puerta.id,
      nombre: 'Lector',
    });
    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json<Problema>().code).toBe('dispositivo.sentido_en_conflicto');
    expect(await contarFilas(prueba.pool, 'placas', 'vinculo_puerta_id IS NOT NULL')).toBe(0);
  });
});
