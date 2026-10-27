import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearSuperAdmin,
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

interface Resolucion {
  resultado: string;
  motivo: string | null;
  resuelto_por: { id: string };
}
interface Incidente {
  id: string;
  estado: string;
  resolucion: Resolucion | null;
  historial?: Resolucion[];
}
interface Resultado {
  incidente: Incidente;
  reincidencia: { confirmados: number; propuesta: string | null } | null;
}

/** AGROCOM resuelve un incidente de uso de una cuenta (ADR 0033 §4.3, ola W11). */
describe('POST /plataforma/cuentas/:cuenta_id/incidentes/:id/resolucion', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let arbolB: Arbol;
  let sa: SuperAdminDePrueba;
  let superAcceso: string;
  let adminA: string;
  let adminB: string;

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
    sa = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    superAcceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena)).acceso;
    adminA = (await iniciarSesion(prueba.app, a.administrador.pin)).acceso;
    adminB = (await iniciarSesion(prueba.app, b.administrador.pin)).acceso;
  });

  /** El Administrador de la cuenta registra un incidente de `usuario` y devuelve su id. */
  async function registrar(acceso: string, usuario: UsuarioDePrueba): Promise<string> {
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/incidentes',
      headers: conUsuario({ acceso }),
      payload: { usuario_id: usuario.id, tipo: 'uso_masivo', gravedad: 'media' },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    return respuesta.json<{ id: string }>().id;
  }

  const resolver = (acceso: string | null, cuentaId: string, id: string, cuerpo: object) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/plataforma/cuentas/${cuentaId}/incidentes/${id}/resolucion`,
      headers: acceso === null ? {} : conUsuario({ acceso }),
      payload: cuerpo,
    });

  it('confirma con motivo: queda firmado por el super admin y evalúa la reincidencia', async () => {
    const id = await registrar(adminA, arbol.miembro1);
    const respuesta = await resolver(superAcceso, a.cuenta.id, id, {
      resultado: 'confirmado',
      motivo: 'revisado por AGROCOM',
    });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    const cuerpo = respuesta.json<Resultado>();
    expect(cuerpo.incidente).toMatchObject({ id, estado: 'confirmado' });
    expect(cuerpo.incidente.resolucion).toMatchObject({
      resultado: 'confirmado',
      motivo: 'revisado por AGROCOM',
      resuelto_por: { id: sa.id },
    });
    // Un solo confirmado no cruza el umbral: se evaluó, pero no hay paso que proponer.
    expect(cuerpo.reincidencia).toMatchObject({ confirmados: 1, propuesta: null });

    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT tenant_id, resuelto_por FROM resoluciones_de_incidente WHERE incidente_id = ?',
      [id],
    );
    expect(filas).toEqual([
      expect.objectContaining({ tenant_id: a.cuenta.id, resuelto_por: sa.id }),
    ]);
  });

  it('descarta sin motivo, deja historial y repetir el mismo resultado no anota nada nuevo', async () => {
    const id = await registrar(adminA, arbol.miembro1);
    const primera = await resolver(superAcceso, a.cuenta.id, id, { resultado: 'descartado' });
    expect(primera.statusCode, primera.body).toBe(200);
    expect(primera.json<Resultado>().reincidencia).toBeNull();
    await resolver(superAcceso, a.cuenta.id, id, { resultado: 'descartado' });
    expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(1);

    await resolver(superAcceso, a.cuenta.id, id, { resultado: 'pendiente' });
    expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(2);
  });

  it('confirmar sin motivo es 422 y no anota nada', async () => {
    const id = await registrar(adminA, arbol.miembro1);
    const respuesta = await resolver(superAcceso, a.cuenta.id, id, { resultado: 'confirmado' });
    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json<Problema>().code).toBe('incidente.motivo_requerido');
    expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
  });

  it('al llegar al umbral propone un paso y avisa a AGROCOM, igual que si lo resolviera la cuenta', async () => {
    let ultimo: Resultado | null = null;
    for (let i = 0; i < 3; i++) {
      const id = await registrar(adminA, arbol.miembro1);
      const respuesta = await resolver(superAcceso, a.cuenta.id, id, {
        resultado: 'confirmado',
        motivo: `caso ${i}`,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      ultimo = respuesta.json<Resultado>();
    }
    expect(ultimo?.reincidencia?.confirmados).toBe(3);
    expect(ultimo?.reincidencia?.propuesta).not.toBeNull();
    const [avisos] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT audiencia FROM cola_de_notificaciones WHERE agrupacion_clave LIKE 'incidente.propuesta:%' AND tenant_id = ?",
      [a.cuenta.id],
    );
    expect(avisos.map((aviso) => String(aviso.audiencia))).toContain('plataforma');
  });

  it('aislamiento: un incidente de B pedido en la cuenta A es 404, y viceversa; la cuenta inexistente también', async () => {
    const deB = await registrar(adminB, arbolB.miembro1);
    const cruzado = await resolver(superAcceso, a.cuenta.id, deB, { resultado: 'descartado' });
    expect(cruzado.statusCode).toBe(404);
    expect(cruzado.json<Problema>().code).toBe('incidente.no_encontrado');

    const deA = await registrar(adminA, arbol.miembro1);
    expect(
      (await resolver(superAcceso, b.cuenta.id, deA, { resultado: 'descartado' })).statusCode,
    ).toBe(404);

    const inexistente = await resolver(superAcceso, '999999', deA, { resultado: 'descartado' });
    expect(inexistente.statusCode).toBe(404);
    expect(inexistente.json<Problema>().code).toBe('cuenta.no_encontrada');
    expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
  });

  it('permisos: 401 sin sesión o con token de cuenta (aunque sea el Administrador), 403 sin el permiso', async () => {
    const id = await registrar(adminA, arbol.miembro1);
    const cuerpo = { resultado: 'descartado' };
    expect((await resolver(null, a.cuenta.id, id, cuerpo)).statusCode).toBe(401);
    expect((await resolver(adminA, a.cuenta.id, id, cuerpo)).statusCode).toBe(401);

    await prueba.pool.query(
      `DELETE rp FROM rol_permisos AS rp JOIN permisos AS p ON p.id = rp.permiso_id
        WHERE p.codigo = 'seguridad.incidente.resolver_cuenta'`,
    );
    const otro = await crearSuperAdmin(prueba.pool, 'sin.permiso');
    const sin = await iniciarSesionDePlataforma(prueba.app, 'sin.permiso', otro.contrasena);
    const denegado = await resolver(sin.acceso, a.cuenta.id, id, cuerpo);
    expect(denegado.statusCode).toBe(403);
    expect(denegado.json<Problema>().code).toBe('permiso.denegado');
    expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
  });

  it('el cuerpo es estricto: un resultado desconocido o un campo de más se rechazan', async () => {
    const id = await registrar(adminA, arbol.miembro1);
    expect((await resolver(superAcceso, a.cuenta.id, id, { resultado: 'x' })).statusCode).toBe(400);
    expect(
      (await resolver(superAcceso, a.cuenta.id, id, { resultado: 'descartado', otro: 1 }))
        .statusCode,
    ).toBe(400);
  });
});
