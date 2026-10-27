import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as anularMasivoDeCuenta } from '../../src/modules/accesos/actions/anular-masivo-de-cuenta.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import type { PrincipalPlataforma } from '../../src/platform/seguridad/principal.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
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

interface Resultado {
  id: string;
  alcance: string;
  usuario_id: string | null;
  usuarios_alcanzados: number;
  qr_anulados: number;
}

const MOTIVO = 'incidente reportado a AGROCOM';

/**
 * AGROCOM sobre los accesos de UNA cuenta: anulación masiva y exportación (ADR 0033 §3, ola W11). Las acciones son
 * las mismas que usa la cuenta; aquí se prueba lo propio: quién puede, a qué cuenta llega y cómo queda firmado.
 */
describe('AGROCOM: anulación masiva y exportación de una cuenta', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let arbolB: Arbol;
  let sa: SuperAdminDePrueba;
  let superAcceso: string;
  let adminA: string;

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
  });

  const anular = (acceso: string | null, cuentaId: string, cuerpo: object) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/plataforma/cuentas/${cuentaId}/qr-accesos/anulacion-masiva`,
      headers: acceso === null ? {} : conUsuario({ acceso }),
      payload: cuerpo,
    });
  const exportar = (acceso: string | null, cuentaId: string, recurso: string, consulta = '') =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/plataforma/cuentas/${cuentaId}/exportaciones/${recurso}${consulta}`,
      headers: acceso === null ? {} : conUsuario({ acceso }),
    });

  const qrDe = (escenario: Escenario, usuario: UsuarioDePrueba) =>
    crearQr(prueba.pool, escenario.cuenta, usuario.id, [escenario.puertaPrincipal.id]);

  async function anuladoDe(qrId: string): Promise<boolean> {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT anulado_at FROM qr_accesos WHERE id = ?',
      [qrId],
    );
    return filas[0]?.anulado_at !== null;
  }

  async function sinPermiso(codigos: string[]): Promise<string> {
    await prueba.pool.query(
      'DELETE rp FROM rol_permisos AS rp JOIN permisos AS p ON p.id = rp.permiso_id WHERE p.codigo IN (?)',
      [codigos],
    );
    const otro = await crearSuperAdmin(prueba.pool, 'sin.permiso');
    return (await iniciarSesionDePlataforma(prueba.app, 'sin.permiso', otro.contrasena)).acceso;
  }

  describe('POST /plataforma/cuentas/:cuenta_id/qr-accesos/anulacion-masiva', () => {
    it('anula todos los QR vigentes de la cuenta, no los de otra, y firma el super admin', async () => {
      const deAdmin = await qrDe(a, a.administrador);
      const deMiembro = await qrDe(a, arbol.miembro1);
      const deOtraCuenta = await qrDe(b, arbolB.miembro1);

      const respuesta = await anular(superAcceso, a.cuenta.id, {
        alcance: 'cuenta',
        motivo: MOTIVO,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      const cuerpo = respuesta.json<Resultado>();
      expect(cuerpo).toMatchObject({ alcance: 'cuenta', usuario_id: null, qr_anulados: 2 });
      expect(cuerpo.usuarios_alcanzados).toBeGreaterThanOrEqual(2);

      expect(await anuladoDe(deAdmin.id)).toBe(true);
      expect(await anuladoDe(deMiembro.id)).toBe(true);
      expect(await anuladoDe(deOtraCuenta.id)).toBe(false);

      // Autoría: el super admin firma el QR anulado, la constancia y la bitácora (origen `api`, su usuario).
      const [qr] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT anulado_por FROM qr_accesos WHERE id = ?',
        [deMiembro.id],
      );
      expect(qr[0]?.anulado_por).toBe(sa.id);
      const [constancia] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT tenant_id, created_by, motivo FROM anulaciones_masivas WHERE id = ?',
        [cuerpo.id],
      );
      expect(constancia[0]).toMatchObject({
        tenant_id: a.cuenta.id,
        created_by: sa.id,
        motivo: MOTIVO,
      });
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT tenant_id, usuario_id, origen FROM bitacoras WHERE tabla = 'qr_accesos' AND registro_id = ?",
        [deMiembro.id],
      );
      expect(bitacora[0]).toMatchObject({
        tenant_id: a.cuenta.id,
        usuario_id: sa.id,
        origen: 'api',
      });
    });

    it('con alcance usuario anula solo los de ese usuario; con rama, los de su rama', async () => {
      const uno = await qrDe(a, arbol.miembro1);
      const otro = await qrDe(a, arbol.miembro1b);
      const porUsuario = await anular(superAcceso, a.cuenta.id, {
        alcance: 'usuario',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      expect(porUsuario.json<Resultado>()).toMatchObject({
        qr_anulados: 1,
        usuarios_alcanzados: 1,
      });
      expect(await anuladoDe(uno.id)).toBe(true);
      expect(await anuladoDe(otro.id)).toBe(false);

      const porRama = await anular(superAcceso, a.cuenta.id, {
        alcance: 'rama',
        usuario_id: a.administrador.id,
        motivo: MOTIVO,
      });
      expect(porRama.statusCode, porRama.body).toBe(200);
      expect(await anuladoDe(otro.id)).toBe(true);
    });

    it('aislamiento: una cuenta inexistente es 404 y un usuario de B pedido en A también', async () => {
      const inexistente = await anular(superAcceso, '999999', {
        alcance: 'cuenta',
        motivo: MOTIVO,
      });
      expect(inexistente.statusCode).toBe(404);
      expect(inexistente.json<Problema>().code).toBe('cuenta.no_encontrada');

      const qrB = await qrDe(b, arbolB.miembro1);
      const cruzado = await anular(superAcceso, a.cuenta.id, {
        alcance: 'usuario',
        usuario_id: arbolB.miembro1.id,
        motivo: MOTIVO,
      });
      expect(cruzado.statusCode).toBe(404);
      expect(cruzado.json<Problema>().code).toBe('usuario.no_encontrado');
      expect(await anuladoDe(qrB.id)).toBe(false);
      expect(await contarFilas(prueba.pool, 'anulaciones_masivas')).toBe(0);
    });

    it('permisos: 401 sin sesión o con token de cuenta, 403 sin el permiso', async () => {
      const cuerpo = { alcance: 'cuenta', motivo: MOTIVO };
      expect((await anular(null, a.cuenta.id, cuerpo)).statusCode).toBe(401);
      expect((await anular(adminA, a.cuenta.id, cuerpo)).statusCode).toBe(401);

      const sin = await sinPermiso(['accesos.qr.anular_masivo_cuenta']);
      const denegado = await anular(sin, a.cuenta.id, cuerpo);
      expect(denegado.statusCode).toBe(403);
      expect(denegado.json<Problema>().code).toBe('permiso.denegado');
    });

    it('el cuerpo es estricto: usuario_id sobra con cuenta y falta con usuario o rama', async () => {
      const sobra = await anular(superAcceso, a.cuenta.id, {
        alcance: 'cuenta',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      expect(sobra.statusCode).toBe(400);
      const falta = await anular(superAcceso, a.cuenta.id, { alcance: 'usuario', motivo: MOTIVO });
      expect(falta.statusCode).toBe(400);
      const extra = await anular(superAcceso, a.cuenta.id, {
        alcance: 'cuenta',
        motivo: MOTIVO,
        otro: 1,
      });
      expect(extra.statusCode).toBe(400);
      const sinMotivo = await anular(superAcceso, a.cuenta.id, { alcance: 'cuenta', motivo: ' ' });
      expect(sinMotivo.statusCode).toBe(400);
    });

    it('va por lotes: con lote de 1 anula todos los vigentes y deja un solo total', async () => {
      await qrDe(a, arbol.miembro1);
      await qrDe(a, arbol.miembro1);
      await qrDe(a, arbol.miembro1b);
      const principal: PrincipalPlataforma = {
        tipo: 'plataforma',
        usuarioId: sa.id,
        sesionId: '1',
        permisos: new Set(),
      };
      const resultado = await ContextoCuenta.comoPlataformaEn(a.cuenta.id, sa.id, () =>
        anularMasivoDeCuenta(
          prueba.pool,
          principal,
          a.cuenta.id,
          { alcance: 'cuenta', usuarioId: null, motivo: MOTIVO },
          new Date(),
          1,
        ),
      );
      expect(resultado.qrAnulados).toBe(3);
      expect(await contarFilas(prueba.pool, 'anulaciones_masivas')).toBe(1);
    });
  });

  describe('GET /plataforma/cuentas/:cuenta_id/exportaciones/:recurso', () => {
    it('exporta TODA la cuenta (incluido el Administrador), nunca la de otra, y deja su constancia', async () => {
      const respuesta = await exportar(superAcceso, a.cuenta.id, 'usuarios');
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.headers['content-type']).toContain('text/csv');
      const ids = respuesta.body
        .split('\r\n')
        .slice(1)
        .map((linea) => linea.split(',')[0]);
      expect(ids).toContain(a.administrador.id);
      expect(ids).toContain(arbol.miembro1.id);
      expect(ids).not.toContain(arbolB.miembro1.id);
      expect(respuesta.body).not.toMatch(/pin|hash|contrasena/i);

      const [constancia] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT tenant_id, recurso, created_by FROM exportaciones',
      );
      expect(constancia).toHaveLength(1);
      expect(constancia[0]).toMatchObject({
        tenant_id: a.cuenta.id,
        recurso: 'usuarios',
        created_by: sa.id,
      });
    });

    it('puertas y lecturas son las de la cuenta del path', async () => {
      const puertas = await exportar(superAcceso, a.cuenta.id, 'puertas');
      expect(puertas.statusCode, puertas.body).toBe(200);
      const idsDePuertas = puertas.body
        .split('\r\n')
        .slice(1)
        .map((linea) => linea.split(',')[0]);
      expect(idsDePuertas).toContain(a.puertaPrincipal.id);
      expect(idsDePuertas).toContain(a.puertaTrasera.id);
      expect(idsDePuertas).not.toContain(b.puertaPrincipal.id);

      // Sin intentos todavía: solo el encabezado, y la cabecera lo dice.
      const lecturas = await exportar(superAcceso, a.cuenta.id, 'lecturas');
      expect(lecturas.statusCode, lecturas.body).toBe(200);
      expect(lecturas.headers['x-total-filas']).toBe('0');
    });

    it('aislamiento: cuenta inexistente es 404 y no deja constancia', async () => {
      const respuesta = await exportar(superAcceso, '999999', 'usuarios');
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('cuenta.no_encontrada');
      expect(await contarFilas(prueba.pool, 'exportaciones')).toBe(0);
    });

    it('respeta el tope de filas: una página más allá del tope es 422 y sin constancia', async () => {
      const respuesta = await exportar(
        superAcceso,
        a.cuenta.id,
        'usuarios',
        '?pagina=11&por_pagina=1000',
      );
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('exportacion.tope_excedido');
      expect(await contarFilas(prueba.pool, 'exportaciones')).toBe(0);
    });

    it('permisos: 401 sin sesión o con token de cuenta, 403 sin el permiso', async () => {
      expect((await exportar(null, a.cuenta.id, 'usuarios')).statusCode).toBe(401);
      expect((await exportar(adminA, a.cuenta.id, 'usuarios')).statusCode).toBe(401);
      const sin = await sinPermiso(['accesos.evento.exportar_cuenta']);
      const denegado = await exportar(sin, a.cuenta.id, 'usuarios');
      expect(denegado.statusCode).toBe(403);
      expect(denegado.json<Problema>().code).toBe('permiso.denegado');
    });

    it('un recurso desconocido es 400', async () => {
      expect((await exportar(superAcceso, a.cuenta.id, 'sesiones')).statusCode).toBe(400);
    });
  });

  it('los permisos nuevos son de ámbito plataforma y ningún rol de cuenta los tiene (invariante 10)', async () => {
    const codigos = [
      'accesos.qr.anular_masivo_cuenta',
      'seguridad.incidente.resolver_cuenta',
      'accesos.evento.exportar_cuenta',
    ];
    const [catalogo] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT codigo, ambito FROM permisos WHERE codigo IN (?)',
      [codigos],
    );
    expect(catalogo).toHaveLength(3);
    expect(catalogo.every((fila) => fila.ambito === 'plataforma')).toBe(true);

    const [deCuenta] = await prueba.pool.query<RowDataPacket[]>(
      `SELECT r.nombre FROM rol_permisos rp
         JOIN permisos p ON p.id = rp.permiso_id JOIN roles r ON r.id = rp.rol_id
        WHERE p.codigo IN (?) AND r.tenant_id IS NOT NULL`,
      [codigos],
    );
    expect(deCuenta).toEqual([]);
    const [delSuperAdmin] = await prueba.pool.query<RowDataPacket[]>(
      `SELECT p.codigo FROM rol_permisos rp
         JOIN permisos p ON p.id = rp.permiso_id JOIN roles r ON r.id = rp.rol_id
        WHERE p.codigo IN (?) AND r.tenant_id IS NULL AND r.nombre = 'Super admin'`,
      [codigos],
    );
    expect(delSuperAdmin).toHaveLength(3);
  });
});
