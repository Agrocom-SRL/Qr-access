import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as generarQr } from '../../src/modules/accesos/actions/generar-qr.js';
import { ejecutar as limpiarClavesVencidas } from '../../src/modules/accesos/actions/limpiar-claves-vencidas.js';
import { hashDeToken } from '../../src/modules/accesos/domain/token-qr.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import type { PrincipalUsuario } from '../../src/platform/seguridad/principal.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearUsuarioConPin,
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

const CLAVE = '6f1c2f1e-5b7c-4d52-9a55-0d3b5c1a7e10';
const OTRA_CLAVE = '0b8e3d7a-91c4-4a0f-8f0e-3f1a2b9c4d55';

describe('Idempotency-Key en POST /qr-accesos (ADR 0031 §11)', () => {
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

  const generar = (sesion: Sesion, payload: object, clave?: string) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos',
      headers: {
        ...conUsuario(sesion),
        ...(clave === undefined ? {} : { 'idempotency-key': clave }),
      },
      payload,
    });
  const visita = (sesion: Sesion, puertas: string[], clave?: string, extra: object = {}) =>
    generar(sesion, { puerta_ids: puertas, ...extra }, clave);
  const filasDeClaves = async (): Promise<RowDataPacket[]> => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT * FROM claves_idempotencia ORDER BY id',
    );
    return filas;
  };

  describe('repetición exacta', () => {
    it('misma clave y mismo cuerpo devuelven el mismo QR, con su texto, sin crear otro', async () => {
      const primera = await visita(sesionA, [a.puertaPrincipal.id], CLAVE, { etiqueta: 'Juan' });
      const segunda = await visita(sesionA, [a.puertaPrincipal.id], CLAVE, { etiqueta: 'Juan' });

      expect(primera.statusCode).toBe(201);
      expect(segunda.statusCode).toBe(201);
      expect(primera.headers['idempotent-replayed']).toBeUndefined();
      expect(segunda.headers['idempotent-replayed']).toBe('true');
      expect(segunda.json<Generado>()).toEqual(primera.json<Generado>());
      expect(primera.json<Generado>().texto).toMatch(/^AQ1\.[A-Za-z0-9_-]{22}$/);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
    });

    it('el orden de las puertas y repetirlas no cambia el cuerpo', async () => {
      const primera = await visita(sesionA, [a.puertaPrincipal.id, a.puertaTrasera.id], CLAVE);
      const segunda = await visita(
        sesionA,
        [a.puertaTrasera.id, a.puertaPrincipal.id, a.puertaTrasera.id],
        CLAVE,
      );
      expect(segunda.statusCode).toBe(201);
      expect(segunda.json<Generado>().id).toBe(primera.json<Generado>().id);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
    });

    it('un reintento no gasta topes: con el tope diario en 1 el reintento sigue contestando', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 1 WHERE clave = 'qr.tope_diario'",
      );
      const primera = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      const reintento = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      expect(primera.statusCode).toBe(201);
      expect(reintento.statusCode).toBe(201);
      expect(reintento.json<Generado>().id).toBe(primera.json<Generado>().id);
      // Otra solicitud (otra clave) sí choca con el tope: el reintento no lo había consumido dos veces.
      const otra = await visita(sesionA, [a.puertaPrincipal.id], OTRA_CLAVE);
      expect(otra.statusCode).toBe(429);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
    });

    it('sin cabecera nada cambia: dos peticiones, dos QR', async () => {
      const primera = await visita(sesionA, [a.puertaPrincipal.id]);
      const segunda = await visita(sesionA, [a.puertaPrincipal.id]);
      expect(primera.json<Generado>().id).not.toBe(segunda.json<Generado>().id);
      expect(await filasDeClaves()).toHaveLength(0);
    });

    it('claves distintas dan QR distintos', async () => {
      const primera = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      const segunda = await visita(sesionA, [a.puertaPrincipal.id], OTRA_CLAVE);
      expect(primera.json<Generado>().texto).not.toBe(segunda.json<Generado>().texto);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(2);
    });

    it('el reintento de un QR propio reutilizado devuelve lo mismo (200, sin texto)', async () => {
      const primero = await visita(sesionA, [a.puertaPrincipal.id], undefined, { propio: true });
      expect(primero.statusCode).toBe(201);
      const reutilizado = await visita(sesionA, [a.puertaPrincipal.id], CLAVE, { propio: true });
      const reintento = await visita(sesionA, [a.puertaPrincipal.id], CLAVE, { propio: true });
      expect(reutilizado.statusCode).toBe(200);
      expect(reintento.statusCode).toBe(200);
      expect(reintento.json<Generado>()).toEqual(reutilizado.json<Generado>());
      expect(reintento.json<Generado>().texto).toBeNull();
      expect(reintento.headers['idempotent-replayed']).toBe('true');
    });

    it('lo que falla no se recuerda: tras un 429, la misma clave genera cuando hay lugar', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 1 WHERE clave = 'qr.tope_diario'",
      );
      expect((await visita(sesionA, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await visita(sesionA, [a.puertaPrincipal.id], CLAVE)).statusCode).toBe(429);
      expect(await filasDeClaves()).toHaveLength(0);
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 5 WHERE clave = 'qr.tope_diario'",
      );
      const ok = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      expect(ok.statusCode).toBe(201);
      expect(await filasDeClaves()).toHaveLength(1);
    });

    it('un usuario que ya no puede generar no recibe el QR de su reintento', async () => {
      const primera = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      expect(primera.statusCode).toBe(201);
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'restringido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
        [a.usuario.id],
      );
      const reintento = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      expect(reintento.statusCode).toBe(403);
      expect(reintento.json<Problema>().code).toBe('qr.generacion_restringida');
    });
  });

  describe('cuerpo distinto', () => {
    it('la misma clave con otro cuerpo es 422 idempotencia.conflicto y no crea nada', async () => {
      await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      for (const otro of [
        { puerta_ids: [a.puertaTrasera.id] },
        { puerta_ids: [a.puertaPrincipal.id], etiqueta: 'Otra' },
        { puerta_ids: [a.puertaPrincipal.id], propio: true },
        {
          puerta_ids: [a.puertaPrincipal.id],
          vence_at: new Date(Date.now() + 3_600_000).toISOString(),
        },
      ]) {
        const respuesta = await generar(sesionA, otro, CLAVE);
        expect(respuesta.statusCode).toBe(422);
        expect(respuesta.json<Problema>()).toMatchObject({
          code: 'idempotencia.conflicto',
          status: 422,
        });
        expect(respuesta.body).not.toContain('AQ1.');
      }
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
    });
  });

  describe('aislamiento: la clave es por usuario y por cuenta', () => {
    it('otro usuario de la misma cuenta con la misma clave genera su propio QR', async () => {
      await crearUsuarioConPin(prueba.pool, a.cuenta, 'US02', [a.rolMiembroId], {
        superiorId: a.administrador.id,
      });
      const otraSesion = await iniciarSesion(prueba.app, `${a.cuenta.codigo}US02`);
      const delPrimero = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      const delSegundo = await visita(otraSesion, [a.puertaPrincipal.id], CLAVE);
      expect(delSegundo.statusCode).toBe(201);
      expect(delSegundo.headers['idempotent-replayed']).toBeUndefined();
      expect(delSegundo.json<Generado>().id).not.toBe(delPrimero.json<Generado>().id);
      expect(delSegundo.json<Generado>().texto).not.toBe(delPrimero.json<Generado>().texto);
      expect(await filasDeClaves()).toHaveLength(2);
    });

    it('otra cuenta con la misma clave tampoco ve ni recibe el QR de la primera', async () => {
      const deA = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      // Mismo cuerpo que A es imposible (puerta ajena = 404); con puerta propia es una solicitud nueva.
      const ajena = await visita(sesionB, [a.puertaPrincipal.id], CLAVE);
      expect(ajena.statusCode).toBe(404);
      expect(ajena.json<Problema>().code).toBe('puerta.no_encontrada');
      const deB = await visita(sesionB, [b.puertaPrincipal.id], CLAVE);
      expect(deB.statusCode).toBe(201);
      expect(deB.headers['idempotent-replayed']).toBeUndefined();
      expect(deB.json<Generado>().texto).not.toBe(deA.json<Generado>().texto);
      const filas = await filasDeClaves();
      expect(filas.map((fila) => String(fila.tenant_id)).sort()).toEqual(
        [a.cuenta.id, b.cuenta.id].sort(),
      );
      // Lo de A sigue siendo de A: repetirlo desde A devuelve su QR, no el de B.
      const repetidoA = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      expect(repetidoA.json<Generado>().id).toBe(deA.json<Generado>().id);
    });
  });

  describe('concurrencia', () => {
    it('peticiones simultáneas con la misma clave: un solo QR y todas reciben el mismo', async () => {
      const respuestas = await Promise.all(
        Array.from({ length: 6 }, () => visita(sesionA, [a.puertaPrincipal.id], CLAVE)),
      );
      const buenas = respuestas.filter((respuesta) => respuesta.statusCode === 201);
      // Las demás (si las hay) solo pueden ser un 409 reintentable, nunca un segundo QR.
      for (const respuesta of respuestas.filter((r) => r.statusCode !== 201)) {
        expect(respuesta.json<Problema>().code).toBe('idempotencia.en_curso');
      }
      expect(buenas.length).toBeGreaterThanOrEqual(1);
      expect(new Set(buenas.map((r) => r.json<Generado>().texto)).size).toBe(1);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
      expect(await filasDeClaves()).toHaveLength(1);
    });
  });

  describe('vencimiento y limpieza', () => {
    const principal = (): PrincipalUsuario => ({
      tipo: 'usuario',
      usuarioId: a.usuario.id,
      cuentaId: a.cuenta.id,
      sesionId: '0',
      rolActivoId: a.rolMiembroId,
      permisos: new Set(PERMISOS_DE_USUARIO),
      estado: 'activo',
      origenDelEstado: null,
    });
    const generarEn = (ahora: Date) =>
      ContextoCuenta.ejecutar(
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
            principal(),
            {
              puertaIds: [a.puertaPrincipal.id],
              venceAt: null,
              etiqueta: null,
              idempotencia: { clave: CLAVE, pimienta: process.env.PIN_PIMIENTA ?? '' },
            },
            ahora,
          ),
      );

    it('pasadas 24 h la clave ya no cuenta: es una solicitud nueva con otro token', async () => {
      const t0 = new Date();
      const primero = await generarEn(t0);
      const dentro = await generarEn(new Date(t0.getTime() + 23 * 3_600_000));
      expect(dentro.repetido).toBe(true);
      expect(dentro.texto).toBe(primero.texto);
      const despues = await generarEn(new Date(t0.getTime() + 25 * 3_600_000));
      expect(despues.repetido).toBeUndefined();
      expect(despues.id).not.toBe(primero.id);
      expect(despues.texto).not.toBe(primero.texto);
      // La fila vencida se reemplazó, no se acumuló.
      expect(await filasDeClaves()).toHaveLength(1);
    });

    it('la limpieza borra solo las vencidas, de todas las cuentas', async () => {
      const t0 = new Date();
      await generarEn(t0);
      await visita(sesionB, [b.puertaPrincipal.id], OTRA_CLAVE);
      expect(await filasDeClaves()).toHaveLength(2);
      expect(await limpiarClavesVencidas(prueba.pool, new Date(t0.getTime() + 3_600_000))).toBe(0);
      expect(
        await limpiarClavesVencidas(prueba.pool, new Date(t0.getTime() + 25 * 3_600_000)),
      ).toBe(2);
      expect(await filasDeClaves()).toHaveLength(0);
      // Los QR siguen: la limpieza solo descarta el caché.
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(2);
    });
  });

  describe('el token no se guarda', () => {
    it('la base solo tiene el hash del QR: ni la tabla de claves ni la bitácora llevan el texto', async () => {
      const respuesta = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      const { texto } = respuesta.json<Generado>();
      expect(texto).not.toBeNull();
      const token = (texto ?? '').slice('AQ1.'.length);

      const [qr] = await prueba.pool.query<RowDataPacket[]>('SELECT token_hash FROM qr_accesos');
      expect(qr[0]?.token_hash).toBe(hashDeToken(token));

      const [claves] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT * FROM claves_idempotencia',
      );
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>('SELECT * FROM bitacoras');
      for (const volcado of [JSON.stringify(claves), JSON.stringify(bitacora)]) {
        expect(volcado).not.toContain(token);
        expect(volcado).not.toContain(CLAVE);
      }
      // Tampoco la clave en claro: solo su hash.
      expect(String(claves[0]?.clave_hash)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('el log de la petición no lleva el token ni la clave', async () => {
      const lineas: string[] = [];
      const { Writable } = await import('node:stream');
      const destino = new Writable({
        write(trozo: Buffer, _codificacion, listo) {
          lineas.push(trozo.toString());
          listo();
        },
      });
      const otra = await crearAppDePrueba(destino);
      try {
        const sesion = await iniciarSesion(otra.app, a.usuario.pin);
        const respuesta = await otra.app.inject({
          method: 'POST',
          url: '/api/v1/qr-accesos',
          headers: { ...conUsuario(sesion), 'idempotency-key': CLAVE },
          payload: { puerta_ids: [a.puertaPrincipal.id] },
        });
        const { texto } = respuesta.json<Generado>();
        const registro = lineas.join('');
        expect(registro).not.toContain((texto ?? 'x').slice(4));
        expect(registro).not.toContain(CLAVE);
      } finally {
        await otra.cerrar();
      }
    });
  });

  describe('forma de la clave', () => {
    it.each(['corta', 'con espacios 0123456789abcdef', 'x'.repeat(129), 'ñandú-0123456789abcdef'])(
      'rechaza la clave mal formada %#',
      async (clave) => {
        const respuesta = await visita(sesionA, [a.puertaPrincipal.id], clave);
        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.json<Problema>().code).toBe('validacion.invalida');
        expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
      },
    );
  });

  describe('validar un QR no usa idempotencia ni se limita', () => {
    const validar = (texto: string, cabeceras: Record<string, string> = {}) =>
      prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado, ...cabeceras },
        payload: { token: texto, leido_en: new Date().toISOString() },
      });

    it('el QR de un reintento abre una sola vez; la clave no cambia la validación y no se guarda nada', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 1 WHERE clave = 'qr.tope_diario'",
      );
      const primera = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      const reintento = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      const texto = reintento.json<Generado>().texto ?? '';
      expect(texto).toBe(primera.json<Generado>().texto);

      // Con el tope diario agotado, validar sigue abriendo (nunca se limita).
      const abre = await validar(texto, { 'idempotency-key': CLAVE });
      expect(abre.statusCode).toBe(200);
      expect(abre.json<{ abrir: boolean }>().abrir).toBe(true);
      // Mismo texto, misma clave: no es un reintento "idempotente", el QR ya se usó.
      const repite = await validar(texto, { 'idempotency-key': CLAVE });
      expect(repite.json<{ abrir: boolean; motivo?: string }>().abrir).toBe(false);
      // Ambos intentos quedan en eventos_acceso y la validación no creó ninguna clave.
      expect(await contarFilas(prueba.pool, 'eventos_acceso')).toBe(2);
      expect(await filasDeClaves()).toHaveLength(1);
    });
  });
});
