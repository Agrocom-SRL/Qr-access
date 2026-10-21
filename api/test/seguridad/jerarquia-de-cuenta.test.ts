import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearRol,
  crearSuperAdmin,
  crearUsuarioConPin,
  type Escenario,
  type SuperAdminDePrueba,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

const BASE = '/api/v1/plataforma';

interface Jerarquia {
  administradores: {
    id: string;
    etiqueta: string | null;
    guardias: { id: string; etiqueta: string | null }[];
    titulares: { id: string; etiqueta: string | null; unidad: string | null; miembros: number }[];
  }[];
}

describe('plataforma: Administradores de la cuenta, jerarquía y reasignación (ADR 0028)', () => {
  let prueba: AppDePrueba;
  let lucia: SuperAdminDePrueba;
  let headers: { authorization: string };
  let a: Escenario;
  let b: Escenario;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const agregarAdministrador = (cuentaId: string, cuerpo: object, cabeceras = headers) =>
    prueba.app.inject({
      method: 'POST',
      url: `${BASE}/cuentas/${cuentaId}/administradores`,
      headers: cabeceras,
      payload: cuerpo,
    });
  const jerarquia = async (cuentaId: string): Promise<Jerarquia> =>
    (
      await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/cuentas/${cuentaId}/jerarquia`,
        headers,
      })
    ).json<Jerarquia>();
  const reasignar = (cuentaId: string, usuarioId: string, administradorId: string) =>
    prueba.app.inject({
      method: 'POST',
      url: `${BASE}/cuentas/${cuentaId}/reasignaciones`,
      headers,
      payload: { usuario_id: usuarioId, administrador_id: administradorId },
    });
  const superiorDe = async (usuarioId: string): Promise<string | null> => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT superior_id FROM usuarios WHERE id = ?',
      [usuarioId],
    );
    const fila = filas[0] as { superior_id: string | null } | undefined;
    return fila?.superior_id ?? null;
  };

  /** A tiene su administrador (AD01), un Titular con una unidad y dos Miembros, y un Guardia. */
  async function armarRamaDeA() {
    const { pool } = prueba;
    const titular = await crearUsuarioConPin(pool, a.cuenta, 'TI01', [a.rolTitularId], {
      superiorId: a.administrador.id,
    });
    await pool.query(
      'INSERT INTO unidades (tenant_id, sitio_id, nombre, titular_id) VALUES (?, ?, ?, ?)',
      [a.cuenta.id, a.sitioId, 'Casa 12', titular.id],
    );
    const miembros: UsuarioDePrueba[] = [];
    for (const sufijo of ['MI01', 'MI02']) {
      miembros.push(
        await crearUsuarioConPin(pool, a.cuenta, sufijo, [a.rolMiembroId], {
          superiorId: titular.id,
        }),
      );
    }
    const rolGuardia = await crearRol(pool, a.cuenta, 'Guardia', ['organizacion.puerta.ver']);
    const guardia = await crearUsuarioConPin(pool, a.cuenta, 'GU01', [rolGuardia], {
      superiorId: a.administrador.id,
    });
    return { titular, miembros, guardia };
  }

  describe('POST /plataforma/cuentas/:id/administradores', () => {
    it('suma un Administrador con PIN que se ve una sola vez y que entra con su rol', async () => {
      const respuesta = await agregarAdministrador(a.cuenta.id, { etiqueta: '  Rosa Vaca ' });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const creado = respuesta.json<{ id: string; etiqueta: string; pin: string }>();
      expect(creado.etiqueta).toBe('Rosa Vaca');
      expect(creado.pin).toMatch(/^AAA[A-Z0-9]{4}$/);

      const ingreso = await iniciarSesion(prueba.app, creado.pin);
      expect(ingreso.rol_activo_id).toBe(a.rolAdministradorId);
      // Raíz de su propia rama
      expect(await superiorDe(creado.id)).toBeNull();
      // Ni la lista de administradores ni la base guardan el PIN en claro
      const lista = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/cuentas/${a.cuenta.id}/administradores`,
        headers,
      });
      expect(lista.body).not.toContain(creado.pin);
      expect(lista.json<{ datos: { id: string }[] }>().datos.map((x) => x.id)).toContain(creado.id);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT pin_hash FROM usuarios WHERE id = ?',
        [creado.id],
      );
      expect(String(filas[0]?.pin_hash)).toMatch(/^\$argon2id\$/);
      // Queda en la bitácora, firmada por el super admin y sin el PIN
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id, despues FROM bitacoras WHERE tabla = 'usuarios' AND registro_id = ? AND accion = 'creado'",
        [creado.id],
      );
      expect(String(bitacora[0]?.usuario_id)).toBe(lucia.id);
      expect(JSON.stringify(bitacora[0]?.despues)).not.toContain(creado.pin);
    });

    it('con los 4 caracteres elegidos, y uno repetido en la cuenta es 409', async () => {
      const primero = await agregarAdministrador(a.cuenta.id, { etiqueta: 'Uno', sufijo: 'ad77' });
      expect(primero.json<{ pin: string }>().pin).toBe('AAAAD77');
      const repetido = await agregarAdministrador(a.cuenta.id, { etiqueta: 'Dos', sufijo: 'AD77' });
      expect(repetido.statusCode).toBe(409);
      expect(repetido.json<Problema>().code).toBe('pin.sufijo_en_uso');
    });

    it('cuenta en el cupo del plan', async () => {
      await prueba.pool.query('UPDATE planes SET max_usuarios = 2');
      const antes = await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id]);
      const respuesta = await agregarAdministrador(a.cuenta.id, { etiqueta: 'Tercero' });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json()).toMatchObject({ code: 'plan.limite_usuarios', maximo: 2 });
      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [a.cuenta.id])).toBe(
        antes,
      );
    });

    it('sin suscripción vigente no suma Administradores', async () => {
      await prueba.pool.query('UPDATE suscripciones SET estado = ? WHERE tenant_id = ?', [
        'vencida',
        a.cuenta.id,
      ]);
      const respuesta = await agregarAdministrador(a.cuenta.id, { etiqueta: 'Nuevo' });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('suscripcion.vencida');
    });

    it('valida el cuerpo y una cuenta inexistente es 404', async () => {
      expect((await agregarAdministrador(a.cuenta.id, { etiqueta: '' })).statusCode).toBe(400);
      expect((await agregarAdministrador('99999999', { etiqueta: 'X' })).statusCode).toBe(404);
    });

    it('solo AGROCOM: el Administrador de una cuenta no puede (401)', async () => {
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const respuesta = await agregarAdministrador(
        a.cuenta.id,
        { etiqueta: 'Intruso' },
        conUsuario(sesion),
      );
      expect(respuesta.statusCode).toBe(401);
    });

    it('aislamiento: suma en la cuenta indicada y la otra no cambia', async () => {
      const antesB = await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [b.cuenta.id]);
      await agregarAdministrador(a.cuenta.id, { etiqueta: 'Solo de A' });
      expect(await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ?', [b.cuenta.id])).toBe(
        antesB,
      );
    });
  });

  describe('GET /plataforma/cuentas/:id/jerarquia', () => {
    it('muestra cada Administrador con sus Guardias y Titulares (unidad y Miembros)', async () => {
      const { titular, guardia } = await armarRamaDeA();
      const segundo = (await agregarAdministrador(a.cuenta.id, { etiqueta: 'Rosa Vaca' })).json<{
        id: string;
      }>();

      const arbol = await jerarquia(a.cuenta.id);
      const rama = arbol.administradores.find((x) => x.id === a.administrador.id);
      expect(rama?.guardias).toEqual([{ id: guardia.id, etiqueta: `Usuario ${guardia.pin}` }]);
      expect(rama?.titulares).toEqual([
        { id: titular.id, etiqueta: `Usuario ${titular.pin}`, unidad: 'Casa 12', miembros: 2 },
      ]);
      // El Miembro directo del escenario no es ni Guardia ni Titular: no aparece en las ramas
      const vacia = arbol.administradores.find((x) => x.id === segundo.id);
      expect(vacia).toMatchObject({ guardias: [], titulares: [] });
    });

    it('aislamiento: una cuenta nunca muestra usuarios de otra', async () => {
      await armarRamaDeA();
      const arbolB = await jerarquia(b.cuenta.id);
      expect(arbolB.administradores.map((x) => x.id)).toEqual([b.administrador.id]);
      expect(JSON.stringify(arbolB)).not.toContain(a.administrador.id);
    });

    it('una cuenta inexistente es 404', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/cuentas/99999999/jerarquia`,
        headers,
      });
      expect(respuesta.statusCode).toBe(404);
    });
  });

  describe('POST /plataforma/cuentas/:id/reasignaciones', () => {
    async function conOtroAdministrador() {
      const rama = await armarRamaDeA();
      const otro = (await agregarAdministrador(a.cuenta.id, { etiqueta: 'Rosa Vaca' })).json<{
        id: string;
        pin: string;
      }>();
      return { ...rama, otro };
    }

    it('mueve un Titular con su unidad y sus Miembros a otro Administrador', async () => {
      const { titular, miembros, otro } = await conOtroAdministrador();
      const sesionOtro = await iniciarSesion(prueba.app, otro.pin);

      const respuesta = await reasignar(a.cuenta.id, titular.id, otro.id);
      expect(respuesta.statusCode, respuesta.body).toBe(204);

      expect(await superiorDe(titular.id)).toBe(otro.id);
      // Los Miembros siguen colgando de su Titular, no cambian de Titular
      for (const miembro of miembros) expect(await superiorDe(miembro.id)).toBe(titular.id);

      // Ahora el nuevo Administrador ve toda la rama y el anterior ya no
      const ids = async (sesion: Awaited<ReturnType<typeof iniciarSesion>>) =>
        (
          await prueba.app.inject({
            method: 'GET',
            url: '/api/v1/usuarios',
            headers: conUsuario(sesion),
          })
        )
          .json<{ datos: { id: string }[] }>()
          .datos.map((u) => u.id);
      expect((await ids(sesionOtro)).sort()).toEqual(
        [titular.id, ...miembros.map((m) => m.id)].sort(),
      );
      const sesionAnterior = await iniciarSesion(prueba.app, a.administrador.pin);
      const delAnterior = await ids(sesionAnterior);
      expect(delAnterior).not.toContain(titular.id);
      for (const miembro of miembros) expect(delAnterior).not.toContain(miembro.id);

      // Y la ficha lo muestra en su nueva rama
      const arbol = await jerarquia(a.cuenta.id);
      expect(arbol.administradores.find((x) => x.id === otro.id)?.titulares[0]).toMatchObject({
        id: titular.id,
        unidad: 'Casa 12',
        miembros: 2,
      });
    });

    it('mueve un Guardia', async () => {
      const { guardia, otro } = await conOtroAdministrador();
      expect((await reasignar(a.cuenta.id, guardia.id, otro.id)).statusCode).toBe(204);
      expect(await superiorDe(guardia.id)).toBe(otro.id);
    });

    it('queda en la bitácora con el super admin como autor y el antes y después', async () => {
      const { guardia, otro } = await conOtroAdministrador();
      await reasignar(a.cuenta.id, guardia.id, otro.id);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id, antes, despues FROM bitacoras WHERE tabla = 'usuarios' AND registro_id = ? AND accion = 'actualizado'",
        [guardia.id],
      );
      expect(filas).toHaveLength(1);
      expect(String(filas[0]?.usuario_id)).toBe(lucia.id);
      expect(JSON.stringify(filas[0]?.antes)).toContain(a.administrador.id);
      expect(JSON.stringify(filas[0]?.despues)).toContain(otro.id);
    });

    it('el cupo no cambia y las sesiones del movido siguen vivas', async () => {
      const { guardia, otro } = await conOtroAdministrador();
      const sesionGuardia = await iniciarSesion(prueba.app, guardia.pin);
      const antes = await contarFilas(
        prueba.pool,
        'usuarios',
        'tenant_id = ? AND deleted_at IS NULL',
        [a.cuenta.id],
      );
      await reasignar(a.cuenta.id, guardia.id, otro.id);
      expect(
        await contarFilas(prueba.pool, 'usuarios', 'tenant_id = ? AND deleted_at IS NULL', [
          a.cuenta.id,
        ]),
      ).toBe(antes);
      const actual = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesionGuardia),
      });
      expect(actual.statusCode).toBe(200);
    });

    it('un Miembro no se reasigna (sigue a su Titular) ni un Administrador', async () => {
      const { miembros, otro } = await conOtroAdministrador();
      const deMiembro = await reasignar(a.cuenta.id, miembros[0]?.id ?? '', otro.id);
      expect(deMiembro.statusCode).toBe(422);
      expect(deMiembro.json<Problema>().code).toBe('reasignacion.nivel_invalido');
      const deAdministrador = await reasignar(a.cuenta.id, a.administrador.id, otro.id);
      expect(deAdministrador.statusCode).toBe(422);
      expect(deAdministrador.json<Problema>().code).toBe('reasignacion.nivel_invalido');
    });

    it('al mismo Administrador que ya lo tiene es 422 y nada cambia', async () => {
      const { guardia } = await conOtroAdministrador();
      const respuesta = await reasignar(a.cuenta.id, guardia.id, a.administrador.id);
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('reasignacion.mismo_administrador');
      expect(await superiorDe(guardia.id)).toBe(a.administrador.id);
    });

    it('el destino tiene que ser un Administrador de esa cuenta (404)', async () => {
      const { guardia, titular } = await conOtroAdministrador();
      // Un Titular no es destino válido
      const aTitular = await reasignar(a.cuenta.id, guardia.id, titular.id);
      expect(aTitular.statusCode).toBe(404);
      expect(aTitular.json<Problema>().code).toBe('administrador.no_encontrado');
      // Ni el Administrador de otra cuenta
      const aOtraCuenta = await reasignar(a.cuenta.id, guardia.id, b.administrador.id);
      expect(aOtraCuenta.statusCode).toBe(404);
      expect(await superiorDe(guardia.id)).toBe(a.administrador.id);
    });

    it('aislamiento: no mueve un usuario de otra cuenta aunque se pida por la cuenta A', async () => {
      const { otro } = await conOtroAdministrador();
      const respuesta = await reasignar(a.cuenta.id, b.usuario.id, otro.id);
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
      expect(await superiorDe(b.usuario.id)).toBe(b.administrador.id);
    });

    it('solo AGROCOM: un Administrador de la cuenta no reasigna (401)', async () => {
      const { guardia, otro } = await conOtroAdministrador();
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: `${BASE}/cuentas/${a.cuenta.id}/reasignaciones`,
        headers: conUsuario(sesion),
        payload: { usuario_id: guardia.id, administrador_id: otro.id },
      });
      expect(respuesta.statusCode).toBe(401);
      expect(await superiorDe(guardia.id)).toBe(a.administrador.id);
    });
  });

  describe('tope de Miembros por Titular', () => {
    const editar = (cuentaId: string, cambios: object) =>
      prueba.app.inject({
        method: 'PATCH',
        url: `${BASE}/cuentas/${cuentaId}`,
        headers,
        payload: {
          razon_social: 'Cuenta AAA',
          nit: null,
          ciudad: 'Warnes',
          contacto_nombre: 'Ana',
          contacto_apellido: 'Rojas',
          contacto_telefono: null,
          contacto_correo: null,
          ...cambios,
        },
      });
    const detalle = async (cuentaId: string) =>
      (
        await prueba.app.inject({ method: 'GET', url: `${BASE}/cuentas/${cuentaId}`, headers })
      ).json<{ cuenta: { max_miembros_por_titular: number } }>();

    it('la ficha lo muestra (10 por defecto) y AGROCOM lo cambia al editar la cuenta', async () => {
      expect((await detalle(a.cuenta.id)).cuenta.max_miembros_por_titular).toBe(10);
      const respuesta = await editar(a.cuenta.id, { max_miembros_por_titular: 3 });
      expect(respuesta.statusCode, respuesta.body).toBe(204);
      expect((await detalle(a.cuenta.id)).cuenta.max_miembros_por_titular).toBe(3);
      // Solo cambia la cuenta indicada
      expect((await detalle(b.cuenta.id)).cuenta.max_miembros_por_titular).toBe(10);
      // El Administrador lo ve en su cupo
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const cupo = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/cupo',
        headers: conUsuario(sesion),
      });
      expect(cupo.json()).toMatchObject({ max_miembros_por_titular: 3 });
    });

    it('sin mandarlo, no cambia; y los valores fuera de rango son 400', async () => {
      await editar(a.cuenta.id, { max_miembros_por_titular: 5 });
      expect((await editar(a.cuenta.id, {})).statusCode).toBe(204);
      expect((await detalle(a.cuenta.id)).cuenta.max_miembros_por_titular).toBe(5);
      for (const invalido of [0, -1, 501, 2.5]) {
        expect((await editar(a.cuenta.id, { max_miembros_por_titular: invalido })).statusCode).toBe(
          400,
        );
      }
    });

    it('el cambio queda en la bitácora de la cuenta', async () => {
      await editar(a.cuenta.id, { max_miembros_por_titular: 4 });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id FROM bitacoras WHERE tabla = 'cuentas' AND registro_id = ? AND accion = 'actualizado'",
        [a.cuenta.id],
      );
      expect(filas.length).toBeGreaterThan(0);
      expect(String(filas[0]?.usuario_id)).toBe(lucia.id);
    });
  });
});
