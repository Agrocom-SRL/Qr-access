import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositorioDeEventos } from '../../src/modules/accesos/repository.js';
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

interface Validacion {
  abrir: boolean;
  segundos?: number;
  evento_id: string;
  motivo_code: string;
}

interface EventoFila extends RowDataPacket {
  id: string;
  tenant_id: string;
  dispositivo_id: string;
  resultado: string;
  motivo_code: string;
  repetido_de_id: string | null;
  ocurrido_at: Date;
}

/** Ventana de repetición y registro sin ruido (ADR 0032 §3 y §4). */
describe('ventana de repetición de 15 s en POST /api/v1/dispositivos/validaciones', () => {
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

  const validar = async (dispositivo: DispositivoDePrueba, texto: string): Promise<Validacion> => {
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: dispositivo.encabezado },
      payload: { token: texto },
    });
    expect(respuesta.statusCode).toBe(200);
    return respuesta.json<Validacion>();
  };

  async function eventos(): Promise<EventoFila[]> {
    const [filas] = await prueba.pool.query<EventoFila[]>(
      'SELECT * FROM eventos_acceso ORDER BY id',
    );
    return filas;
  }

  async function usadoAt(qrId: string): Promise<Date | null> {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT usado_at FROM qr_accesos WHERE id = ?',
      [qrId],
    );
    return (filas[0]?.usado_at as Date | null) ?? null;
  }

  /** Envejece los eventos ya escritos: el reloj de la prueba no espera 15 s de verdad. */
  const envejecer = (segundos: number) =>
    prueba.pool.query('UPDATE eventos_acceso SET ocurrido_at = ocurrido_at - INTERVAL ? SECOND', [
      segundos,
    ]);

  const qrDeLasDosPuertas = () =>
    crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id, a.puertaTrasera.id]);

  it('la relectura del mismo lector dentro de la ventana vuelve a abrir sin consumir otra vez y se enlaza al original', async () => {
    const qr = await qrDeLasDosPuertas();
    const primera = await validar(a.dispositivoPrincipal, qr.texto);
    const consumo = await usadoAt(qr.id);
    const segunda = await validar(a.dispositivoPrincipal, qr.texto);

    expect(primera).toMatchObject({ abrir: true, segundos: 6, motivo_code: 'acceso.permitido' });
    expect(segunda).toMatchObject({ abrir: true, segundos: 6, motivo_code: 'acceso.permitido' });
    expect(segunda.evento_id).not.toBe(primera.evento_id);
    expect(await usadoAt(qr.id)).toEqual(consumo);

    const [original, repetido] = await eventos();
    expect(original?.repetido_de_id).toBeNull();
    expect(String(repetido?.repetido_de_id)).toBe(primera.evento_id);
    expect(repetido).toMatchObject({ resultado: 'permitido', motivo_code: 'acceso.permitido' });
  });

  it('solo se permite UNA repetición por original: la segunda relectura recibe qr.usado', async () => {
    const qr = await qrDeLasDosPuertas();
    const primera = await validar(a.dispositivoPrincipal, qr.texto);
    expect((await validar(a.dispositivoPrincipal, qr.texto)).abrir).toBe(true);
    expect(await validar(a.dispositivoPrincipal, qr.texto)).toMatchObject({
      abrir: false,
      motivo_code: 'qr.usado',
    });
    const filas = await eventos();
    expect(filas.map((e) => [e.resultado, e.repetido_de_id])).toEqual([
      ['permitido', null],
      ['permitido', primera.evento_id],
      ['rechazado', null],
    ]);
  });

  it('pasada la ventana, el QR usado se rechaza con qr.usado', async () => {
    const qr = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, qr.texto);
    await envejecer(16);
    expect(await validar(a.dispositivoPrincipal, qr.texto)).toMatchObject({
      abrir: false,
      motivo_code: 'qr.usado',
    });
    const filas = await eventos();
    expect(filas.at(-1)).toMatchObject({ resultado: 'rechazado', motivo_code: 'qr.usado' });
    expect(filas.at(-1)?.repetido_de_id).toBeNull();
  });

  it('otro dispositivo, aunque sea de la misma puerta autorizada, no recibe la repetición', async () => {
    const qr = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, qr.texto);
    expect(await validar(a.dispositivoTrasero, qr.texto)).toMatchObject({
      abrir: false,
      motivo_code: 'qr.usado',
    });
  });

  it('otro token no hereda la ventana: se consume por su cuenta', async () => {
    const uno = await qrDeLasDosPuertas();
    const otro = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, uno.texto);
    expect(await validar(a.dispositivoPrincipal, otro.texto)).toMatchObject({ abrir: true });
    expect(await usadoAt(otro.id)).toBeInstanceOf(Date);
    const filas = await eventos();
    expect(filas.map((e) => e.repetido_de_id)).toEqual([null, null]);
  });

  it('un QR anulado dentro de la ventana no se repite: qr.anulado', async () => {
    const qr = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, qr.texto);
    await prueba.pool.query('UPDATE qr_accesos SET anulado_at = NOW(3) WHERE id = ?', [qr.id]);
    expect(await validar(a.dispositivoPrincipal, qr.texto)).toMatchObject({
      abrir: false,
      motivo_code: 'qr.anulado',
    });
  });

  it('un QR vencido dentro de la ventana no se repite: qr.vencido', async () => {
    const qr = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, qr.texto);
    await prueba.pool.query(
      'UPDATE qr_accesos SET vence_at = NOW(3) - INTERVAL 1 SECOND WHERE id = ?',
      [qr.id],
    );
    expect(await validar(a.dispositivoPrincipal, qr.texto)).toMatchObject({
      abrir: false,
      motivo_code: 'qr.vencido',
    });
  });

  it('con la suscripción vencida o el generador suspendido, la ventana tampoco abre', async () => {
    const otro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'BA01', [a.rolMiembroId]);
    const qr = await crearQr(prueba.pool, a.cuenta, otro.id, [a.puertaPrincipal.id]);
    await validar(a.dispositivoPrincipal, qr.texto);
    await prueba.pool.query(
      "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
      [otro.id],
    );
    expect(await validar(a.dispositivoPrincipal, qr.texto)).toMatchObject({
      abrir: false,
      motivo_code: 'qr.generador_suspendido',
    });
  });

  it('un QR de otra puerta no se repite en un lector que no es de su puerta', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    await validar(a.dispositivoPrincipal, qr.texto);
    expect(await validar(a.dispositivoTrasero, qr.texto)).toMatchObject({
      abrir: false,
      motivo_code: 'qr.otra_puerta',
    });
  });

  it('aislamiento: el lector de otra cuenta no recibe la repetición ni se enlaza a eventos ajenos', async () => {
    const qr = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, qr.texto);
    expect(await validar(b.dispositivoPrincipal, qr.texto)).toMatchObject({
      abrir: false,
      motivo_code: 'qr.desconocido',
    });
    const deB = (await eventos()).filter((e) => e.tenant_id === b.cuenta.id);
    expect(deB).toHaveLength(1);
    expect(deB[0]?.repetido_de_id).toBeNull();
    // Y el rechazo de B repetido se enlaza solo con rechazos de B.
    await validar(b.dispositivoPrincipal, qr.texto);
    const [primeroB, segundoB] = (await eventos()).filter((e) => e.tenant_id === b.cuenta.id);
    expect(String(segundoB?.repetido_de_id)).toBe(String(primeroB?.id));
  });

  it('relecturas concurrentes del mismo lector: un solo consumo, a lo sumo una repetición abre y el resto qr.usado', async () => {
    const qr = await qrDeLasDosPuertas();
    const respuestas = await Promise.all(
      Array.from({ length: 6 }, () => validar(a.dispositivoPrincipal, qr.texto)),
    );
    const filas = await eventos();
    expect(filas).toHaveLength(6);
    const permitidas = filas.filter((e) => e.resultado === 'permitido');
    const originales = permitidas.filter((e) => e.repetido_de_id === null);
    const repetidas = permitidas.filter((e) => e.repetido_de_id !== null);
    // Un solo consumo => un solo original; como máximo UNA repetición abre (ADR 0032 §3).
    expect(originales).toHaveLength(1);
    expect(repetidas.length).toBeLessThanOrEqual(1);
    expect(repetidas.every((e) => String(e.repetido_de_id) === String(originales[0]?.id))).toBe(
      true,
    );
    expect(respuestas.filter((r) => r.abrir)).toHaveLength(1 + repetidas.length);
    expect(
      respuestas.filter((r) => !r.abrir).every((r) => r.motivo_code === 'qr.usado'),
    ).toBe(true);
    expect(await usadoAt(qr.id)).toBeInstanceOf(Date);
  });

  it('si falla buscar el original de un rechazo, el rechazo se registra igual sin enlace', async () => {
    const espia = vi
      .spyOn(RepositorioDeEventos.prototype, 'buscarOriginal')
      .mockRejectedValueOnce(new Error('fallo simulado'));
    try {
      const respuesta = await validar(a.dispositivoPrincipal, 'basura');
      expect(respuesta).toMatchObject({ abrir: false, motivo_code: 'qr.formato_invalido' });
    } finally {
      espia.mockRestore();
    }
    const filas = await eventos();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ resultado: 'rechazado', repetido_de_id: null });
  });

  it('un rechazo idéntico (mismo lector, token y motivo) dentro de 60 s se inserta enlazado al primero', async () => {
    const qr = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, qr.texto);
    await validar(a.dispositivoTrasero, qr.texto); // qr.usado (1.º)
    await validar(a.dispositivoTrasero, qr.texto); // qr.usado repetido
    await validar(a.dispositivoTrasero, 'basura'); // otro motivo y otro hash: nuevo
    const filas = await eventos();
    expect(filas.map((e) => e.motivo_code)).toEqual([
      'acceso.permitido',
      'qr.usado',
      'qr.usado',
      'qr.formato_invalido',
    ]);
    expect(filas.map((e) => e.repetido_de_id)).toEqual([null, null, filas[1]?.id, null]);

    // Pasados 60 s ya es un intento nuevo.
    await envejecer(61);
    await validar(a.dispositivoTrasero, qr.texto);
    expect((await eventos()).at(-1)?.repetido_de_id).toBeNull();
  });

  it('nunca se actualiza una fila: los eventos previos quedan idénticos tras repetir', async () => {
    const qr = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, qr.texto);
    const antes = await eventos();
    await validar(a.dispositivoPrincipal, qr.texto);
    await validar(a.dispositivoTrasero, qr.texto);
    expect((await eventos()).slice(0, antes.length)).toEqual(antes);
  });

  it('el listado y el resumen muestran solo el original, con las repeticiones contadas y distinguidas', async () => {
    const qr = await qrDeLasDosPuertas();
    await validar(a.dispositivoPrincipal, qr.texto); // permitido
    await validar(a.dispositivoPrincipal, qr.texto); // repetición permitida
    await validar(a.dispositivoTrasero, qr.texto); // qr.usado
    await validar(a.dispositivoTrasero, qr.texto); // repetición rechazada
    const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
    const listado = (
      await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/eventos-acceso',
        headers: conUsuario(sesion),
      })
    ).json<{
      datos: {
        motivo_code: string;
        repeticiones: number;
        repeticiones_permitidas: number;
        repeticiones_rechazadas: number;
      }[];
      meta: { total: number };
    }>();
    expect(listado.meta.total).toBe(2);
    expect(
      listado.datos
        .map((e) => [
          e.motivo_code,
          e.repeticiones,
          e.repeticiones_permitidas,
          e.repeticiones_rechazadas,
        ])
        .sort(),
    ).toEqual([
      ['acceso.permitido', 1, 1, 0],
      ['qr.usado', 1, 0, 1],
    ]);
    const resumen = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/eventos-acceso/resumen',
      headers: conUsuario(sesion),
    });
    expect(resumen.json()).toEqual({
      permitidos: 1,
      rechazados: 1,
      rechazados_por_motivo: [{ motivo_code: 'qr.usado', total: 1 }],
      repeticiones_permitidas: 1,
      repeticiones_rechazadas: 1,
    });
    // Ninguna fila desaparece (invariante 4).
    expect(await eventos()).toHaveLength(4);
  });
});
