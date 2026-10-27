import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as anularMasivo } from '../../src/modules/accesos/actions/anular-masivo.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import type { PrincipalUsuario } from '../../src/platform/seguridad/principal.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, armarSegundaRama, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
  crearRol,
  crearUsuarioConPin,
  type Escenario,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';

interface Resultado {
  id: string;
  alcance: string;
  usuario_id: string | null;
  usuarios_alcanzados: number;
  qr_anulados: number;
}

const MOTIVO = 'se filtró el PIN';
const HORA = 3_600_000;

describe('POST /qr-accesos/anulacion-masiva (ADR 0031 §3, ADR 0033 §3)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let admin: Sesion;

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
    admin = await iniciarSesion(prueba.app, a.administrador.pin);
  });

  const anular = (sesion: Sesion, cuerpo: object) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos/anulacion-masiva',
      headers: conUsuario(sesion),
      payload: cuerpo,
    });

  const qrDe = (usuario: UsuarioDePrueba, opciones = {}) =>
    crearQr(prueba.pool, a.cuenta, usuario.id, [a.puertaPrincipal.id], opciones);

  async function anuladoDe(qrId: string): Promise<boolean> {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT anulado_at FROM qr_accesos WHERE id = ?',
      [qrId],
    );
    return filas[0]?.anulado_at !== null;
  }

  describe('el Administrador', () => {
    it('anula solo los QR VIGENTES de un usuario y deja el resto como estaba', async () => {
      const vigente1 = await qrDe(arbol.miembro1);
      const vigente2 = await qrDe(arbol.miembro1);
      const usado = await qrDe(arbol.miembro1, { usadoAt: new Date(Date.now() - HORA) });
      const vencido = await qrDe(arbol.miembro1, { venceAt: new Date(Date.now() - HORA) });
      const deOtro = await qrDe(arbol.miembro1b);

      const respuesta = await anular(admin, {
        alcance: 'usuario',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json<Resultado>()).toMatchObject({
        alcance: 'usuario',
        usuario_id: arbol.miembro1.id,
        usuarios_alcanzados: 1,
        qr_anulados: 2,
      });

      expect(await anuladoDe(vigente1.id)).toBe(true);
      expect(await anuladoDe(vigente2.id)).toBe(true);
      expect(await anuladoDe(usado.id)).toBe(false);
      expect(await anuladoDe(vencido.id)).toBe(false);
      expect(await anuladoDe(deOtro.id)).toBe(false);
    });

    it('anula una rama entera: la raíz y todo lo que cuelga de ella, y nada más', async () => {
      const delTitular = await qrDe(arbol.titular1);
      const delMiembro = await qrDe(arbol.miembro1);
      const delOtroMiembro = await qrDe(arbol.miembro1b);
      const deOtraRama = await qrDe(arbol.miembro2);
      const delAdmin = await qrDe(a.administrador);

      const respuesta = await anular(admin, {
        alcance: 'rama',
        usuario_id: arbol.titular1.id,
        motivo: MOTIVO,
      });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json<Resultado>()).toMatchObject({
        usuarios_alcanzados: 3,
        qr_anulados: 3,
      });
      for (const qr of [delTitular, delMiembro, delOtroMiembro]) {
        expect(await anuladoDe(qr.id)).toBe(true);
      }
      expect(await anuladoDe(deOtraRama.id)).toBe(false);
      expect(await anuladoDe(delAdmin.id)).toBe(false);
    });

    it('sin usuario_id, la rama es la suya: él y todo lo que cuelga de él', async () => {
      const propio = await qrDe(a.administrador);
      const delMiembro = await qrDe(arbol.miembro2);
      const respuesta = await anular(admin, { alcance: 'rama', motivo: MOTIVO });
      expect(respuesta.statusCode).toBe(200);
      expect(await anuladoDe(propio.id)).toBe(true);
      expect(await anuladoDe(delMiembro.id)).toBe(true);
    });

    it('el alcance cuenta es SU rama completa: anula la suya y no toca la de otro Administrador', async () => {
      const qrs = [
        await qrDe(a.administrador),
        await qrDe(arbol.titular2),
        await qrDe(arbol.miembro1),
        await qrDe(arbol.guardia),
      ];
      const segunda = await armarSegundaRama(prueba.pool, a, arbol);
      const deLaOtraRama = [await qrDe(segunda.administrador2), await qrDe(segunda.miembro3)];
      const respuesta = await anular(admin, { alcance: 'cuenta', motivo: MOTIVO });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json<Resultado>()).toMatchObject({
        alcance: 'cuenta',
        usuario_id: null,
        qr_anulados: 4,
      });
      for (const qr of qrs) expect(await anuladoDe(qr.id)).toBe(true);
      for (const qr of deLaOtraRama) expect(await anuladoDe(qr.id)).toBe(false);
    });

    it('deja el motivo y el alcance en la bitácora, y la anulación de cada QR también', async () => {
      const qr = await qrDe(arbol.miembro1);
      const respuesta = await anular(admin, {
        alcance: 'usuario',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      const { id } = respuesta.json<Resultado>();

      const [lote] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT alcance, usuario_objetivo_id, motivo, usuarios_alcanzados, qr_anulados, created_by FROM anulaciones_masivas WHERE id = ?',
        [id],
      );
      expect(lote[0]).toMatchObject({
        alcance: 'usuario',
        usuario_objetivo_id: arbol.miembro1.id,
        motivo: MOTIVO,
        qr_anulados: 1,
        created_by: a.administrador.id,
      });

      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT tabla, registro_id, accion, usuario_id, origen, despues FROM bitacoras WHERE tabla IN ('anulaciones_masivas', 'qr_accesos') ORDER BY id",
      );
      const delLote = bitacora.find((fila) => fila.tabla === 'anulaciones_masivas');
      expect(delLote).toMatchObject({
        registro_id: id,
        accion: 'creado',
        usuario_id: a.administrador.id,
        origen: 'api',
      });
      expect(JSON.stringify(delLote?.despues)).toContain(MOTIVO);
      const delQr = bitacora.find((fila) => fila.tabla === 'qr_accesos');
      expect(delQr).toMatchObject({ registro_id: qr.id, accion: 'actualizado' });
    });

    it('un QR anulado no revive: la puerta lo rechaza y repetir el pedido anula 0', async () => {
      const qr = await qrDe(arbol.miembro1);
      await anular(admin, { alcance: 'usuario', usuario_id: arbol.miembro1.id, motivo: MOTIVO });

      const validacion = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token: qr.texto },
      });
      expect(validacion.json<{ abrir: boolean; motivo_code: string }>()).toMatchObject({
        abrir: false,
        motivo_code: 'qr.anulado',
      });

      const otraVez = await anular(admin, {
        alcance: 'usuario',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      expect(otraVez.json<Resultado>().qr_anulados).toBe(0);
      expect(await anuladoDe(qr.id)).toBe(true);
    });

    it('un usuario eliminado ya no existe para el pedido (404)', async () => {
      await prueba.pool.query('UPDATE usuarios SET deleted_at = NOW(3) WHERE id = ?', [
        arbol.miembro1.id,
      ]);
      const respuesta = await anular(admin, {
        alcance: 'usuario',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
    });
  });

  describe('cada Administrador llega solo a su rama (ADR 0028 §4, D-29)', () => {
    it('un Administrador no anula a un usuario, una rama ni un QR de la rama de otro Administrador (404) y nada cambia', async () => {
      const segunda = await armarSegundaRama(prueba.pool, a, arbol);
      const delTitular3 = await qrDe(segunda.titular3);
      const delMiembro3 = await qrDe(segunda.miembro3);
      const delAdmin2 = await qrDe(segunda.administrador2);
      const antes = await contarFilas(prueba.pool, 'anulaciones_masivas');

      for (const cuerpo of [
        { alcance: 'usuario', usuario_id: segunda.miembro3.id, motivo: MOTIVO },
        { alcance: 'usuario', usuario_id: segunda.administrador2.id, motivo: MOTIVO },
        { alcance: 'rama', usuario_id: segunda.titular3.id, motivo: MOTIVO },
        { alcance: 'rama', usuario_id: segunda.administrador2.id, motivo: MOTIVO },
      ]) {
        const respuesta = await anular(admin, cuerpo);
        expect(respuesta.statusCode, respuesta.body).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
      }
      for (const qr of [delTitular3, delMiembro3, delAdmin2]) {
        expect(await anuladoDe(qr.id)).toBe(false);
      }
      expect(await contarFilas(prueba.pool, 'anulaciones_masivas')).toBe(antes);
    });

    it('el segundo Administrador anula su rama y no llega a la del primero (simétrico)', async () => {
      const segunda = await armarSegundaRama(prueba.pool, a, arbol);
      const admin2 = await iniciarSesion(prueba.app, segunda.administrador2.pin);
      const suyo = await qrDe(segunda.miembro3);
      const delPrimero = await qrDe(arbol.miembro1);

      expect(
        (await anular(admin2, { alcance: 'cuenta', motivo: MOTIVO })).json<Resultado>(),
      ).toMatchObject({
        qr_anulados: 1,
        usuarios_alcanzados: 4,
      });
      expect(await anuladoDe(suyo.id)).toBe(true);
      expect(await anuladoDe(delPrimero.id)).toBe(false);
      const respuesta = await anular(admin2, {
        alcance: 'usuario',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      expect(respuesta.statusCode).toBe(404);
    });
  });

  describe('por lotes (MEDIA-5): no retiene los bloqueos de una sola transacción larga', () => {
    const comoAdmin = (): PrincipalUsuario => ({
      tipo: 'usuario',
      usuarioId: a.administrador.id,
      cuentaId: a.cuenta.id,
      sesionId: '0',
      rolActivoId: a.rolAdministradorId,
      permisos: new Set(['accesos.qr.anular_masivo']),
      estado: 'activo',
      origenDelEstado: null,
    });

    it('con más QR que el lote anula todos, en varias transacciones, y reporta el total', async () => {
      const qrs = [];
      for (let i = 0; i < 7; i++)
        qrs.push(await qrDe(i % 2 === 0 ? arbol.miembro1 : arbol.miembro2));
      const vencido = await qrDe(arbol.miembro1, { venceAt: new Date(Date.now() - HORA) });
      await qrDe(arbol.miembro1, { anuladoAt: new Date() });
      const ajeno = await crearQr(prueba.pool, b.cuenta, b.administrador.id, [
        b.puertaPrincipal.id,
      ]);

      const principal = comoAdmin();
      const resultado = await ContextoCuenta.ejecutar(
        {
          cuentaId: a.cuenta.id,
          usuarioId: principal.usuarioId,
          rolActivoId: null,
          dispositivoId: null,
          origen: 'api',
        },
        // Lote de 3: 7 vigentes = 3 lotes (3 + 3 + 1).
        () =>
          anularMasivo(
            prueba.pool,
            principal,
            { alcance: 'cuenta', usuarioId: null, motivo: MOTIVO },
            new Date(),
            3,
          ),
      );
      expect(resultado.qrAnulados).toBe(7);
      for (const qr of qrs) expect(await anuladoDe(qr.id)).toBe(true);
      expect(await anuladoDe(vencido.id)).toBe(false);
      expect(await anuladoDe(ajeno.id)).toBe(false);
      // Un solo pedido registrado, con el total; y cada QR dejó su rastro en la bitácora.
      expect(await contarFilas(prueba.pool, 'anulaciones_masivas')).toBe(1);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM bitacoras WHERE tabla = 'qr_accesos' AND JSON_EXTRACT(despues, '$.anulado_at') IS NOT NULL",
      );
      expect(Number(filas[0]?.n)).toBeGreaterThanOrEqual(7);
    });

    it('un lote exacto no deja nada atrás y repetirlo anula 0', async () => {
      for (let i = 0; i < 6; i++) await qrDe(arbol.miembro1);
      const principal = comoAdmin();
      const correr = () =>
        ContextoCuenta.ejecutar(
          {
            cuentaId: a.cuenta.id,
            usuarioId: principal.usuarioId,
            rolActivoId: null,
            dispositivoId: null,
            origen: 'api',
          },
          () =>
            anularMasivo(
              prueba.pool,
              principal,
              { alcance: 'rama', usuarioId: null, motivo: MOTIVO },
              new Date(),
              3,
            ),
        );
      expect((await correr()).qrAnulados).toBe(6);
      expect((await correr()).qrAnulados).toBe(0);
    });
  });

  describe('el Titular', () => {
    let titular: Sesion;
    beforeEach(async () => {
      titular = await iniciarSesion(prueba.app, arbol.titular1.pin);
    });

    it('anula los suyos y los de sus Miembros (sin usuario_id, su rama)', async () => {
      const propio = await qrDe(arbol.titular1);
      const delMiembro = await qrDe(arbol.miembro1);
      const deOtraRama = await qrDe(arbol.miembro2);
      const respuesta = await anular(titular, { alcance: 'rama', motivo: MOTIVO });
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(await anuladoDe(propio.id)).toBe(true);
      expect(await anuladoDe(delMiembro.id)).toBe(true);
      expect(await anuladoDe(deOtraRama.id)).toBe(false);
    });

    it('anula a un solo Miembro suyo', async () => {
      const delMiembro = await qrDe(arbol.miembro1);
      const delOtro = await qrDe(arbol.miembro1b);
      const respuesta = await anular(titular, {
        alcance: 'usuario',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      expect(respuesta.statusCode).toBe(200);
      expect(await anuladoDe(delMiembro.id)).toBe(true);
      expect(await anuladoDe(delOtro.id)).toBe(false);
    });

    it('escalada de privilegios: no llega a otro Titular, a su rama, a su superior ni al Guardia (404, nada se anula)', async () => {
      const ajenos = [
        await qrDe(arbol.titular2),
        await qrDe(arbol.miembro2),
        await qrDe(a.administrador),
        await qrDe(arbol.guardia),
      ];
      for (const usuario of [arbol.titular2, arbol.miembro2, a.administrador, arbol.guardia]) {
        for (const alcance of ['usuario', 'rama']) {
          const respuesta = await anular(titular, {
            alcance,
            usuario_id: usuario.id,
            motivo: MOTIVO,
          });
          expect(respuesta.statusCode, `${alcance} ${usuario.id}`).toBe(404);
          expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
        }
      }
      for (const qr of ajenos) expect(await anuladoDe(qr.id)).toBe(false);
    });

    it('no puede anular toda la cuenta (403 anulacion.alcance_no_permitido)', async () => {
      const ajeno = await qrDe(arbol.titular2);
      const respuesta = await anular(titular, { alcance: 'cuenta', motivo: MOTIVO });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('anulacion.alcance_no_permitido');
      expect(await anuladoDe(ajeno.id)).toBe(false);
    });
  });

  describe('el Miembro y el Guardia', () => {
    it('el Miembro anula los suyos y no llega ni a su par ni a su Titular', async () => {
      const miembro = await iniciarSesion(prueba.app, arbol.miembro1.pin);
      const propio = await qrDe(arbol.miembro1);
      const delPar = await qrDe(arbol.miembro1b);
      const delTitular = await qrDe(arbol.titular1);

      const ajeno = await anular(miembro, {
        alcance: 'usuario',
        usuario_id: arbol.miembro1b.id,
        motivo: MOTIVO,
      });
      expect(ajeno.statusCode).toBe(404);
      const superior = await anular(miembro, {
        alcance: 'rama',
        usuario_id: arbol.titular1.id,
        motivo: MOTIVO,
      });
      expect(superior.statusCode).toBe(404);

      const suyo = await anular(miembro, { alcance: 'usuario', motivo: MOTIVO });
      expect(suyo.statusCode, suyo.body).toBe(200);
      expect(suyo.json<Resultado>()).toMatchObject({ qr_anulados: 1, usuarios_alcanzados: 1 });
      expect(await anuladoDe(propio.id)).toBe(true);
      expect(await anuladoDe(delPar.id)).toBe(false);
      expect(await anuladoDe(delTitular.id)).toBe(false);

      const cuenta = await anular(miembro, { alcance: 'cuenta', motivo: MOTIVO });
      expect(cuenta.statusCode).toBe(403);
    });

    it('el Guardia anula lo suyo y nada más', async () => {
      const guardia = await iniciarSesion(prueba.app, arbol.guardia.pin);
      const propio = await qrDe(arbol.guardia);
      const deAdmin = await qrDe(a.administrador);
      const ajeno = await anular(guardia, {
        alcance: 'usuario',
        usuario_id: a.administrador.id,
        motivo: MOTIVO,
      });
      expect(ajeno.statusCode).toBe(404);
      const suyo = await anular(guardia, { alcance: 'rama', motivo: MOTIVO });
      expect(suyo.statusCode).toBe(200);
      expect(await anuladoDe(propio.id)).toBe(true);
      expect(await anuladoDe(deAdmin.id)).toBe(false);
    });

    it('un rol sin el permiso accesos.qr.anular_masivo recibe 403', async () => {
      const rolSinPermiso = await crearRol(prueba.pool, a.cuenta, 'Visitante', ['accesos.qr.ver']);
      const visitante = await crearUsuarioConPin(prueba.pool, a.cuenta, 'VI01', [rolSinPermiso], {
        superiorId: a.administrador.id,
      });
      const sesion = await iniciarSesion(prueba.app, visitante.pin);
      const respuesta = await anular(sesion, { alcance: 'usuario', motivo: MOTIVO });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
    });
  });

  describe('aislamiento entre cuentas (invariante 1)', () => {
    it('el Administrador de A pidiendo un usuario o una rama de B recibe 404 y nada de B cambia', async () => {
      const qrDeB = await crearQr(prueba.pool, b.cuenta, b.usuario.id, [b.puertaPrincipal.id]);
      for (const alcance of ['usuario', 'rama']) {
        const respuesta = await anular(admin, {
          alcance,
          usuario_id: b.usuario.id,
          motivo: MOTIVO,
        });
        expect(respuesta.statusCode, alcance).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
      }
      expect(await anuladoDe(qrDeB.id)).toBe(false);
      expect(await contarFilas(prueba.pool, 'anulaciones_masivas')).toBe(0);
    });

    it('anular toda la cuenta A no toca ningún QR de la cuenta B', async () => {
      const qrDeA = await qrDe(arbol.miembro1);
      const qrDeB = await crearQr(prueba.pool, b.cuenta, b.usuario.id, [b.puertaPrincipal.id]);
      const respuesta = await anular(admin, { alcance: 'cuenta', motivo: MOTIVO });
      expect(respuesta.statusCode).toBe(200);
      expect(await anuladoDe(qrDeA.id)).toBe(true);
      expect(await anuladoDe(qrDeB.id)).toBe(false);
      expect(
        await contarFilas(prueba.pool, 'anulaciones_masivas', 'tenant_id = ?', [b.cuenta.id]),
      ).toBe(0);
    });
  });

  describe('validación del pedido', () => {
    it('el motivo es obligatorio (400)', async () => {
      for (const motivo of [undefined, '', '   ']) {
        const respuesta = await anular(admin, {
          alcance: 'cuenta',
          ...(motivo === undefined ? {} : { motivo }),
        });
        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.json<Problema>().code).toBe('validacion.invalida');
      }
      expect(await contarFilas(prueba.pool, 'anulaciones_masivas')).toBe(0);
    });

    it('el alcance cuenta no lleva usuario_id, y no se aceptan campos de más', async () => {
      const conUsuario_ = await anular(admin, {
        alcance: 'cuenta',
        usuario_id: arbol.miembro1.id,
        motivo: MOTIVO,
      });
      expect(conUsuario_.statusCode).toBe(400);
      const extra = await anular(admin, { alcance: 'cuenta', motivo: MOTIVO, generado_por: '1' });
      expect(extra.statusCode).toBe(400);
      const alcanceRaro = await anular(admin, { alcance: 'todo', motivo: MOTIVO });
      expect(alcanceRaro.statusCode).toBe(400);
    });

    it('un motivo con SQL o HTML se guarda tal cual, inerte', async () => {
      const raro = "x'; DROP TABLE qr_accesos; -- <script>1</script>";
      const respuesta = await anular(admin, { alcance: 'cuenta', motivo: raro });
      expect(respuesta.statusCode).toBe(200);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT motivo FROM anulaciones_masivas',
      );
      expect(filas[0]?.motivo).toBe(raro);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBeGreaterThanOrEqual(0);
    });
  });

  it('un usuario restringido también puede cortar sus QR', async () => {
    await prueba.pool.query(
      "UPDATE usuarios SET estado = 'restringido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
      [arbol.miembro1.id],
    );
    const miembro = await iniciarSesion(prueba.app, arbol.miembro1.pin);
    const qr = await qrDe(arbol.miembro1);
    const respuesta = await anular(miembro, { alcance: 'usuario', motivo: MOTIVO });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    expect(await anuladoDe(qr.id)).toBe(true);
  });

  it('sin sesión es 401', async () => {
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos/anulacion-masiva',
      payload: { alcance: 'cuenta', motivo: MOTIVO },
    });
    expect(respuesta.statusCode).toBe(401);
  });
});
