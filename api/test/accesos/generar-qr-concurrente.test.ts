import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import type { PrincipalUsuario } from '../../src/platform/seguridad/principal.js';
import { ejecutar as generarQr } from '../../src/modules/accesos/actions/generar-qr.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearUsuarioConPin,
  PERMISOS_DE_USUARIO,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema } from '../helpers/http.js';

const SUSPENDER_USUARIO =
  "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?";
const SUSPENDER_CUENTA =
  "UPDATE cuentas SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?";

describe('generar-qr frente a una suspensión concurrente y a generaciones simultáneas (ADR 0031 §1)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
  });

  /** El principal que dejó la autenticación ANTES de la suspensión: todavía dice «activo». */
  const principalViejo = (usuarioId: string): PrincipalUsuario => ({
    tipo: 'usuario',
    usuarioId,
    cuentaId: a.cuenta.id,
    sesionId: '0',
    rolActivoId: a.rolMiembroId,
    permisos: new Set(PERMISOS_DE_USUARIO),
    estado: 'activo',
    origenDelEstado: null,
  });
  const generarComo = (usuarioId: string) =>
    ContextoCuenta.ejecutar(
      {
        cuentaId: a.cuenta.id,
        usuarioId,
        rolActivoId: null,
        dispositivoId: null,
        origen: 'api',
      },
      () =>
        generarQr(prueba.pool, principalViejo(usuarioId), {
          puertaIds: [a.puertaPrincipal.id],
          venceAt: null,
          etiqueta: null,
        }),
    );

  describe('el estado se relee dentro de la transacción', () => {
    it('un usuario suspendido después de autenticarse no deja un QR vivo', async () => {
      await prueba.pool.query(SUSPENDER_USUARIO, [a.usuario.id]);
      await expect(generarComo(a.usuario.id)).rejects.toMatchObject({
        code: 'qr.generador_suspendido',
        status: 403,
      });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });

    it('si se suspendió un superior suyo, tampoco', async () => {
      const titular = await crearUsuarioConPin(prueba.pool, a.cuenta, 'TI01', [a.rolTitularId], {
        superiorId: a.administrador.id,
      });
      const miembro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'MI01', [a.rolMiembroId], {
        superiorId: titular.id,
      });
      await prueba.pool.query(SUSPENDER_USUARIO, [titular.id]);
      await expect(generarComo(miembro.id)).rejects.toMatchObject({
        code: 'qr.generador_suspendido',
      });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });

    it('si se suspendió la cuenta: qr.cuenta_suspendida', async () => {
      await prueba.pool.query(SUSPENDER_CUENTA, [a.cuenta.id]);
      await expect(generarComo(a.usuario.id)).rejects.toMatchObject({
        code: 'qr.cuenta_suspendida',
      });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });

    it('si lo restringieron: qr.generacion_restringida con el origen', async () => {
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'restringido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
        [a.usuario.id],
      );
      await expect(generarComo(a.usuario.id)).rejects.toMatchObject({
        code: 'qr.generacion_restringida',
        extra: { origen: 'usuario' },
      });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });

    it('un usuario dado de baja después de autenticarse no genera', async () => {
      await prueba.pool.query('UPDATE usuarios SET deleted_at = NOW(3) WHERE id = ?', [
        a.usuario.id,
      ]);
      await expect(generarComo(a.usuario.id)).rejects.toMatchObject({ status: 403 });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });
  });

  describe('la generación espera a una suspensión en curso', () => {
    async function conSuspensionPendiente(
      tabla: 'usuarios' | 'cuentas',
      id: string,
    ): Promise<{ confirmar: () => Promise<void> }> {
      const conexion = await prueba.pool.getConnection();
      await conexion.beginTransaction();
      await conexion.query(tabla === 'usuarios' ? SUSPENDER_USUARIO : SUSPENDER_CUENTA, [id]);
      return {
        confirmar: async () => {
          await conexion.commit();
          conexion.release();
        },
      };
    }
    const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

    it('la suspensión del usuario sin confirmar bloquea al insert; al confirmarse, no queda QR', async () => {
      const suspension = await conSuspensionPendiente('usuarios', a.usuario.id);
      let termino = false;
      const generacion = generarComo(a.usuario.id).finally(() => {
        termino = true;
      });
      // Aun sin confirmar, la generación no puede seguir: tiene que esperar a la suspensión
      generacion.catch(() => undefined);
      await pausa(400);
      expect(termino).toBe(false);
      await suspension.confirmar();
      await expect(generacion).rejects.toMatchObject({ code: 'qr.generador_suspendido' });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });

    it('lo mismo con la suspensión de un superior', async () => {
      const suspension = await conSuspensionPendiente('usuarios', a.administrador.id);
      let termino = false;
      const generacion = generarComo(a.usuario.id).finally(() => {
        termino = true;
      });
      generacion.catch(() => undefined);
      await pausa(400);
      expect(termino).toBe(false);
      await suspension.confirmar();
      await expect(generacion).rejects.toMatchObject({ code: 'qr.generador_suspendido' });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });

    it('lo mismo con la suspensión de la cuenta', async () => {
      const suspension = await conSuspensionPendiente('cuentas', a.cuenta.id);
      let termino = false;
      const generacion = generarComo(a.usuario.id).finally(() => {
        termino = true;
      });
      generacion.catch(() => undefined);
      await pausa(400);
      expect(termino).toBe(false);
      await suspension.confirmar();
      await expect(generacion).rejects.toMatchObject({ code: 'qr.cuenta_suspendida' });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });
  });

  describe('generaciones simultáneas del mismo usuario', () => {
    it('respetan el tope diario: con tope 2 y seis pedidos a la vez, se generan exactamente 2', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 2 WHERE clave = 'qr.tope_diario'",
      );
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const respuestas = await Promise.all(
        Array.from({ length: 6 }, () =>
          prueba.app.inject({
            method: 'POST',
            url: '/api/v1/qr-accesos',
            headers: conUsuario(sesion),
            payload: { puerta_ids: [a.puertaPrincipal.id] },
          }),
        ),
      );
      const estados = respuestas.map((respuesta) => respuesta.statusCode).sort();
      expect(estados).toEqual([201, 201, 429, 429, 429, 429]);
      expect(
        respuestas
          .filter((respuesta) => respuesta.statusCode === 429)
          .every((respuesta) => respuesta.json<Problema>().code === 'qr.limite_diario'),
      ).toBe(true);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(2);
    });

    it('dos pedidos simultáneos de «Mi QR»: uno genera y el otro lo reutiliza, sin error', async () => {
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const respuestas = await Promise.all(
        Array.from({ length: 3 }, () =>
          prueba.app.inject({
            method: 'POST',
            url: '/api/v1/qr-accesos',
            headers: conUsuario(sesion),
            payload: { puerta_ids: [a.puertaPrincipal.id], propio: true },
          }),
        ),
      );
      expect(respuestas.map((respuesta) => respuesta.statusCode).sort()).toEqual([200, 200, 201]);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
    });
  });
});
