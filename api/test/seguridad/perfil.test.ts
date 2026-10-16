import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Sesion } from '../helpers/http.js';

describe('PATCH /api/v1/perfil: cada persona edita su propio nombre', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesionUsuario: Sesion;

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
    sesionUsuario = await iniciarSesion(prueba.app, a.usuario.pin);
  });

  const editar = (sesion: Sesion | null, payload: object) =>
    prueba.app.inject({
      method: 'PATCH',
      url: '/api/v1/perfil',
      ...(sesion === null ? {} : { headers: conUsuario(sesion) }),
      payload,
    });
  const etiquetaDe = async (id: string) => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT etiqueta FROM usuarios WHERE id = ?',
      [id],
    );
    return filas[0]?.etiqueta as string;
  };

  it('un usuario sin permisos especiales cambia su nombre, y se ve en su sesión', async () => {
    const respuesta = await editar(sesionUsuario, { etiqueta: '  Jorge Rivero ' });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    expect(respuesta.json()).toEqual({ id: a.usuario.id, etiqueta: 'Jorge Rivero' });

    const actual = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/sesiones/actual',
      headers: conUsuario(sesionUsuario),
    });
    expect(actual.json<{ usuario: { etiqueta: string } }>().usuario.etiqueta).toBe('Jorge Rivero');
  });

  it('solo toca al propio usuario: ni otros de su cuenta ni los de otra cuenta cambian', async () => {
    const otroAntes = await etiquetaDe(a.administrador.id);
    const ajenoAntes = await etiquetaDe(b.usuario.id);
    await editar(sesionUsuario, { etiqueta: 'Solo yo', id: b.usuario.id });
    expect(await etiquetaDe(a.administrador.id)).toBe(otroAntes);
    expect(await etiquetaDe(b.usuario.id)).toBe(ajenoAntes);
    expect(await etiquetaDe(a.usuario.id)).toBe('Solo yo');
  });

  it('no cambia el PIN ni los roles', async () => {
    await editar(sesionUsuario, {
      etiqueta: 'Nuevo',
      rol_ids: [a.rolAdministradorId],
      pin: 'AAAZZZZ',
    });
    expect((await iniciarSesion(prueba.app, a.usuario.pin)).acceso).toBeTruthy();
    const [roles] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT rol_id FROM usuario_roles WHERE usuario_id = ? AND deleted_at IS NULL',
      [a.usuario.id],
    );
    expect(roles.map((fila) => String(fila.rol_id))).toEqual([a.rolUsuarioId]);
  });

  it('rechaza un nombre vacío o demasiado largo (400) y exige sesión (401)', async () => {
    expect((await editar(sesionUsuario, { etiqueta: '   ' })).statusCode).toBe(400);
    expect((await editar(sesionUsuario, { etiqueta: 'x'.repeat(200) })).statusCode).toBe(400);
    expect((await editar(null, { etiqueta: 'Intruso' })).statusCode).toBe(401);
  });
});
