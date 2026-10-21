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
import { conUsuario, iniciarSesion, type Sesion } from '../helpers/http.js';
import { cualquierTexto } from '../helpers/esperados.js';

interface EstadoDeQr {
  id: string;
  estado: string;
  vence_at: string;
  ultimo_intento: {
    ocurrido_at: string;
    resultado: string;
    motivo_code: string;
    puerta: { id: string; nombre: string };
  } | null;
}

describe('GET /api/v1/qr-accesos/{id}/estado', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesionAdminA: Sesion;
  let sesionUsuarioA: Sesion;
  let sesionAdminB: Sesion;

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
    sesionAdminA = await iniciarSesion(prueba.app, a.administrador.pin);
    sesionUsuarioA = await iniciarSesion(prueba.app, a.usuario.pin);
    sesionAdminB = await iniciarSesion(prueba.app, b.administrador.pin);
  });

  const estado = (sesion: Sesion, id: string) =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/qr-accesos/${id}/estado`,
      headers: conUsuario(sesion),
    });
  const leer = (dispositivo: DispositivoDePrueba, token: string) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/dispositivos/validaciones',
      headers: { authorization: dispositivo.encabezado },
      payload: { token, leido_en: new Date().toISOString() },
    });

  it('un QR que nadie leyó está vigente y sin intentos', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    const respuesta = await estado(sesionUsuarioA, qr.id);
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<EstadoDeQr>()).toEqual({
      id: qr.id,
      estado: 'vigente',
      vence_at: cualquierTexto(),
      ultimo_intento: null,
    });
  });

  it('tras abrir la puerta queda usado, con el intento permitido y la puerta', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    await leer(a.dispositivoPrincipal, qr.texto);
    const cuerpo = (await estado(sesionUsuarioA, qr.id)).json<EstadoDeQr>();
    expect(cuerpo.estado).toBe('usado');
    expect(cuerpo.ultimo_intento).toMatchObject({
      resultado: 'permitido',
      motivo_code: 'acceso.permitido',
      puerta: { id: a.puertaPrincipal.id, nombre: a.puertaPrincipal.nombre },
    });
  });

  it('un rechazo en otra puerta deja el QR vigente y explica el motivo', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    await leer(a.dispositivoTrasero, qr.texto);
    const cuerpo = (await estado(sesionUsuarioA, qr.id)).json<EstadoDeQr>();
    expect(cuerpo.estado).toBe('vigente');
    expect(cuerpo.ultimo_intento).toMatchObject({
      resultado: 'rechazado',
      motivo_code: 'qr.otra_puerta',
    });
  });

  it('un segundo intento sobre un QR usado devuelve el último: qr.usado', async () => {
    const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
    await leer(a.dispositivoPrincipal, qr.texto);
    await leer(a.dispositivoPrincipal, qr.texto);
    const cuerpo = (await estado(sesionUsuarioA, qr.id)).json<EstadoDeQr>();
    expect(cuerpo.ultimo_intento).toMatchObject({
      resultado: 'rechazado',
      motivo_code: 'qr.usado',
    });
  });

  it('un QR vencido o anulado se refleja en el estado', async () => {
    const vencido = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
      venceAt: new Date(Date.now() - 60_000),
    });
    const anulado = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id], {
      anuladoAt: new Date(),
    });
    expect((await estado(sesionUsuarioA, vencido.id)).json<EstadoDeQr>().estado).toBe('vencido');
    expect((await estado(sesionUsuarioA, anulado.id)).json<EstadoDeQr>().estado).toBe('anulado');
  });

  it('un usuario no ve el de otro; un administrador (ver_todos) sí', async () => {
    const otro = await crearUsuarioConPin(prueba.pool, a.cuenta, 'OT01', [a.rolMiembroId]);
    const delOtro = await crearQr(prueba.pool, a.cuenta, otro.id, [a.puertaPrincipal.id]);
    expect((await estado(sesionUsuarioA, delOtro.id)).statusCode).toBe(404);
    expect((await estado(sesionAdminA, delOtro.id)).statusCode).toBe(200);
  });

  it('aislamiento: el QR de otra cuenta es un 404', async () => {
    const deB = await crearQr(prueba.pool, b.cuenta, b.administrador.id, [b.puertaPrincipal.id]);
    const respuesta = await estado(sesionAdminA, deB.id);
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json()).toMatchObject({ code: 'qr.no_encontrado' });
    expect((await estado(sesionAdminB, deB.id)).statusCode).toBe(200);
  });

  it('un id mal formado es una validación inválida', async () => {
    expect((await estado(sesionUsuarioA, 'abc')).statusCode).toBe(400);
  });
});
