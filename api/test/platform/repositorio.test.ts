import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cargarConfig } from '../../src/config.js';
import {
  ContextoCuenta,
  SinContextoDeCuenta,
  type DatosContexto,
} from '../../src/platform/contexto/contexto-cuenta.js';
import { RepositorioDeCuenta } from '../../src/platform/db/repositorio-de-cuenta.js';
import { RepositorioDePlataforma } from '../../src/platform/db/repositorio-de-plataforma.js';
import { UsoIndebidoDeRepositorio } from '../../src/platform/db/repositorio-base.js';
import { crearPool } from '../../src/platform/db/pool.js';
import { enTransaccion, type Transaccion } from '../../src/platform/db/transaccion.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearCuenta, crearUsuarioConPin, type Cuenta } from '../helpers/fixtures.js';

class RepositorioDeSitios extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'sitios',
      columnas: ['nombre', 'direccion'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }
  crear(tx: Transaccion, nombre: string): Promise<string> {
    return this.insertar(tx, { nombre });
  }
  renombrar(tx: Transaccion, id: string, nombre: string): Promise<boolean> {
    return this.actualizar(tx, id, { nombre });
  }
  eliminar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
  todos(): Promise<RowDataPacket[]> {
    return this.seleccionar({ columnas: 't.id, t.nombre', orden: 't.id' });
  }
  insertarColumnaAjena(tx: Transaccion): Promise<string> {
    return this.insertar(tx, { nombre: 'x', tenant_id: '999' });
  }
}

class RepositorioDeUsuariosDePrueba extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'usuarios',
      columnas: ['etiqueta', 'pin_indice', 'pin_hash', 'pin_generado_at'],
      sensibles: ['pin_indice', 'pin_hash'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }
  crear(tx: Transaccion): Promise<string> {
    return this.insertar(tx, {
      etiqueta: 'Nuevo',
      pin_indice: 'i'.repeat(64),
      pin_hash: 'hash-secreto',
      pin_generado_at: new Date(),
    });
  }
}

class RepositorioDeEventosDePrueba extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'eventos_acceso',
      columnas: ['motivo_code'],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }
  intentarActualizar(tx: Transaccion): Promise<boolean> {
    return this.actualizar(tx, '1', { motivo_code: 'x' });
  }
  intentarBorrar(tx: Transaccion): Promise<boolean> {
    return this.borrar(tx, '1');
  }
}

class SitiosDePlataforma extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, { nombre: 'sitios', columnas: ['nombre'], perfil: 'dominio', deCuenta: true });
  }
  leerTodos(): Promise<RowDataPacket[]> {
    return this.seleccionar({ columnas: 't.id, t.tenant_id', orden: 't.id' });
  }
  intentarEscribir(tx: Transaccion): Promise<string> {
    return this.insertar(tx, { nombre: 'x' });
  }
}

function contexto(cuenta: Cuenta, usuarioId: string | null = null): DatosContexto {
  return { cuentaId: cuenta.id, usuarioId, rolActivoId: null, dispositivoId: null, origen: 'api' };
}

describe('repositorios base (aislamiento, soft delete, autoría y bitácora)', () => {
  let pool: Pool;
  let cuentaA: Cuenta;
  let cuentaB: Cuenta;

  beforeAll(() => {
    const config = cargarConfig();
    pool = crearPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_DATABASE,
      user: config.DB_USERNAME,
      password: config.DB_PASSWORD,
    });
  });
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await reiniciarBase(pool);
    cuentaA = await crearCuenta(pool, 'AAA');
    cuentaB = await crearCuenta(pool, 'BBB');
  });

  async function bitacoras(tabla: string): Promise<RowDataPacket[]> {
    const [filas] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM bitacoras WHERE tabla = ? ORDER BY id',
      [tabla],
    );
    return filas;
  }

  it('falla cerrado: sin contexto de cuenta no consulta ni escribe', async () => {
    const sitios = new RepositorioDeSitios(pool);
    await expect(sitios.todos()).rejects.toThrow(SinContextoDeCuenta);
    await expect(enTransaccion(pool, (tx) => sitios.crear(tx, 'X'))).rejects.toThrow(
      SinContextoDeCuenta,
    );
  });

  it('falla cerrado también en el contexto de plataforma (cuenta null)', async () => {
    const plataforma: DatosContexto = { ...contexto(cuentaA), cuentaId: null };
    await expect(
      ContextoCuenta.ejecutar(plataforma, () => new RepositorioDeSitios(pool).todos()),
    ).rejects.toThrow(SinContextoDeCuenta);
  });

  it('cada cuenta ve solo lo suyo y no puede tocar lo de otra', async () => {
    const sitios = new RepositorioDeSitios(pool);
    const idDeB = await ContextoCuenta.ejecutar(contexto(cuentaB), () =>
      enTransaccion(pool, (tx) => sitios.crear(tx, 'De B')),
    );
    await ContextoCuenta.ejecutar(contexto(cuentaA), () =>
      enTransaccion(pool, (tx) => sitios.crear(tx, 'De A')),
    );

    await ContextoCuenta.ejecutar(contexto(cuentaA), async () => {
      expect((await sitios.todos()).map((fila) => String(fila.nombre))).toEqual(['De A']);
      expect(await enTransaccion(pool, (tx) => sitios.renombrar(tx, idDeB, 'Hackeado'))).toBe(
        false,
      );
      expect(await enTransaccion(pool, (tx) => sitios.eliminar(tx, idDeB))).toBe(false);
    });

    await ContextoCuenta.ejecutar(contexto(cuentaB), async () => {
      expect((await sitios.todos()).map((fila) => String(fila.nombre))).toEqual(['De B']);
    });
  });

  it('el tenant_id lo pone el repositorio: no se puede escribir a mano', async () => {
    await ContextoCuenta.ejecutar(contexto(cuentaA), async () => {
      await expect(
        enTransaccion(pool, (tx) => new RepositorioDeSitios(pool).insertarColumnaAjena(tx)),
      ).rejects.toThrow(UsoIndebidoDeRepositorio);
    });
  });

  it('completa la autoría y escribe la bitácora de crear, actualizar y borrar', async () => {
    const usuario = await crearUsuarioConPin(pool, cuentaA, 'AB12', []);
    const sitios = new RepositorioDeSitios(pool);

    const id = await ContextoCuenta.ejecutar(contexto(cuentaA, usuario.id), async () => {
      const creado = await enTransaccion(pool, (tx) => sitios.crear(tx, 'Original'));
      await enTransaccion(pool, (tx) => sitios.renombrar(tx, creado, 'Renombrado'));
      await enTransaccion(pool, (tx) => sitios.eliminar(tx, creado));
      return creado;
    });

    const [fila] = (
      await pool.query<RowDataPacket[]>('SELECT * FROM sitios WHERE id = ?', [id])
    )[0];
    expect(String(fila?.created_by)).toBe(usuario.id);
    expect(String(fila?.updated_by)).toBe(usuario.id);
    expect(String(fila?.deleted_by)).toBe(usuario.id);
    expect(fila?.deleted_at).toBeInstanceOf(Date);

    const registros = await bitacoras('sitios');
    expect(registros.map((r) => String(r.accion))).toEqual(['creado', 'actualizado', 'eliminado']);
    expect(
      registros.every(
        (r) => String(r.tenant_id) === cuentaA.id && String(r.usuario_id) === usuario.id,
      ),
    ).toBe(true);
    expect(registros.every((r) => r.origen === 'api')).toBe(true);
    expect(registros[1]?.antes).toEqual({ nombre: 'Original' });
    expect(registros[1]?.despues).toEqual({ nombre: 'Renombrado' });
  });

  it('un registro borrado deja de aparecer, y su nombre se puede reutilizar (ADR 0016)', async () => {
    const sitios = new RepositorioDeSitios(pool);
    await ContextoCuenta.ejecutar(contexto(cuentaA), async () => {
      const id = await enTransaccion(pool, (tx) => sitios.crear(tx, 'Central'));
      await enTransaccion(pool, (tx) => sitios.eliminar(tx, id));
      expect(await sitios.todos()).toEqual([]);
      expect(await enTransaccion(pool, (tx) => sitios.renombrar(tx, id, 'Fantasma'))).toBe(false);
      await expect(enTransaccion(pool, (tx) => sitios.crear(tx, 'Central'))).resolves.toBeTruthy();
    });
    const [filas] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM sitios');
    expect(Number(filas[0]?.total)).toBe(2); // el borrado sigue en la base
  });

  it('la bitácora va en la misma transacción: si el cambio se revierte, no queda', async () => {
    const sitios = new RepositorioDeSitios(pool);
    await ContextoCuenta.ejecutar(contexto(cuentaA), async () => {
      await expect(
        enTransaccion(pool, async (tx) => {
          await sitios.crear(tx, 'Se revierte');
          throw new Error('falla después de escribir');
        }),
      ).rejects.toThrow('falla después de escribir');
    });
    expect(await bitacoras('sitios')).toEqual([]);
    const [filas] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM sitios');
    expect(Number(filas[0]?.total)).toBe(0);
  });

  it('las columnas sensibles (hashes) nunca llegan a la bitácora', async () => {
    await ContextoCuenta.ejecutar(contexto(cuentaA), () =>
      enTransaccion(pool, (tx) => new RepositorioDeUsuariosDePrueba(pool).crear(tx)),
    );
    const [registro] = await bitacoras('usuarios');
    expect(registro?.despues).toEqual(expect.objectContaining({ etiqueta: 'Nuevo' }));
    expect(JSON.stringify(registro?.despues)).not.toContain('hash-secreto');
    expect(Object.keys(registro?.despues as object)).not.toContain('pin_indice');
  });

  it('una tabla de solo inserción no se actualiza ni se borra', async () => {
    const eventos = new RepositorioDeEventosDePrueba(pool);
    await ContextoCuenta.ejecutar(contexto(cuentaA), async () => {
      await expect(enTransaccion(pool, (tx) => eventos.intentarActualizar(tx))).rejects.toThrow(
        UsoIndebidoDeRepositorio,
      );
      await expect(enTransaccion(pool, (tx) => eventos.intentarBorrar(tx))).rejects.toThrow(
        UsoIndebidoDeRepositorio,
      );
    });
  });

  it('el repositorio de plataforma lee sin filtro de cuenta, pero nunca escribe una tabla de cuenta', async () => {
    await ContextoCuenta.ejecutar(contexto(cuentaA), () =>
      enTransaccion(pool, (tx) => new RepositorioDeSitios(pool).crear(tx, 'De A')),
    );
    await ContextoCuenta.ejecutar(contexto(cuentaB), () =>
      enTransaccion(pool, (tx) => new RepositorioDeSitios(pool).crear(tx, 'De B')),
    );
    const plataforma = new SitiosDePlataforma(pool);
    expect(await plataforma.leerTodos()).toHaveLength(2);
    await expect(enTransaccion(pool, (tx) => plataforma.intentarEscribir(tx))).rejects.toThrow(
      UsoIndebidoDeRepositorio,
    );
  });

  it('un repositorio de cuenta no se puede construir sobre una tabla de plataforma', () => {
    class Mal extends RepositorioDeCuenta {
      constructor() {
        super(pool, {
          nombre: 'permisos',
          columnas: ['codigo'],
          perfil: 'dominio',
          deCuenta: false,
        });
      }
    }
    expect(() => new Mal()).toThrow(UsoIndebidoDeRepositorio);
  });
});
