import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import type { PrincipalUsuario } from '../../src/platform/seguridad/principal.js';
import { ejecutar as generarQr } from '../../src/modules/accesos/actions/generar-qr.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
  PERMISOS_DE_USUARIO,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';

interface Generado {
  id: string;
  texto: string | null;
  reutilizado: boolean;
  vence_at: string;
  etiqueta: string | null;
  puertas: { id: string; nombre: string }[];
}

interface EventoDeLimite extends RowDataPacket {
  tenant_id: string;
  usuario_id: string | null;
  tipo: string;
  valor: number | null;
  tope: number | null;
  clave_unica: string | null;
}

describe('topes de generación de QR (ADR 0030 §2, §2.1, §7; ADR 0031 §9)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesionA: Sesion;
  let sesionB: Sesion;

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
    sesionA = await iniciarSesion(prueba.app, a.usuario.pin);
    sesionB = await iniciarSesion(prueba.app, b.usuario.pin);
  });

  const fijar = (clave: string, valor: number) =>
    prueba.pool.query('UPDATE configuracion_limites SET valor = ? WHERE clave = ?', [valor, clave]);
  const generar = (sesion: Sesion, payload: object) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos',
      headers: conUsuario(sesion),
      payload,
    });
  const visita = (sesion: Sesion, puertas: string[]) => generar(sesion, { puerta_ids: puertas });
  const propio = (sesion: Sesion, puertas: string[], extra: object = {}) =>
    generar(sesion, { puerta_ids: puertas, propio: true, ...extra });
  const eventos = async (tipo?: string): Promise<EventoDeLimite[]> => {
    const [filas] = await prueba.pool.query<EventoDeLimite[]>(
      tipo === undefined
        ? 'SELECT * FROM eventos_de_limite ORDER BY id'
        : 'SELECT * FROM eventos_de_limite WHERE tipo = ? ORDER BY id',
      tipo === undefined ? [] : [tipo],
    );
    return filas;
  };
  const validar = (texto: string) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: a.dispositivoPrincipal.encabezado },
      payload: { token: texto, leido_en: new Date().toISOString() },
    });

  describe('tope diario por usuario (qr.limite_diario)', () => {
    it('al pasarlo responde 429 con su código, Retry-After y deja el rechazo registrado', async () => {
      await fijar('qr.tope_diario', 3);
      for (let i = 0; i < 3; i += 1) {
        expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      }
      const rechazo = await visita(sesionA, [a.puertaPrincipal.id]);
      expect(rechazo.statusCode).toBe(429);
      expect(rechazo.json<Problema & { tope: number }>()).toMatchObject({
        code: 'qr.limite_diario',
        status: 429,
        tope: 3,
      });
      // Hasta la medianoche local: entre 1 segundo y un día
      const espera = Number(rechazo.headers['retry-after']);
      expect(espera).toBeGreaterThanOrEqual(1);
      expect(espera).toBeLessThanOrEqual(86_400);
      expect(await contarFilas(prueba.pool, 'qr_accesos', 'generado_por = ?', [a.usuario.id])).toBe(
        3,
      );

      const registrados = await eventos('qr.limite_diario');
      expect(registrados).toHaveLength(1);
      expect(registrados[0]).toMatchObject({
        tenant_id: a.cuenta.id,
        usuario_id: a.usuario.id,
        valor: 3,
        tope: 3,
      });
    });

    it('no bloquea al usuario: sigue autenticado, y al día siguiente vuelve a generar', async () => {
      await fijar('qr.tope_diario', 1);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(429);
      const lista = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/qr-accesos',
        headers: conUsuario(sesionA),
      });
      expect(lista.statusCode).toBe(200);

      const principal: PrincipalUsuario = {
        tipo: 'usuario',
        usuarioId: a.usuario.id,
        cuentaId: a.cuenta.id,
        sesionId: '0',
        rolActivoId: a.rolMiembroId,
        permisos: new Set(PERMISOS_DE_USUARIO),
        estado: 'activo',
        origenDelEstado: null,
      };
      const manana = new Date(Date.now() + 26 * 3_600_000);
      const generado = await ContextoCuenta.ejecutar(
        {
          cuentaId: a.cuenta.id,
          usuarioId: a.usuario.id,
          rolActivoId: null,
          dispositivoId: null,
          origen: 'api',
        },
        () =>
          generarQr(
            prueba.pool,
            principal,
            { puertaIds: [a.puertaPrincipal.id], venceAt: null, etiqueta: null },
            manana,
          ),
      );
      expect(generado.reutilizado).toBe(false);
    });

    it('cuenta lo que genera cada usuario: otro usuario de la misma cuenta no lo comparte', async () => {
      await fijar('qr.tope_diario', 1);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      expect((await visita(admin, [a.puertaPrincipal.id])).statusCode).toBe(201);
    });

    it('aislamiento: lo que gasta la cuenta A no cuenta para la cuenta B, ni su rechazo se ve en B', async () => {
      await fijar('qr.tope_diario', 1);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(429);
      expect((await visita(sesionB, [b.puertaPrincipal.id])).statusCode).toBe(201);
      expect(
        await contarFilas(prueba.pool, 'eventos_de_limite', 'tenant_id = ?', [b.cuenta.id]),
      ).toBe(0);
      expect(
        await contarFilas(prueba.pool, 'eventos_de_limite', 'tenant_id = ?', [a.cuenta.id]),
      ).toBe(1);
    });
  });

  describe('tope de pendientes por usuario (qr.limite_pendientes)', () => {
    it('rechaza con 429 al pasarlo, y vuelve a dejar generar al anular uno; usados y vencidos no cuentan', async () => {
      await fijar('qr.tope_pendientes', 2);
      // Un usado y uno vencido no son pendientes
      await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
        usadoAt: new Date(),
      });
      await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
        venceAt: new Date(Date.now() - 1000),
      });
      const primero = (await visita(sesionA, [a.puertaPrincipal.id])).json<Generado>();
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      const rechazo = await visita(sesionA, [a.puertaPrincipal.id]);
      expect(rechazo.statusCode).toBe(429);
      expect(rechazo.json<Problema>().code).toBe('qr.limite_pendientes');
      expect(rechazo.headers['retry-after']).toBeUndefined();
      expect(await eventos('qr.limite_pendientes')).toHaveLength(1);

      const anulado = await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/qr-accesos/${primero.id}/anulacion`,
        headers: conUsuario(sesionA),
      });
      expect(anulado.statusCode).toBe(200);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
    });

    it('aislamiento: los pendientes de la cuenta A no cuentan en la cuenta B', async () => {
      await fijar('qr.tope_pendientes', 1);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await visita(sesionB, [b.puertaPrincipal.id])).statusCode).toBe(201);
    });
  });

  describe('QR propio reutilizable (ADR 0030 §2.1)', () => {
    it('con uno vigente sin usar para las mismas puertas no genera ni anula nada: 200 y reutilizado', async () => {
      const primero = await propio(sesionA, [a.puertaPrincipal.id]);
      expect(primero.statusCode).toBe(201);
      const nuevo = primero.json<Generado>();
      expect(nuevo.reutilizado).toBe(false);
      expect(nuevo.texto).toMatch(/^AQ1\./);

      const bitacorasAntes = await contarFilas(prueba.pool, 'bitacoras');
      const otra = await propio(sesionA, [a.puertaPrincipal.id]);
      expect(otra.statusCode).toBe(200);
      const reutilizado = otra.json<Generado>();
      expect(reutilizado).toMatchObject({
        id: nuevo.id,
        texto: null,
        reutilizado: true,
        vence_at: nuevo.vence_at,
        puertas: nuevo.puertas,
      });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
      expect(await contarFilas(prueba.pool, 'qr_accesos', 'anulado_at IS NOT NULL')).toBe(0);
      expect(await contarFilas(prueba.pool, 'bitacoras')).toBe(bitacorasAntes);
      expect(await eventos()).toHaveLength(0);

      // El QR reutilizado sigue abriendo la puerta
      const validacion = await validar(nuevo.texto ?? '');
      expect(validacion.json<{ abrir: boolean }>().abrir).toBe(true);
    });

    it('no cuenta contra el tope diario ni contra la bolsa: reabrir la pantalla no consume nada', async () => {
      await fijar('qr.tope_diario', 1);
      expect((await propio(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      for (let i = 0; i < 3; i += 1) {
        expect((await propio(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(200);
      }
    });

    it('con el anterior ya usado genera uno nuevo, sin espera y sin contarlo como reemplazo', async () => {
      const primero = (await propio(sesionA, [a.puertaPrincipal.id])).json<Generado>();
      expect((await validar(primero.texto ?? '')).json<{ abrir: boolean }>().abrir).toBe(true);
      const segundo = await propio(sesionA, [a.puertaPrincipal.id]);
      expect(segundo.statusCode).toBe(201);
      expect(segundo.json<Generado>().id).not.toBe(primero.id);
      expect(await eventos()).toHaveLength(0);
    });

    it('con el anterior vencido genera uno nuevo y anula el viejo sin contarlo como reemplazo', async () => {
      const primero = (await propio(sesionA, [a.puertaPrincipal.id])).json<Generado>();
      await prueba.pool.query('UPDATE qr_accesos SET vence_at = ? WHERE id = ?', [
        new Date(Date.now() - 1000),
        primero.id,
      ]);
      const segundo = await propio(sesionA, [a.puertaPrincipal.id]);
      expect(segundo.statusCode).toBe(201);
      expect(segundo.json<Generado>().id).not.toBe(primero.id);
      expect(
        await contarFilas(prueba.pool, 'qr_accesos', 'id = ? AND anulado_at IS NOT NULL', [
          primero.id,
        ]),
      ).toBe(1);
      expect(await eventos()).toHaveLength(0);
    });

    it('con el anterior anulado genera uno nuevo', async () => {
      const primero = (await propio(sesionA, [a.puertaPrincipal.id])).json<Generado>();
      await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/qr-accesos/${primero.id}/anulacion`,
        headers: conUsuario(sesionA),
      });
      expect((await propio(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
    });

    it('cambiar las puertas es un reemplazo: anula el anterior, genera otro y lo anota', async () => {
      const primero = (await propio(sesionA, [a.puertaPrincipal.id])).json<Generado>();
      const segundo = await propio(sesionA, [a.puertaPrincipal.id, a.puertaTrasera.id]);
      expect(segundo.statusCode).toBe(201);
      expect(segundo.json<Generado>().reutilizado).toBe(false);
      expect(
        await contarFilas(prueba.pool, 'qr_accesos', 'id = ? AND anulado_at IS NOT NULL', [
          primero.id,
        ]),
      ).toBe(1);
      const anotados = await eventos('qr.reemplazo_sin_uso');
      expect(anotados).toHaveLength(1);
      expect(anotados[0]).toMatchObject({ usuario_id: a.usuario.id, tenant_id: a.cuenta.id });
      // El anterior ya no abre
      expect((await validar(primero.texto ?? '')).json<{ abrir: boolean }>().abrir).toBe(false);
    });

    it('`reemplazar` pide otro aunque sean las mismas puertas (la app perdió el token)', async () => {
      await propio(sesionA, [a.puertaPrincipal.id]);
      const otro = await propio(sesionA, [a.puertaPrincipal.id], { reemplazar: true });
      expect(otro.statusCode).toBe(201);
      expect(otro.json<Generado>().texto).toMatch(/^AQ1\./);
      expect(await eventos('qr.reemplazo_sin_uso')).toHaveLength(1);
    });

    it('`reemplazar` sin un propio vigente no cuenta como reemplazo', async () => {
      const nuevo = await propio(sesionA, [a.puertaPrincipal.id], { reemplazar: true });
      expect(nuevo.statusCode).toBe(201);
      expect(await eventos()).toHaveLength(0);
    });

    it('la espera entre reemplazos: el segundo seguido es 429 qr.limite_propios_sin_uso con Retry-After', async () => {
      await propio(sesionA, [a.puertaPrincipal.id]);
      expect((await propio(sesionA, [a.puertaTrasera.id])).statusCode).toBe(201);
      const rechazo = await propio(sesionA, [a.puertaPrincipal.id]);
      expect(rechazo.statusCode).toBe(429);
      expect(rechazo.json<Problema>().code).toBe('qr.limite_propios_sin_uso');
      const espera = Number(rechazo.headers['retry-after']);
      expect(espera).toBeGreaterThan(0);
      expect(espera).toBeLessThanOrEqual(120);
      expect(await eventos('qr.limite_propios_sin_uso')).toHaveLength(1);
      // El rechazo no deshizo el reemplazo anterior ni dejó un QR a medias
      expect(await contarFilas(prueba.pool, 'qr_accesos', 'anulado_at IS NULL')).toBe(1);
    });

    it('el tope diario de reemplazos: pasado, 429 con Retry-After hasta el día siguiente', async () => {
      await fijar('qr.espera_reemplazo_segundos', 0);
      await fijar('qr.reemplazos_sin_uso_por_dia', 2);
      await propio(sesionA, [a.puertaPrincipal.id]);
      expect((await propio(sesionA, [a.puertaTrasera.id])).statusCode).toBe(201);
      expect((await propio(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      const rechazo = await propio(sesionA, [a.puertaTrasera.id]);
      expect(rechazo.statusCode).toBe(429);
      expect(rechazo.json<Problema & { tope: number }>()).toMatchObject({
        code: 'qr.limite_propios_sin_uso',
        tope: 2,
      });
      expect(Number(rechazo.headers['retry-after'])).toBeGreaterThan(0);
      // Pedir el mismo QR propio vigente (sin reemplazar) sigue siendo gratis
      expect((await propio(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(200);
    });

    it('un reemplazo rechazado por el tope diario se deshace entero: el propio anterior sigue vigente', async () => {
      await propio(sesionA, [a.puertaPrincipal.id]);
      await fijar('qr.tope_diario', 1);
      const rechazo = await propio(sesionA, [a.puertaTrasera.id]);
      expect(rechazo.json<Problema>().code).toBe('qr.limite_diario');
      expect(await contarFilas(prueba.pool, 'qr_accesos', 'anulado_at IS NULL')).toBe(1);
      expect(await eventos('qr.reemplazo_sin_uso')).toHaveLength(0);
    });

    it('aislamiento: el propio vigente de la cuenta A no se reutiliza en la cuenta B', async () => {
      const deA = (await propio(sesionA, [a.puertaPrincipal.id])).json<Generado>();
      const deB = await propio(sesionB, [b.puertaPrincipal.id]);
      expect(deB.statusCode).toBe(201);
      expect(deB.json<Generado>().id).not.toBe(deA.id);
    });
  });

  describe('límite de puertas por QR (qr.limite_puertas)', () => {
    it('más puertas que el máximo general: 422 con el máximo', async () => {
      await fijar('qr.max_puertas_por_qr', 1);
      const rechazo = await visita(sesionA, [a.puertaPrincipal.id, a.puertaTrasera.id]);
      expect(rechazo.statusCode).toBe(422);
      expect(rechazo.json<Problema & { maximo: number }>()).toMatchObject({
        code: 'qr.limite_puertas',
        maximo: 1,
      });
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
    });

    it('el plan lo fija por encima del general', async () => {
      await fijar('qr.max_puertas_por_qr', 1);
      await prueba.pool.query('UPDATE planes SET max_puertas_por_qr = 2 WHERE nombre = ?', [
        'Plan AAA',
      ]);
      expect((await visita(sesionA, [a.puertaPrincipal.id, a.puertaTrasera.id])).statusCode).toBe(
        201,
      );
    });

    it('la excepción de la cuenta manda sobre el general, y solo en esa cuenta', async () => {
      await fijar('qr.max_puertas_por_qr', 1);
      await prueba.pool.query(
        'INSERT INTO excepciones_de_limite (tenant_id, usuario_id, clave, valor) VALUES (?, NULL, ?, 2)',
        [a.cuenta.id, 'qr.max_puertas_por_qr'],
      );
      expect((await visita(sesionA, [a.puertaPrincipal.id, a.puertaTrasera.id])).statusCode).toBe(
        201,
      );
      // La cuenta B no la tiene
      expect(
        (await visita(sesionB, [b.puertaPrincipal.id, b.puertaTrasera.id])).json<Problema>().code,
      ).toBe('qr.limite_puertas');
    });
  });

  describe('bolsa mensual de la cuenta (no corta, avisa)', () => {
    it('marca el aviso al llegar al porcentaje y el exceso al pasarse, una vez; nunca corta', async () => {
      await prueba.pool.query('UPDATE planes SET bolsa_qr_mensual = 5 WHERE nombre = ?', [
        'Plan AAA',
      ]);
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      // Para no tocar el tope de pendientes ni el diario de un solo usuario
      const sesiones = [sesionA, admin];
      const marcas: string[][] = [];
      for (let i = 0; i < 7; i += 1) {
        const respuesta = await visita(sesiones[i % 2] ?? sesionA, [a.puertaPrincipal.id]);
        expect(respuesta.statusCode, `QR ${String(i + 1)}`).toBe(201);
        marcas.push((await eventos()).map((evento) => evento.tipo));
      }
      expect(marcas[2]).toEqual([]);
      expect(marcas[3]).toEqual(['bolsa.aviso']); // 4 de 5: 80 %
      expect(marcas[4]).toEqual(['bolsa.aviso']);
      expect(marcas[5]).toEqual(['bolsa.aviso', 'bolsa.superada']); // 6 > 5
      expect(marcas[6]).toEqual(['bolsa.aviso', 'bolsa.superada']); // sin repetir el mismo día
      const superada = (await eventos('bolsa.superada'))[0];
      expect(superada).toMatchObject({ tenant_id: a.cuenta.id, valor: 6, tope: 5 });
    });

    it('sin plan que la fije rige la bolsa general; y una excepción de la cuenta la amplía', async () => {
      await fijar('qr.bolsa_mensual', 1);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await eventos()).map((e) => e.tipo)).toEqual(['bolsa.aviso']);
      await prueba.pool.query(
        'INSERT INTO excepciones_de_limite (tenant_id, usuario_id, clave, valor) VALUES (?, NULL, ?, 100)',
        [b.cuenta.id, 'qr.bolsa_mensual'],
      );
      expect((await visita(sesionB, [b.puertaPrincipal.id])).statusCode).toBe(201);
      expect(
        await contarFilas(prueba.pool, 'eventos_de_limite', 'tenant_id = ?', [b.cuenta.id]),
      ).toBe(0);
    });

    it('aislamiento: la bolsa de la cuenta A no se gasta con lo que genera la cuenta B', async () => {
      await prueba.pool.query('UPDATE planes SET bolsa_qr_mensual = 1 WHERE nombre = ?', [
        'Plan AAA',
      ]);
      for (let i = 0; i < 3; i += 1) {
        expect((await visita(sesionB, [b.puertaPrincipal.id])).statusCode).toBe(201);
      }
      expect(await eventos()).toHaveLength(0);
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await eventos()).map((e) => [e.tenant_id, e.tipo])).toEqual([
        [a.cuenta.id, 'bolsa.aviso'],
      ]);
    });
  });

  describe('validar un QR nunca se limita (ADR 0030 §1)', () => {
    it('con los topes diario y de pendientes agotados y la bolsa superada, el QR vigente abre', async () => {
      await fijar('qr.tope_diario', 1);
      await fijar('qr.tope_pendientes', 1);
      await fijar('qr.bolsa_mensual', 1);
      const generado = (await visita(sesionA, [a.puertaPrincipal.id])).json<Generado>();
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(429);
      expect((await eventos()).map((e) => e.tipo)).toContain('bolsa.aviso');

      const validacion = await validar(generado.texto ?? '');
      expect(validacion.statusCode).toBe(200);
      expect(validacion.json<{ abrir: boolean; motivo_code: string }>()).toMatchObject({
        abrir: true,
        motivo_code: 'acceso.permitido',
      });
      expect(await contarFilas(prueba.pool, 'eventos_acceso')).toBe(1);
    });
  });
});
