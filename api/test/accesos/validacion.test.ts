import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearEscenario,
  crearQr,
  crearUsuarioConPin,
  type DispositivoDePrueba,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion } from '../helpers/http.js';
import { cualquierTexto, fechaIsoUtc } from '../helpers/esperados.js';

interface Validacion {
  abrir: boolean;
  segundos?: number;
  evento_id: string;
  motivo_code: string;
}

interface EventoFila extends RowDataPacket {
  resultado: string;
  motivo_code: string;
  puerta_id: string;
  dispositivo_id: string;
  qr_acceso_id: string | null;
  token_hash: string | null;
}

describe('POST /api/v1/dispositivos/validaciones (ADR 0008)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;

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
  });

  const validar = (dispositivo: DispositivoDePrueba, token: string, extra: object = {}) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: dispositivo.encabezado },
      payload: { token, leido_en: new Date().toISOString(), ...extra },
    });

  async function eventos(): Promise<EventoFila[]> {
    const [filas] = await prueba.pool.query<EventoFila[]>(
      'SELECT * FROM eventos_acceso ORDER BY id',
    );
    return filas;
  }

  it('abre con un QR vigente de su puerta, entrega los segundos y registra el evento', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const respuesta = await validar(a.dispositivoPrincipal, qr.texto);
    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json<Validacion>();
    expect(cuerpo).toEqual({
      abrir: true,
      segundos: 6,
      evento_id: cualquierTexto(),
      motivo_code: 'acceso.permitido',
    });

    const [evento] = await eventos();
    expect(evento).toMatchObject({
      resultado: 'permitido',
      motivo_code: 'acceso.permitido',
    });
    expect(String(evento?.id)).toBe(cuerpo.evento_id);
    expect(String(evento?.puerta_id)).toBe(a.puertaPrincipal.id);
    expect(String(evento?.dispositivo_id)).toBe(a.dispositivoPrincipal.id);
    expect(String(evento?.qr_acceso_id)).toBe(qr.id);

    const [qrFila] = (
      await prueba.pool.query<RowDataPacket[]>('SELECT * FROM qr_accesos WHERE id = ?', [qr.id])
    )[0];
    expect(qrFila?.usado_at).toBeInstanceOf(Date);
    expect(String(qrFila?.usado_dispositivo_id)).toBe(a.dispositivoPrincipal.id);
  });

  it('un QR sirve una sola vez: la segunda lectura se rechaza con qr.usado', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    expect((await validar(a.dispositivoPrincipal, qr.texto)).json<Validacion>().abrir).toBe(true);
    const segunda = (await validar(a.dispositivoPrincipal, qr.texto)).json<Validacion>();
    expect(segunda).toEqual({
      abrir: false,
      evento_id: cualquierTexto(),
      motivo_code: 'qr.usado',
    });
    expect((await eventos()).map((e) => e.motivo_code)).toEqual(['acceso.permitido', 'qr.usado']);
  });

  it('dos validaciones concurrentes del mismo QR: solo una abre', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [
      a.puertaPrincipal.id,
      a.puertaTrasera.id,
    ]);
    const respuestas = await Promise.all([
      validar(a.dispositivoPrincipal, qr.texto),
      validar(a.dispositivoTrasero, qr.texto),
      validar(a.dispositivoPrincipal, qr.texto),
      validar(a.dispositivoTrasero, qr.texto),
      validar(a.dispositivoPrincipal, qr.texto),
      validar(a.dispositivoTrasero, qr.texto),
    ]);
    const resultados = respuestas.map((r) => r.json<Validacion>());
    expect(respuestas.every((r) => r.statusCode === 200)).toBe(true);
    expect(resultados.filter((r) => r.abrir)).toHaveLength(1);
    expect(resultados.filter((r) => !r.abrir).every((r) => r.motivo_code === 'qr.usado')).toBe(
      true,
    );

    const registrados = await eventos();
    expect(registrados).toHaveLength(6);
    expect(registrados.filter((e) => e.resultado === 'permitido')).toHaveLength(1);
    const [usos] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT usado_at FROM qr_accesos WHERE id = ?',
      [qr.id],
    );
    expect(usos[0]?.usado_at).toBeInstanceOf(Date);
  });

  describe('rechazos: cada uno responde 200 con abrir:false, su motivo, y deja su evento', () => {
    async function rechazado(dispositivo: DispositivoDePrueba, texto: string, motivo: string) {
      const respuesta = await validar(dispositivo, texto);
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toEqual({
        abrir: false,
        evento_id: cualquierTexto(),
        motivo_code: motivo,
      });
      const registrados = await eventos();
      const ultimo = registrados.at(-1);
      expect(ultimo).toMatchObject({ resultado: 'rechazado', motivo_code: motivo });
      expect(String(ultimo?.id)).toBe(respuesta.json<Validacion>().evento_id);
      return ultimo;
    }

    it('formato inválido (sin prefijo, largo o caracteres): qr.formato_invalido, sin guardar el texto', async () => {
      for (const texto of [
        '',
        'hola',
        'AQ1.corto',
        `AQ1.${'a'.repeat(23)}`,
        `AQ2.${'a'.repeat(22)}`,
        `AQ1.${'ñ'.repeat(22)}`,
      ]) {
        const evento = await rechazado(a.dispositivoPrincipal, texto, 'qr.formato_invalido');
        expect(evento?.token_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(evento?.qr_acceso_id).toBeNull();
      }
      const [todo] = await prueba.pool.query<RowDataPacket[]>('SELECT * FROM eventos_acceso');
      expect(JSON.stringify(todo)).not.toContain('AQ1.corto');
    });

    it('un token que no existe: qr.desconocido, guardando su hash y no el texto', async () => {
      const texto = `AQ1.${'A'.repeat(22)}`;
      const evento = await rechazado(a.dispositivoPrincipal, texto, 'qr.desconocido');
      expect(evento?.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(await eventos())).not.toContain('A'.repeat(22));
    });

    it('un QR vencido: qr.vencido, y no se consume', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
        venceAt: new Date(Date.now() - 1000),
      });
      const evento = await rechazado(a.dispositivoPrincipal, qr.texto, 'qr.vencido');
      expect(String(evento?.qr_acceso_id)).toBe(qr.id);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT usado_at FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      expect(filas[0]?.usado_at).toBeNull();
    });

    it('un QR anulado: qr.anulado', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
        anuladoAt: new Date(),
      });
      await rechazado(a.dispositivoPrincipal, qr.texto, 'qr.anulado');
    });

    it('un QR anulado desde la API deja de abrir', async () => {
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const emitido = (
        await prueba.app.inject({
          method: 'POST',
          url: '/api/v1/qr-accesos',
          headers: conUsuario(sesion),
          payload: { puerta_ids: [a.puertaPrincipal.id] },
        })
      ).json<{ id: string; texto: string }>();
      await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/qr-accesos/${emitido.id}/anulacion`,
        headers: conUsuario(sesion),
      });
      await rechazado(a.dispositivoPrincipal, emitido.texto, 'qr.anulado');
    });

    it('un QR emitido por la API abre de punta a punta', async () => {
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const emitido = (
        await prueba.app.inject({
          method: 'POST',
          url: '/api/v1/qr-accesos',
          headers: conUsuario(sesion),
          payload: { puerta_ids: [a.puertaTrasera.id] },
        })
      ).json<{ texto: string }>();
      const respuesta = await validar(a.dispositivoTrasero, emitido.texto);
      expect(respuesta.json<Validacion>()).toMatchObject({ abrir: true, segundos: 5 });
    });

    it('un QR de otra puerta: qr.otra_puerta, y no se consume', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaTrasera.id]);
      await rechazado(a.dispositivoPrincipal, qr.texto, 'qr.otra_puerta');
      expect((await validar(a.dispositivoTrasero, qr.texto)).json<Validacion>().abrir).toBe(true);
    });

    it('un QR de otra cuenta: qr.desconocido (el dispositivo solo busca en su cuenta)', async () => {
      const deB = await crearQr(prueba.pool, b.cuenta, b.administrador.id, [b.puertaPrincipal.id]);
      const evento = await rechazado(a.dispositivoPrincipal, deB.texto, 'qr.desconocido');
      expect(evento?.qr_acceso_id).toBeNull();
      // Y el evento quedó en la cuenta del dispositivo, no en la del QR
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT tenant_id FROM eventos_acceso',
      );
      expect(String(filas[0]?.tenant_id)).toBe(a.cuenta.id);
      const [qrDeB] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT usado_at FROM qr_accesos WHERE id = ?',
        [deB.id],
      );
      expect(qrDeB[0]?.usado_at).toBeNull();
    });

    it('con la suscripción vencida: suscripcion.vencida, y no se consume', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      await prueba.pool.query(
        'UPDATE suscripciones SET hasta = NOW(3) - INTERVAL 1 DAY WHERE tenant_id = ?',
        [a.cuenta.id],
      );
      await rechazado(a.dispositivoPrincipal, qr.texto, 'suscripcion.vencida');
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT usado_at FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      expect(filas[0]?.usado_at).toBeNull();
    });

    it('con el emisor desactivado deja de abrir (RF-06): qr.anulado', async () => {
      const otro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'BA01', [a.rolUsuarioId]);
      const qr = await crearQr(prueba.pool, a.cuenta, otro.id, [a.puertaPrincipal.id]);
      await prueba.pool.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [otro.id]);
      await rechazado(a.dispositivoPrincipal, qr.texto, 'qr.anulado');
    });
  });

  it('todo intento queda en eventos_acceso: ninguna respuesta se pierde', async () => {
    const vigente = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const intentos = [vigente.texto, vigente.texto, 'basura', `AQ1.${'B'.repeat(22)}`];
    const respuestas = [];
    for (const texto of intentos)
      respuestas.push((await validar(a.dispositivoPrincipal, texto)).json<Validacion>());
    const registrados = await eventos();
    expect(registrados).toHaveLength(intentos.length);
    expect(registrados.map((e) => String(e.id))).toEqual(respuestas.map((r) => r.evento_id));
    expect(registrados.map((e) => e.motivo_code)).toEqual([
      'acceso.permitido',
      'qr.usado',
      'qr.formato_invalido',
      'qr.desconocido',
    ]);
  });

  it('eventos_acceso es de solo inserción para la API: no hay ruta que lo cambie', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    await validar(a.dispositivoPrincipal, qr.texto);
    const antes = await eventos();
    for (const metodo of ['PUT', 'PATCH', 'DELETE'] as const) {
      const respuesta = await prueba.app.inject({
        method: metodo,
        url: `/api/v1/eventos-acceso/${antes[0]?.id}`,
        headers: { authorization: a.dispositivoPrincipal.encabezado },
      });
      expect(respuesta.statusCode).toBe(404);
    }
    expect(await eventos()).toEqual(antes);
  });

  describe('credencial del dispositivo (invariante 5)', () => {
    it('sin credencial, con clave equivocada o con un usuario: 401, sin evento', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const casos: (string | undefined)[] = [
        undefined,
        `Dispositivo ${a.dispositivoPrincipal.id}.${'x'.repeat(43)}`,
        `Dispositivo 999999.${a.dispositivoPrincipal.clave}`,
        `Dispositivo ${a.dispositivoPrincipal.id}`,
        `Bearer ${sesion.acceso}`,
      ];
      for (const authorization of casos) {
        const respuesta = await prueba.app.inject({
          method: 'POST',
          url: '/api/v1/dispositivos/validaciones',
          headers: authorization === undefined ? {} : { authorization },
          payload: { token: qr.texto },
        });
        expect(respuesta.statusCode, String(authorization)).toBe(401);
        expect(respuesta.json()).toMatchObject({ code: 'dispositivo.credencial_invalida' });
      }
      expect(await eventos()).toEqual([]);
    });

    it('la clave de un dispositivo de la cuenta B no sirve con el id de uno de la A', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: {
          authorization: `Dispositivo ${a.dispositivoPrincipal.id}.${b.dispositivoPrincipal.clave}`,
        },
        payload: { token: 'x' },
      });
      expect(respuesta.statusCode).toBe(401);
    });

    it('una credencial revocada responde 401 y no abre', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      expect((await validar(a.dispositivoPrincipal, 'basura')).statusCode).toBe(200);
      await prueba.pool.query('UPDATE dispositivos SET revocado_at = NOW(3) WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      const respuesta = await validar(a.dispositivoPrincipal, qr.texto);
      expect(respuesta.statusCode).toBe(401);
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT usado_at FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      expect(filas[0]?.usado_at).toBeNull();
    });

    it('un dispositivo dado de baja o desactivado, o de una cuenta dada de baja, no autentica', async () => {
      await prueba.pool.query('UPDATE dispositivos SET activo = 0 WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      expect((await validar(a.dispositivoPrincipal, 'x')).statusCode).toBe(401);
      await prueba.pool.query('UPDATE dispositivos SET deleted_at = NOW(3) WHERE id = ?', [
        a.dispositivoTrasero.id,
      ]);
      expect((await validar(a.dispositivoTrasero, 'x')).statusCode).toBe(401);
      await prueba.pool.query('UPDATE cuentas SET activo = 0 WHERE id = ?', [b.cuenta.id]);
      expect((await validar(b.dispositivoPrincipal, 'x')).statusCode).toBe(401);
    });

    it('la clave se guarda hasheada con argon2id, nunca en claro', async () => {
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT clave_hash FROM dispositivos',
      );
      for (const fila of filas) expect(String(fila.clave_hash)).toMatch(/^\$argon2id\$/);
      expect(JSON.stringify(filas)).not.toContain(a.dispositivoPrincipal.clave);
    });
  });

  it('la hora del dispositivo es solo informativa: una absurda no rompe nada', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const respuesta = await validar(a.dispositivoPrincipal, qr.texto, {
      leido_en: '1970-01-01T00:00:00Z',
    });
    expect(respuesta.json<Validacion>().abrir).toBe(true);
    const [evento] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT leido_en_dispositivo_at FROM eventos_acceso',
    );
    expect(evento[0]?.leido_en_dispositivo_at).toBeNull();
  });

  describe('GET /api/v1/eventos-acceso', () => {
    async function generarEventos() {
      const delUsuario = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const delAdmin = await crearQr(prueba.pool, a.cuenta, a.administrador.id, [
        a.puertaPrincipal.id,
      ]);
      await validar(a.dispositivoPrincipal, delUsuario.texto);
      await validar(a.dispositivoPrincipal, delAdmin.texto);
      await validar(a.dispositivoPrincipal, 'basura');
      return { delUsuario, delAdmin };
    }

    it('el administrador ve todos los intentos de su cuenta, con el formato del contrato', async () => {
      const { delUsuario } = await generarEventos();
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/eventos-acceso',
        headers: conUsuario(sesion),
      });
      expect(respuesta.statusCode).toBe(200);
      const cuerpo = respuesta.json<{ datos: Record<string, unknown>[]; meta: object }>();
      expect(cuerpo.meta).toEqual({ pagina: 1, por_pagina: 25, total: 3 });
      expect(cuerpo.datos[0]).toEqual({
        id: cualquierTexto(),
        ocurrido_at: fechaIsoUtc(),
        resultado: 'rechazado',
        motivo_code: 'qr.formato_invalido',
        puerta: {
          id: a.puertaPrincipal.id,
          nombre: 'Principal AAA',
          sitio: { id: a.sitioId, nombre: 'Sitio AAA' },
        },
        qr_id: null,
        qr: null,
      });
      expect(cuerpo.datos.at(-1)).toMatchObject({
        resultado: 'permitido',
        motivo_code: 'acceso.permitido',
        qr_id: delUsuario.id,
        qr: {
          id: delUsuario.id,
          etiqueta: null,
          emisor: { id: a.usuario.id, etiqueta: `Usuario ${a.usuario.pin}` },
        },
      });
    });

    it('un usuario ve solo los eventos de los QR que emitió', async () => {
      const { delUsuario } = await generarEventos();
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/eventos-acceso',
        headers: conUsuario(sesion),
      });
      const cuerpo = respuesta.json<{
        datos: { qr_id: string | null }[];
        meta: { total: number };
      }>();
      expect(cuerpo.meta.total).toBe(1);
      expect(cuerpo.datos.map((e) => e.qr_id)).toEqual([delUsuario.id]);
    });

    it('aislamiento: la cuenta A no ve los eventos de la B', async () => {
      await generarEventos();
      const deB = await crearQr(prueba.pool, b.cuenta, b.administrador.id, [b.puertaPrincipal.id]);
      await validar(b.dispositivoPrincipal, deB.texto);

      const sesionA = await iniciarSesion(prueba.app, a.administrador.pin);
      const sesionB = await iniciarSesion(prueba.app, b.administrador.pin);
      const deA = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/eventos-acceso',
        headers: conUsuario(sesionA),
      });
      const paraB = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/eventos-acceso',
        headers: conUsuario(sesionB),
      });
      expect(deA.json<{ meta: { total: number } }>().meta.total).toBe(3);
      expect(paraB.json<{ meta: { total: number } }>().meta.total).toBe(1);
      expect(deA.body).not.toContain(b.puertaPrincipal.nombre);
    });

    it('filtra por resultado, puerta y ventana de tiempo', async () => {
      await generarEventos();
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const listar = (consulta: string) =>
        prueba.app.inject({
          method: 'GET',
          url: `/api/v1/eventos-acceso?${consulta}`,
          headers: conUsuario(sesion),
        });
      const total = async (consulta: string) =>
        (await listar(consulta)).json<{ meta: { total: number } }>().meta.total;
      expect(await total('resultado=permitido')).toBe(2);
      expect(await total('resultado=rechazado')).toBe(1);
      expect(await total(`puerta_id=${a.puertaTrasera.id}`)).toBe(0);
      const manana = new Date(Date.now() + 86_400_000).toISOString();
      const ayer = new Date(Date.now() - 86_400_000).toISOString();
      expect(await total(`desde=${ayer}&hasta=${manana}`)).toBe(3);
      expect(await total(`desde=${manana}`)).toBe(0);
      expect(await total(`hasta=${ayer}`)).toBe(0);
      expect((await listar('resultado=otro')).statusCode).toBe(400);
      expect((await listar('desde=ayer')).statusCode).toBe(400);
    });

    it('GET /eventos-acceso/resumen cuenta permitidos y rechazados por motivo, con el alcance del rol', async () => {
      await generarEventos();
      const resumir = async (pin: string) =>
        prueba.app.inject({
          method: 'GET',
          url: '/api/v1/eventos-acceso/resumen',
          headers: conUsuario(await iniciarSesion(prueba.app, pin)),
        });
      const admin = await resumir(a.administrador.pin);
      expect(admin.statusCode).toBe(200);
      expect(admin.json()).toEqual({
        permitidos: 2,
        rechazados: 1,
        rechazados_por_motivo: [{ motivo_code: 'qr.formato_invalido', total: 1 }],
      });
      expect((await resumir(a.usuario.pin)).json()).toEqual({
        permitidos: 1,
        rechazados: 0,
        rechazados_por_motivo: [],
      });
      expect((await resumir(b.administrador.pin)).json()).toMatchObject({
        permitidos: 0,
        rechazados: 0,
      });
    });

    it('pagina y exige el permiso accesos.evento.ver', async () => {
      await generarEventos();
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const pagina = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/eventos-acceso?por_pagina=2&pagina=2',
        headers: conUsuario(sesion),
      });
      expect(pagina.json<{ datos: unknown[]; meta: object }>()).toMatchObject({
        datos: [expect.anything()] as unknown[],
        meta: { pagina: 2, por_pagina: 2, total: 3 },
      });
      await prueba.pool.query(
        'DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo = ?',
        ['accesos.evento.ver'],
      );
      const sinPermiso = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/eventos-acceso',
        headers: conUsuario(sesion),
      });
      expect(sinPermiso.statusCode).toBe(403);
    });
  });
});
