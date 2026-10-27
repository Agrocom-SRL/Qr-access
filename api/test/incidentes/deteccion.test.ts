import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearServicioDeIncidentes } from '../../src/modules/incidentes/contracts.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import { enTransaccion, type Transaccion } from '../../src/platform/db/transaccion.js';
import { crearTareas } from '../../src/tareas.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import { contarFilas, crearEscenario, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion } from '../helpers/http.js';

const AHORA = new Date('2026-11-10T12:00:00.000Z');
const HORA = 3_600_000;
const hace = (horas: number) => new Date(AHORA.getTime() - horas * HORA);

interface IncidenteFila extends RowDataPacket {
  id: string;
  tenant_id: string;
  usuario_id: string;
  tipo: string;
  gravedad: string;
  origen: string;
  registrado_por: string | null;
  evidencia: string | { evento_limite_ids: string[] };
  clave_unica: string | null;
}

describe('incidentes del sistema: contrato y detector de generación ruidosa (ADR 0033 §4.1)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let arbolB: Arbol;

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
  });

  /** `n` eventos del tipo, uno por hora hacia atrás desde `desde`. */
  async function rechazos(
    escenario: Escenario,
    usuarioId: string,
    n: number,
    opciones: { tipo?: string; desde?: Date } = {},
  ): Promise<void> {
    const desde = opciones.desde ?? AHORA;
    for (let i = 0; i < n; i++) {
      await prueba.pool.query(
        'INSERT INTO eventos_de_limite (tenant_id, usuario_id, tipo, valor, tope, ocurrido_at) VALUES (?, ?, ?, 5, 5, ?)',
        [
          escenario.cuenta.id,
          usuarioId,
          opciones.tipo ?? 'qr.limite_diario',
          new Date(desde.getTime() - i * 60_000),
        ],
      );
    }
  }

  const detectar = (ahora: Date = AHORA) => {
    const tarea = crearTareas(prueba.pool).find(
      (t) => t.nombre === 'incidentes-de-generacion-ruidosa',
    );
    expect(tarea).toBeDefined();
    const errores: unknown[] = [];
    return tarea
      ?.ejecutar(ahora, (e) => errores.push(e))
      .then((resultado) => {
        expect(errores).toEqual([]);
        return resultado as { revisados: number; incidentes: number; errores: number };
      });
  };

  const incidentes = async () => {
    const [filas] = await prueba.pool.query<IncidenteFila[]>(
      'SELECT * FROM incidentes_uso ORDER BY id',
    );
    return filas;
  };

  it('abre un incidente generacion_ruidosa a quien repite rechazos por tope, con sus ids como evidencia', async () => {
    await rechazos(a, arbol.miembro1.id, 5);
    expect(await detectar()).toEqual({ revisados: 1, incidentes: 1, errores: 0 });

    const [fila] = await incidentes();
    expect(fila).toMatchObject({
      tenant_id: a.cuenta.id,
      usuario_id: arbol.miembro1.id,
      tipo: 'generacion_ruidosa',
      gravedad: 'baja',
      origen: 'sistema',
      registrado_por: null,
    });
    const evidencia =
      typeof fila?.evidencia === 'string'
        ? (JSON.parse(fila.evidencia) as { evento_limite_ids: string[]; qr_ids: string[] })
        : fila?.evidencia;
    expect(evidencia).toMatchObject({ qr_ids: [], evento_acceso_ids: [] });
    expect((evidencia as { evento_limite_ids: string[] }).evento_limite_ids).toHaveLength(5);
  });

  it('es idempotente por usuario y día: correrlo cada pocos minutos no llena la lista', async () => {
    await rechazos(a, arbol.miembro1.id, 6);
    await detectar();
    expect(await detectar(new Date(AHORA.getTime() + 5 * 60_000))).toMatchObject({
      revisados: 1,
      incidentes: 0,
    });
    expect(await incidentes()).toHaveLength(1);
    // Al día siguiente, mientras siga repitiendo, se abre otro.
    const manana = new Date(AHORA.getTime() + 24 * HORA);
    await rechazos(a, arbol.miembro1.id, 5, { desde: manana });
    expect(await detectar(manana)).toMatchObject({ incidentes: 1 });
    expect(await incidentes()).toHaveLength(2);
  });

  it('no abre nada por debajo del umbral, fuera de la ventana ni por marcas que no son rechazos', async () => {
    await rechazos(a, arbol.miembro1.id, 4);
    await rechazos(a, arbol.miembro1b.id, 9, { desde: hace(30) });
    await rechazos(a, arbol.titular1.id, 9, { tipo: 'qr.reemplazo_sin_uso' });
    await rechazos(a, arbol.titular2.id, 9, { tipo: 'bolsa.aviso' });
    expect(await detectar()).toEqual({ revisados: 0, incidentes: 0, errores: 0 });
    expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
  });

  it('cuenta los tres tipos de rechazo por tope juntos', async () => {
    await rechazos(a, arbol.miembro1.id, 2, { tipo: 'qr.limite_diario' });
    await rechazos(a, arbol.miembro1.id, 2, { tipo: 'qr.limite_pendientes' });
    await rechazos(a, arbol.miembro1.id, 1, { tipo: 'qr.limite_propios_sin_uso' });
    expect(await detectar()).toMatchObject({ incidentes: 1 });
  });

  it('el umbral y la ventana salen de la configuración de la plataforma', async () => {
    await rechazos(a, arbol.miembro1.id, 2);
    expect(await detectar()).toMatchObject({ incidentes: 0 });
    await prueba.pool.query(
      "UPDATE configuracion_limites SET valor = 2 WHERE clave = 'incidente.rechazos_generacion_minimo'",
    );
    expect(await detectar()).toMatchObject({ incidentes: 1 });
    // Otro usuario con 3 rechazos de hace 10 horas: con una ventana de 6 h no cuenta, con una de 12 h sí.
    await rechazos(a, arbol.miembro1b.id, 3, { desde: hace(10) });
    await prueba.pool.query(
      "UPDATE configuracion_limites SET valor = 6 WHERE clave = 'incidente.rechazos_generacion_ventana_horas'",
    );
    expect(await detectar()).toMatchObject({ incidentes: 0 });
    await prueba.pool.query(
      "UPDATE configuracion_limites SET valor = 12 WHERE clave = 'incidente.rechazos_generacion_ventana_horas'",
    );
    expect(await detectar()).toMatchObject({ incidentes: 1 });
  });

  it('cada incidente queda en SU cuenta y a nombre de un usuario de ella', async () => {
    await rechazos(a, arbol.miembro1.id, 5);
    await rechazos(b, arbolB.miembro1.id, 5);
    expect(await detectar()).toMatchObject({ revisados: 2, incidentes: 2 });
    const filas = await incidentes();
    expect(filas.find((f) => f.tenant_id === a.cuenta.id)?.usuario_id).toBe(arbol.miembro1.id);
    expect(filas.find((f) => f.tenant_id === b.cuenta.id)?.usuario_id).toBe(arbolB.miembro1.id);
    // Y cada Administrador ve solo el suyo.
    const adminA = await iniciarSesion(prueba.app, a.administrador.pin);
    const lista = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/incidentes',
      headers: conUsuario(adminA),
    });
    const cuerpo = lista.json<{
      datos: { usuario: { id: string }; origen: string; estado: string; registrado_por: unknown }[];
    }>();
    expect(cuerpo.datos).toEqual([
      expect.objectContaining<Record<string, unknown>>({
        usuario: expect.objectContaining({ id: arbol.miembro1.id }),
        origen: 'sistema',
        estado: 'sin_resolver',
        registrado_por: null,
      }),
    ]);
  });

  it('un incidente del sistema no limita a nadie: ni estado, ni sesión, ni QR', async () => {
    await rechazos(a, arbol.miembro1.id, 8);
    await detectar();
    const [usuarios] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT estado FROM usuarios WHERE id = ?',
      [arbol.miembro1.id],
    );
    expect(usuarios[0]?.estado).toBe('activo');
    expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
  });

  describe('el contrato para otros detectores (ola W12)', () => {
    const comoSistema = <T>(escenario: Escenario, fn: () => Promise<T>): Promise<T> =>
      ContextoCuenta.ejecutarEn(escenario.cuenta.id, fn);

    it('crea un incidente del sistema, idempotente por clave, sin autor ni resolución', async () => {
      const servicio = crearServicioDeIncidentes(prueba.pool);
      const datos = {
        usuarioId: arbol.guardia.id,
        tipo: 'uso_masivo' as const,
        gravedad: 'media' as const,
        evidencia: { qr_ids: ['1'], evento_acceso_ids: ['2'] },
        claveUnica: 'uso_masivo:guardia:2026-11-10',
        ocurridoAt: AHORA,
      };
      const primero = await comoSistema(a, () => servicio.registrarDelSistema(datos));
      const repetido = await comoSistema(a, () => servicio.registrarDelSistema(datos));
      expect(primero).not.toBeNull();
      expect(repetido).toBeNull();
      const [fila] = await incidentes();
      expect(fila).toMatchObject({ origen: 'sistema', registrado_por: null, tipo: 'uso_masivo' });
    });

    it('la misma clave en otra cuenta es otro incidente (la clave es por cuenta)', async () => {
      const servicio = crearServicioDeIncidentes(prueba.pool);
      const datos = (usuarioId: string) => ({
        usuarioId,
        tipo: 'otro' as const,
        gravedad: 'baja' as const,
        claveUnica: 'clave-comun',
        ocurridoAt: AHORA,
      });
      expect(
        await comoSistema(a, () => servicio.registrarDelSistema(datos(arbol.miembro1.id))),
      ).not.toBeNull();
      expect(
        await comoSistema(b, () => servicio.registrarDelSistema(datos(arbolB.miembro1.id))),
      ).not.toBeNull();
    });

    it('no admite un usuario de otra cuenta (404): un detector equivocado no cruza cuentas', async () => {
      const servicio = crearServicioDeIncidentes(prueba.pool);
      await expect(
        comoSistema(a, () =>
          servicio.registrarDelSistema({
            usuarioId: arbolB.miembro1.id,
            tipo: 'otro',
            gravedad: 'baja',
            claveUnica: 'x',
            ocurridoAt: AHORA,
          }),
        ),
      ).rejects.toMatchObject({ code: 'usuario.no_encontrado', status: 404 });
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('sin contexto de cuenta falla cerrado', async () => {
      const servicio = crearServicioDeIncidentes(prueba.pool);
      await expect(
        servicio.registrarDelSistema({
          usuarioId: arbol.miembro1.id,
          tipo: 'otro',
          gravedad: 'baja',
          claveUnica: 'x',
          ocurridoAt: AHORA,
        }),
      ).rejects.toThrow();
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });
  });

  it('las tablas de incidentes y resoluciones son de solo inserción: el repositorio base se niega a editar o borrar', async () => {
    const { RepositorioDeIncidentes, RepositorioDeResoluciones } =
      await import('../../src/modules/incidentes/repository.js');
    interface Escritura {
      actualizar(tx: Transaccion, id: string, cambios: object): Promise<boolean>;
      borrar(tx: Transaccion, id: string): Promise<boolean>;
    }
    for (const repositorio of [
      new RepositorioDeIncidentes(prueba.pool),
      new RepositorioDeResoluciones(prueba.pool),
    ] as unknown as Escritura[]) {
      await ContextoCuenta.ejecutarEn(a.cuenta.id, () =>
        enTransaccion(prueba.pool, async (tx) => {
          await expect(repositorio.actualizar(tx, '1', { gravedad: 'alta' })).rejects.toThrow(
            /solo inserción/,
          );
          await expect(repositorio.borrar(tx, '1')).rejects.toThrow(/no se borra/);
        }),
      );
    }
  });
});
