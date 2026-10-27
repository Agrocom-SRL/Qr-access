import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as generarQr } from '../../src/modules/accesos/actions/generar-qr.js';
import { ejecutar as limpiarClavesVencidas } from '../../src/modules/accesos/actions/limpiar-claves-vencidas.js';
import { hashDeClave } from '../../src/modules/accesos/domain/idempotencia.js';
import { hashDeToken } from '../../src/modules/accesos/domain/token-qr.js';
import { sha256Hex } from '../../src/platform/seguridad/tokens.js';
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

    it('un QR propio reutilizado no guarda la clave: ya es idempotente y el reintento contesta igual (200, sin texto)', async () => {
      const primero = await visita(sesionA, [a.puertaPrincipal.id], undefined, { propio: true });
      expect(primero.statusCode).toBe(201);
      const reutilizado = await visita(sesionA, [a.puertaPrincipal.id], CLAVE, { propio: true });
      const reintento = await visita(sesionA, [a.puertaPrincipal.id], CLAVE, { propio: true });
      expect(reutilizado.statusCode).toBe(200);
      expect(reintento.statusCode).toBe(200);
      expect(reintento.json<Generado>()).toEqual(reutilizado.json<Generado>());
      expect(reintento.json<Generado>().texto).toBeNull();
      expect(reintento.headers['idempotent-replayed']).toBeUndefined();
      expect(await filasDeClaves()).toHaveLength(0);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
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
    const generarEn = (
      ahora: Date,
      venceAt: Date | null = null,
      secreto: string = process.env.QR_IDEMPOTENCIA_CLAVE ?? '',
    ) =>
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
              venceAt,
              etiqueta: null,
              idempotencia: { clave: CLAVE, secreto },
            },
            ahora,
          ),
      );

    it('pasadas 24 h la clave ya no cuenta: es una solicitud nueva con otro token', async () => {
      const t0 = new Date();
      const horas = (n: number): Date => new Date(t0.getTime() + n * 3_600_000);
      // El QR tiene que seguir vigente a las 23 h para que el reintento lo devuelva (si venció, es 409).
      const primero = await generarEn(t0, horas(23.5));
      const dentro = await generarEn(horas(23), horas(23.5));
      expect(dentro.repetido).toBe(true);
      expect(dentro.texto).toBe(primero.texto);
      const despues = await generarEn(horas(25), horas(26));
      expect(despues.repetido).toBeUndefined();
      expect(despues.id).not.toBe(primero.id);
      expect(despues.texto).not.toBe(primero.texto);
      // La fila vencida se reemplazó, no se acumuló.
      expect(await filasDeClaves()).toHaveLength(1);
    });

    it('la limpieza borra solo las vencidas, de todas las cuentas', async () => {
      const t0 = new Date();
      await generarEn(t0, new Date(t0.getTime() + 3_600_000));
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
      // Tampoco la clave en claro: solo su HMAC con el secreto propio, no un SHA-256 plano.
      const hashGuardado = String(claves[0]?.clave_hash);
      expect(hashGuardado).toMatch(/^[0-9a-f]{64}$/);
      expect(hashGuardado).toBe(hashDeClave(process.env.QR_IDEMPOTENCIA_CLAVE ?? '', CLAVE));
      expect(hashGuardado).not.toBe(sha256Hex(CLAVE));
      expect(hashDeClave('otro-secreto-de-al-menos-32-caracteres!', CLAVE)).not.toBe(hashGuardado);
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
    it.each([
      'corta',
      'a'.repeat(21),
      'con espacios 0123456789abcdef',
      'con.punto.0123456789abcdefghi',
      'con:dos:puntos:0123456789abcd',
      'x'.repeat(129),
      'ñandú-0123456789abcdef-ñandú',
    ])('rechaza la clave mal formada %#', async (clave) => {
      const respuesta = await visita(sesionA, [a.puertaPrincipal.id], clave);
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json<Problema>().code).toBe('validacion.invalida');
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
    });
  });

  describe('forma válida de la clave', () => {
    it.each([
      'a'.repeat(22),
      '6f1c2f1e-5b7c-4d52-9a55-0d3b5c1a7e10',
      'AbCdEfGhIjKlMnOpQrStUv_-0123456789',
      'x'.repeat(128),
    ])('acepta %#', async (clave) => {
      const respuesta = await visita(sesionA, [a.puertaPrincipal.id], clave);
      expect(respuesta.statusCode).toBe(201);
    });
  });

  describe('el reintento de un QR que ya no vale (idempotencia.qr_no_vigente)', () => {
    const reintentar = async (): Promise<{ codigo: string; status: number; cuerpo: string }> => {
      const respuesta = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      return {
        codigo: respuesta.json<Problema>().code,
        status: respuesta.statusCode,
        cuerpo: respuesta.body,
      };
    };
    const esperarNoVigente = async (): Promise<void> => {
      const resultado = await reintentar();
      expect(resultado).toMatchObject({ codigo: 'idempotencia.qr_no_vigente', status: 409 });
      expect(resultado.cuerpo).not.toContain('AQ1.');
    };

    it('usado: el reintento no devuelve el texto de un QR ya consumido', async () => {
      const primera = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      const abre = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token: primera.json<Generado>().texto, leido_en: new Date().toISOString() },
      });
      expect(abre.json<{ abrir: boolean }>().abrir).toBe(true);
      await esperarNoVigente();
    });

    it('anulado', async () => {
      await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      await prueba.pool.query('UPDATE qr_accesos SET anulado_at = NOW(3)');
      await esperarNoVigente();
    });

    it('reemplazado: un QR propio sustituido por otro ya no se repite', async () => {
      const propio = { propio: true };
      const primero = await visita(sesionA, [a.puertaPrincipal.id], CLAVE, propio);
      expect(primero.statusCode).toBe(201);
      const nuevo = await visita(sesionA, [a.puertaPrincipal.id], undefined, {
        propio: true,
        reemplazar: true,
      });
      expect(nuevo.statusCode).toBe(201);
      const reintento = await visita(sesionA, [a.puertaPrincipal.id], CLAVE, propio);
      expect(reintento.statusCode).toBe(409);
      expect(reintento.json<Problema>().code).toBe('idempotencia.qr_no_vigente');
      expect(reintento.body).not.toContain('AQ1.');
    });

    it('vencido', async () => {
      await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      await prueba.pool.query(
        'UPDATE qr_accesos SET vence_at = DATE_SUB(NOW(3), INTERVAL 1 MINUTE)',
      );
      await esperarNoVigente();
    });

    it('vigente: sigue devolviendo el mismo texto (control)', async () => {
      const primera = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      const segunda = await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      expect(segunda.statusCode).toBe(201);
      expect(segunda.json<Generado>().texto).toBe(primera.json<Generado>().texto);
    });

    it('la fila de otra cuenta con el mismo id no se ve (aislamiento)', async () => {
      await visita(sesionA, [a.puertaPrincipal.id], CLAVE);
      // B reintenta la misma clave con puerta propia: es una solicitud nueva, no el QR de A.
      const deB = await visita(sesionB, [b.puertaPrincipal.id], CLAVE);
      expect(deB.statusCode).toBe(201);
    });
  });

  describe('secreto de idempotencia rotado', () => {
    const SECRETO_VIEJO = 'secreto-viejo-de-idempotencia-0123456789';
    const SECRETO_NUEVO = 'secreto-nuevo-de-idempotencia-0123456789';
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
    const generarCon = (secreto: string, log?: { warn(o: object, m: string): void }) =>
      ContextoCuenta.ejecutar(
        {
          cuentaId: a.cuenta.id,
          usuarioId: a.usuario.id,
          rolActivoId: null,
          dispositivoId: null,
          origen: 'api',
        },
        () =>
          generarQr(prueba.pool, principal(), {
            puertaIds: [a.puertaPrincipal.id],
            venceAt: null,
            etiqueta: null,
            idempotencia: { clave: CLAVE, secreto },
            ...(log === undefined ? {} : { log }),
          }),
      );

    it('con otro secreto la clave guardada ya no se reconoce: es una solicitud nueva', async () => {
      const primero = await generarCon(SECRETO_VIEJO);
      const despues = await generarCon(SECRETO_NUEVO);
      expect(despues.repetido).toBeUndefined();
      expect(despues.id).not.toBe(primero.id);
      expect(despues.texto).not.toBe(primero.texto);
    });

    it('si la fila sobrevive a la rotación, el token derivado no coincide: error interno sin datos y sin texto', async () => {
      const primero = await generarCon(SECRETO_VIEJO);
      // Fila de la misma clave pero con el hash del secreto nuevo: lo que dejaría una rotación a medias.
      await prueba.pool.query('UPDATE claves_idempotencia SET clave_hash = ?', [
        hashDeClave(SECRETO_NUEVO, CLAVE),
      ]);
      const avisos: { objeto: object; mensaje: string }[] = [];
      const log = { warn: (objeto: object, mensaje: string) => avisos.push({ objeto, mensaje }) };
      await expect(generarCon(SECRETO_NUEVO, log)).rejects.toThrow(/no coincide/);
      expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(1);
      expect(avisos).toHaveLength(1);
      const registro = JSON.stringify(avisos);
      expect(registro).not.toContain(CLAVE);
      expect(registro).not.toContain((primero.texto ?? 'x').slice(4));
    });
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
