import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import type { PrincipalUsuario } from '../../src/platform/seguridad/principal.js';
import { ErrorDeDominio } from '../../src/platform/errores/error-de-dominio.js';
import { ejecutar as generarQr } from '../../src/modules/accesos/actions/generar-qr.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
  crearUsuarioConPin,
  PERMISOS_DE_USUARIO,
  type Escenario,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema } from '../helpers/http.js';

const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Generación bajo carga: conexiones, bloqueos y lo que NO debe esperar a una generación en curso
 * (ADR 0030 §2 «Serialización por rama»; ADR 0032).
 */
describe('generar-qr bajo carga', () => {
  let prueba: AppDePrueba;
  let a: Escenario;

  beforeAll(async () => {
    // El pool de la app más chico posible: si una petición retiene dos conexiones, se cuelga.
    prueba = await crearAppDePrueba(undefined, { DB_POOL_APP: '2' });
  });
  afterAll(async () => {
    await prueba.cerrar();
  });
  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
  });

  const principalDe = (usuarioId: string): PrincipalUsuario => ({
    tipo: 'usuario',
    usuarioId,
    cuentaId: a.cuenta.id,
    sesionId: '0',
    rolActivoId: a.rolMiembroId,
    permisos: new Set(PERMISOS_DE_USUARIO),
    estado: 'activo',
    origenDelEstado: null,
  });
  const generarComo = (
    usuarioId: string,
    extra: {
      propio?: boolean;
      reemplazar?: boolean;
      log?: { warn(o: object, m: string): void };
    } = {},
  ) =>
    ContextoCuenta.ejecutar(
      { cuentaId: a.cuenta.id, usuarioId, rolActivoId: null, dispositivoId: null, origen: 'api' },
      () =>
        generarQr(prueba.pool, principalDe(usuarioId), {
          puertaIds: [a.puertaPrincipal.id],
          venceAt: null,
          etiqueta: null,
          ...extra,
        }),
    );
  async function miembros(cantidad: number): Promise<UsuarioDePrueba[]> {
    const lista: UsuarioDePrueba[] = [];
    for (let i = 0; i < cantidad; i += 1) {
      lista.push(
        await crearUsuarioConPin(
          prueba.pool,
          a.cuenta,
          `M${String(i).padStart(3, '0')}`.slice(0, 4),
          [a.rolMiembroId],
          {
            superiorId: a.administrador.id,
          },
        ),
      );
    }
    return lista;
  }

  it('B1: más reutilizaciones de «Mi QR» simultáneas que conexiones en el pool no se cuelgan', async () => {
    const usuarios = await miembros(6); // 6 usuarios distintos (no se serializan entre sí) y 2 conexiones
    for (const usuario of usuarios) {
      await generarComo(usuario.id, { propio: true });
    }
    const inicio = Date.now();
    const resultados = await Promise.all(
      usuarios.map((usuario) => generarComo(usuario.id, { propio: true })),
    );
    expect(resultados.every((resultado) => resultado.reutilizado)).toBe(true);
    // Muy por debajo de la espera por conexión (DB_ESPERA_MS_APP, 3 s): nadie esperó a otra petición
    expect(Date.now() - inicio).toBeLessThan(2500);
    expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(6);
  });

  it('M1: suspender un superior mientras sus hijos generan termina sin errores raros ni QR vivos después', async () => {
    const hijos = await miembros(5);
    const generaciones = hijos.map((hijo) =>
      generarComo(hijo.id).then(
        () => 'ok',
        (error: unknown) => (error instanceof ErrorDeDominio ? error.code : 'otro'),
      ),
    );
    const suspension = prueba.pool.query(
      "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
      [a.administrador.id],
    );
    const [resultados] = await Promise.all([Promise.all(generaciones), suspension]);
    // Cada una o entró antes de la suspensión o fue rechazada por ella: nada más (ni deadlock ni timeout)
    expect(resultados.every((r) => r === 'ok' || r === 'qr.generador_suspendido')).toBe(true);
    const antes = await contarFilas(prueba.pool, 'qr_accesos');
    expect(antes).toBe(resultados.filter((r) => r === 'ok').length);
    // Ya suspendido, ninguna genera
    await expect(generarComo(hijos[0]?.id ?? '')).rejects.toMatchObject({
      code: 'qr.generador_suspendido',
    });
    expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(antes);
  });

  it('M1: el conteo de la bolsa no corre bajo los bloqueos: con la cadena bloqueada por otro, igual deja la marca al terminar', async () => {
    await prueba.pool.query('UPDATE planes SET bolsa_qr_mensual = 1 WHERE nombre = ?', [
      'Plan AAA',
    ]);
    await generarComo(a.usuario.id);
    const [marcas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT tipo FROM eventos_de_limite WHERE tipo LIKE ? ORDER BY tipo',
      ['bolsa.%'],
    );
    expect(marcas.map((marca) => String(marca.tipo))).toEqual(['bolsa.aviso']);
    await generarComo(a.usuario.id);
    const [despues] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT tipo FROM eventos_de_limite WHERE tipo LIKE ? ORDER BY tipo',
      ['bolsa.%'],
    );
    expect(despues.map((marca) => String(marca.tipo))).toEqual(['bolsa.aviso', 'bolsa.superada']);
  });

  it('L1: si registrar el rechazo por tope falla, el usuario recibe igual el 429 y el log no trae datos sensibles', async () => {
    await prueba.pool.query(
      "UPDATE configuracion_limites SET valor = 0 WHERE clave = 'qr.tope_diario'",
    );
    const avisos: { objeto: object; mensaje: string }[] = [];
    await prueba.pool.query('RENAME TABLE eventos_de_limite TO eventos_de_limite_fuera');
    try {
      await expect(
        generarComo(a.usuario.id, {
          log: { warn: (objeto, mensaje) => avisos.push({ objeto, mensaje }) },
        }),
      ).rejects.toMatchObject({ code: 'qr.limite_diario', status: 429 });
    } finally {
      await prueba.pool.query('RENAME TABLE eventos_de_limite_fuera TO eventos_de_limite');
    }
    expect(avisos).toHaveLength(1);
    const texto = JSON.stringify(avisos);
    expect(texto).toContain('limite.rechazo_sin_registrar');
    expect(texto).not.toMatch(/eventos_de_limite|INSERT|qr:/i);
  });

  it('L6: un tope general faltante responde 503 con código estable y sin filtrar el nombre de la clave', async () => {
    await prueba.pool.query("DELETE FROM configuracion_limites WHERE clave = 'qr.tope_diario'");
    const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos',
      headers: conUsuario(sesion),
      payload: { puerta_ids: [a.puertaPrincipal.id] },
    });
    expect(respuesta.statusCode).toBe(503);
    expect(respuesta.json<Problema>().code).toBe('limite.configuracion_incompleta');
    expect(respuesta.body).not.toContain('tope_diario');
    expect(await contarFilas(prueba.pool, 'qr_accesos')).toBe(0);
  });

  describe('L7: la validación no espera a la generación', () => {
    const validar = (token: string) =>
      prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token, leido_en: new Date().toISOString() },
      });

    it('validar un QR de un generador cuya generación está en curso (bloqueado) no espera', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const conexion = await prueba.pool.getConnection();
      try {
        await conexion.beginTransaction();
        // Lo que toma una generación: la fila del generador, su cadena y la cuenta
        await conexion.query('SELECT id FROM usuarios WHERE tenant_id = ? FOR UPDATE', [
          a.cuenta.id,
        ]);
        await conexion.query('SELECT id FROM cuentas WHERE id = ? LOCK IN SHARE MODE', [
          a.cuenta.id,
        ]);
        const inicio = Date.now();
        const respuesta = await validar(qr.texto);
        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.json<{ abrir: boolean }>().abrir).toBe(true);
        expect(Date.now() - inicio).toBeLessThan(1000);
      } finally {
        await conexion.rollback();
        conexion.release();
      }
    });

    it('consumir el QR propio espera al lock de buscarPropioSinUso solo lo que dura la generación', async () => {
      const propio = await generarComo(a.usuario.id, { propio: true });
      const conexion = await prueba.pool.getConnection();
      await conexion.beginTransaction();
      await conexion.query(
        'SELECT id FROM qr_accesos WHERE generado_por = ? AND es_propio = 1 AND anulado_at IS NULL AND usado_at IS NULL FOR UPDATE',
        [a.usuario.id],
      );
      const inicio = Date.now();
      const validacion = validar(propio.texto ?? '');
      await pausa(150); // lo que dura una generación: milisegundos
      await conexion.commit();
      conexion.release();
      const respuesta = await validacion;
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json<{ abrir: boolean }>().abrir).toBe(true);
      expect(Date.now() - inicio).toBeLessThan(1500);
    });

    it('validar mientras otra reemplaza el QR propio: ambas terminan rápido y sin error de servidor', async () => {
      const propio = await generarComo(a.usuario.id, { propio: true });
      const inicio = Date.now();
      const [generacion, respuesta] = await Promise.all([
        generarComo(a.usuario.id, { propio: true, reemplazar: true }),
        validar(propio.texto ?? ''),
      ]);
      expect(generacion.reutilizado).toBe(false);
      expect(respuesta.statusCode).toBe(200);
      expect(Date.now() - inicio).toBeLessThan(2500);
    });
  });
});
