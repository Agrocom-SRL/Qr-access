import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearQr,
  crearUsuarioConPin,
  type Escenario,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion } from '../helpers/http.js';
import { crearOrdenDePrueba } from '../helpers/ordenes.js';

interface LecturaListada {
  id: string;
  metodo: string;
  resultado: string;
  motivo_code: string;
  qr_id: string | null;
  qr: unknown;
  ejecucion: string | null;
  puerta: { id: string };
  [campo: string]: unknown;
}
interface Listado {
  datos: LecturaListada[];
  meta: { total: number };
}

/**
 * El historial de quien abre desde la app (ADR 0035 §6): un usuario ve sus propias aperturas manuales junto a las
 * de sus QR, nunca las de otro; el administrador ve todas. `metodo = 'manual'` y sin sentido.
 */
describe('GET /api/v1/lecturas: aperturas manuales en el historial (ADR 0035 §6)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let otro: UsuarioDePrueba;
  let sesionUsuario: string;
  let sesionOtro: string;
  let sesionAdmin: string;
  let sesionDeB: string;
  let sesionAdminDeB: string;

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
    otro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'US02', [a.rolMiembroId], {
      superiorId: a.administrador.id,
    });
    sesionUsuario = (await iniciarSesion(prueba.app, a.usuario.pin)).acceso;
    sesionOtro = (await iniciarSesion(prueba.app, otro.pin)).acceso;
    sesionAdmin = (await iniciarSesion(prueba.app, a.administrador.pin)).acceso;
    sesionDeB = (await iniciarSesion(prueba.app, b.usuario.pin)).acceso;
    sesionAdminDeB = (await iniciarSesion(prueba.app, b.administrador.pin)).acceso;
  });

  const get = (url: string, acceso: string) =>
    prueba.app.inject({ method: 'GET', url: `/api/v1${url}`, headers: conUsuario({ acceso }) });
  const lecturas = async (acceso: string, url = '/lecturas'): Promise<Listado> =>
    (await get(url, acceso)).json<Listado>();

  /** Una apertura manual de ese usuario, con su orden (la lectura que la originó). */
  const manual = (escenario: Escenario, usuarioId: string, puertaId: string) =>
    crearOrdenDePrueba(prueba.pool, escenario, puertaId, {
      estado: 'vencida',
      usuarioId,
      dispositivoId: escenario.dispositivoPrincipal.id,
    });

  it('un usuario ve sus propias aperturas manuales, con metodo manual, sin QR y sin sentido', async () => {
    const propia = await manual(a, a.usuario.id, a.puertaPrincipal.id);

    const { datos, meta } = await lecturas(sesionUsuario);

    expect(meta.total).toBe(1);
    expect(datos[0]).toMatchObject({
      id: propia.lecturaId,
      metodo: 'manual',
      resultado: 'permitido',
      motivo_code: 'manual.ordenada',
      qr_id: null,
      qr: null,
      puerta: { id: a.puertaPrincipal.id },
    });
    // La app no sabe de sentidos: la lectura no lo expone en ninguna forma.
    expect(Object.keys(datos[0] ?? {}).join(',')).not.toMatch(/sentido|entrada|salida/);
  });

  it('un usuario NO ve las aperturas manuales de otro usuario de su cuenta', async () => {
    await manual(a, otro.id, a.puertaTrasera.id);
    const propia = await manual(a, a.usuario.id, a.puertaPrincipal.id);

    const { datos } = await lecturas(sesionUsuario);
    expect(datos.map((l) => l.id)).toEqual([propia.lecturaId]);

    const deOtro = await lecturas(sesionOtro);
    expect(deOtro.datos).toHaveLength(1);
    expect(deOtro.datos[0]?.puerta.id).toBe(a.puertaTrasera.id);
  });

  it('el administrador de la cuenta las ve todas', async () => {
    const unaDeUsuario = await manual(a, a.usuario.id, a.puertaPrincipal.id);
    const unaDeOtro = await manual(a, otro.id, a.puertaTrasera.id);

    const { datos, meta } = await lecturas(sesionAdmin);

    expect(meta.total).toBe(2);
    expect(datos.map((l) => l.id).sort()).toEqual(
      [unaDeUsuario.lecturaId, unaDeOtro.lecturaId].sort(),
    );
    expect(datos.every((l) => l.metodo === 'manual')).toBe(true);
  });

  it('otra cuenta no ve las aperturas manuales de A (ni su usuario ni su administrador)', async () => {
    await manual(a, a.usuario.id, a.puertaPrincipal.id);
    await manual(a, otro.id, a.puertaTrasera.id);

    expect((await lecturas(sesionDeB)).meta.total).toBe(0);
    expect((await lecturas(sesionAdminDeB)).meta.total).toBe(0);
  });

  it('las lecturas de sus QR siguen viéndose junto a las manuales, y las de los QR de otro no', async () => {
    const propia = await manual(a, a.usuario.id, a.puertaPrincipal.id);
    const miQr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const qrDeOtro = await crearQr(prueba.pool, a.cuenta, otro.id, [a.puertaPrincipal.id]);
    for (const qr of [miQr, qrDeOtro]) {
      await prueba.pool.query(
        "INSERT INTO lecturas (tenant_id, puerta_id, dispositivo_id, qr_acceso_id, metodo, resultado, motivo_code, ocurrido_at) VALUES (?, ?, ?, ?, 'qr', 'permitido', 'acceso.permitido', NOW(3))",
        [a.cuenta.id, a.puertaPrincipal.id, a.dispositivoPrincipal.id, qr.id],
      );
    }

    const { datos } = await lecturas(sesionUsuario);

    expect(datos).toHaveLength(2);
    expect(datos.map((l) => l.metodo).sort()).toEqual(['manual', 'qr']);
    expect(datos.find((l) => l.metodo === 'qr')?.qr_id).toBe(miQr.id);
    expect(datos.find((l) => l.metodo === 'manual')?.id).toBe(propia.lecturaId);
  });

  it('los rechazos de la propia petición (sin orden) también aparecen, con su motivo', async () => {
    await prueba.pool.query(
      "INSERT INTO lecturas (tenant_id, puerta_id, usuario_id, metodo, resultado, motivo_code, ocurrido_at) VALUES (?, ?, ?, 'manual', 'rechazado', 'manual.no_habilitada', NOW(3))",
      [a.cuenta.id, a.puertaPrincipal.id, a.usuario.id],
    );
    const { datos } = await lecturas(sesionUsuario);
    expect(datos).toHaveLength(1);
    expect(datos[0]).toMatchObject({
      metodo: 'manual',
      resultado: 'rechazado',
      motivo_code: 'manual.no_habilitada',
      ejecucion: null,
    });
  });

  it('el detalle de una apertura manual propia es 200; la de otro usuario o de otra cuenta, 404', async () => {
    const propia = await manual(a, a.usuario.id, a.puertaPrincipal.id);
    const ajena = await manual(a, otro.id, a.puertaTrasera.id);

    expect((await get(`/lecturas/${propia.lecturaId}`, sesionUsuario)).statusCode).toBe(200);
    expect((await get(`/lecturas/${ajena.lecturaId}`, sesionUsuario)).statusCode).toBe(404);
    expect((await get(`/lecturas/${propia.lecturaId}`, sesionDeB)).statusCode).toBe(404);
    expect((await get(`/lecturas/${propia.lecturaId}`, sesionAdminDeB)).statusCode).toBe(404);
    expect((await get(`/lecturas/${propia.lecturaId}`, sesionAdmin)).statusCode).toBe(200);
  });

  it('la ejecución de la orden (lo que informó la placa) se ve en el historial', async () => {
    const propia = await manual(a, a.usuario.id, a.puertaPrincipal.id);
    await prueba.pool.query(
      "INSERT INTO confirmaciones_apertura (tenant_id, evento_acceso_id, dispositivo_id, puerta_id, origen, resultado, causa, registrada_at) VALUES (?, ?, ?, ?, 'placa', 'ejecutada', 'puerta_abrio', NOW(3))",
      [a.cuenta.id, propia.lecturaId, a.dispositivoPrincipal.id, a.puertaPrincipal.id],
    );
    expect((await lecturas(sesionUsuario)).datos[0]?.ejecucion).toBe('ejecutada');
  });

  it('el resumen del tablero cuenta solo lo que el usuario ve', async () => {
    await manual(a, a.usuario.id, a.puertaPrincipal.id);
    await manual(a, otro.id, a.puertaTrasera.id);
    const resumen = async (acceso: string) =>
      (await get('/lecturas/resumen', acceso)).json<{ permitidos: number }>().permitidos;
    expect(await resumen(sesionUsuario)).toBe(1);
    expect(await resumen(sesionAdmin)).toBe(2);
  });
});
