import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { cualquierTexto } from '../helpers/esperados.js';
import {
  contarFilas,
  crearEscenario,
  crearSuperAdmin,
  type Escenario,
  type SuperAdminDePrueba,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

interface Limite {
  clave: string;
  valor: number | null;
  minimo: number;
  maximo: number;
  excepcion: string;
}

interface Excepcion {
  id: string;
  clave: string;
  usuario_id: string | null;
  valor: number;
}

describe('plataforma: configuración de los topes de generación y sus excepciones (ADR 0030 §7)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let agrocom: { authorization: string };
  let admin: SuperAdminDePrueba;

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
    admin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    agrocom = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', admin.contrasena),
    );
  });

  const pedir = (method: 'GET' | 'PUT' | 'DELETE' | 'PATCH', url: string, payload?: object) =>
    prueba.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: agrocom,
      ...(payload === undefined ? {} : { payload }),
    });
  const excepciones = async (cuentaId: string) =>
    (await pedir('GET', `/plataforma/cuentas/${cuentaId}/excepciones-de-limite`)).json<{
      datos: Excepcion[];
    }>().datos;
  const generar = async (pin: string, puertas: string[]) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/qr-accesos',
      headers: conUsuario(await iniciarSesion(prueba.app, pin)),
      payload: { puerta_ids: puertas },
    });

  describe('valores generales', () => {
    it('lista los siete topes con su valor inicial sembrado y sus extremos', async () => {
      const respuesta = await pedir('GET', '/plataforma/limites');
      expect(respuesta.statusCode).toBe(200);
      const datos = respuesta.json<{ datos: Limite[] }>().datos;
      expect(datos.map((limite) => [limite.clave, limite.valor])).toEqual([
        ['qr.tope_diario', 100],
        ['qr.tope_pendientes', 50],
        ['qr.reemplazos_sin_uso_por_dia', 5],
        ['qr.espera_reemplazo_segundos', 120],
        ['qr.max_puertas_por_qr', 10],
        ['qr.bolsa_mensual', 5000],
        ['qr.bolsa_aviso_porcentaje', 80],
      ]);
      expect(datos.find((limite) => limite.clave === 'qr.bolsa_mensual')).toMatchObject({
        excepcion: 'cuenta',
        minimo: 1,
      });
    });

    it('cambiar un tope vale de inmediato para las generaciones y queda en la bitácora con antes y después', async () => {
      expect((await generar(a.usuario.pin, [a.puertaPrincipal.id])).statusCode).toBe(201);
      const cambio = await pedir('PUT', '/plataforma/limites/qr.tope_diario', { valor: 1 });
      expect(cambio.statusCode).toBe(204);
      expect((await generar(a.usuario.pin, [a.puertaPrincipal.id])).json<Problema>().code).toBe(
        'qr.limite_diario',
      );

      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT * FROM bitacoras WHERE tabla = 'configuracion_limites' AND accion = 'actualizado'",
      );
      expect(filas).toHaveLength(1);
      expect(filas[0]?.tenant_id).toBeNull();
      expect(JSON.stringify(filas[0]?.antes)).toContain('100');
      expect(JSON.stringify(filas[0]?.despues)).toContain('1');
      // La bitácora firma con el super admin que lo cambió
      expect(String(filas[0]?.usuario_id)).toBe(admin.id);
    });

    it('rechaza una clave que no existe y un valor fuera de los extremos', async () => {
      const inexistente = await pedir('PUT', '/plataforma/limites/qr.inventado', { valor: 3 });
      expect(inexistente.statusCode).toBe(404);
      expect(inexistente.json<Problema>().code).toBe('limite.no_encontrado');
      for (const [clave, valor] of [
        ['qr.tope_diario', 0],
        ['qr.bolsa_aviso_porcentaje', 101],
        ['qr.espera_reemplazo_segundos', 90_000],
      ] as const) {
        const rechazo = await pedir('PUT', `/plataforma/limites/${clave}`, { valor });
        expect(rechazo.statusCode, clave).toBe(422);
        expect(rechazo.json<Problema>().code).toBe('limite.valor_invalido');
      }
      const textual = await pedir('PUT', '/plataforma/limites/qr.tope_diario', { valor: '5' });
      expect(textual.statusCode).toBe(400);
    });

    it('el mismo valor no escribe nada en la bitácora', async () => {
      await pedir('PUT', '/plataforma/limites/qr.tope_diario', { valor: 100 });
      expect(await contarFilas(prueba.pool, 'bitacoras', "tabla = 'configuracion_limites'")).toBe(
        0,
      );
    });

    it('un usuario de una cuenta no ve ni cambia la configuración de la plataforma', async () => {
      const usuario = conUsuario(await iniciarSesion(prueba.app, a.administrador.pin));
      for (const intento of [
        prueba.app.inject({ method: 'GET', url: '/api/v1/plataforma/limites', headers: usuario }),
        prueba.app.inject({
          method: 'PUT',
          url: '/api/v1/plataforma/limites/qr.tope_diario',
          headers: usuario,
          payload: { valor: 1 },
        }),
      ]) {
        const respuesta = await intento;
        expect([401, 403]).toContain(respuesta.statusCode);
      }
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT valor FROM configuracion_limites WHERE clave = 'qr.tope_diario'",
      );
      expect(filas[0]?.valor).toBe(100);
    });

    it('sin sesión es 401', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/plataforma/limites',
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('excepciones por cuenta y por usuario', () => {
    const ruta = (cuentaId: string) => `/plataforma/cuentas/${cuentaId}/excepciones-de-limite`;

    it('la de un usuario sube su tope sin tocar a los demás, y quitarla lo devuelve al general', async () => {
      await pedir('PUT', '/plataforma/limites/qr.tope_diario', { valor: 1 });
      const fijada = await pedir('PUT', ruta(a.cuenta.id), {
        clave: 'qr.tope_diario',
        usuario_id: a.usuario.id,
        valor: 3,
      });
      expect(fijada.statusCode, fijada.body).toBe(200);
      const { id } = fijada.json<{ id: string }>();
      for (let i = 0; i < 3; i += 1) {
        expect((await generar(a.usuario.pin, [a.puertaPrincipal.id])).statusCode).toBe(201);
      }
      expect((await generar(a.usuario.pin, [a.puertaPrincipal.id])).statusCode).toBe(429);
      // Otro usuario de la misma cuenta sigue con el general
      expect((await generar(a.administrador.pin, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await generar(a.administrador.pin, [a.puertaPrincipal.id])).statusCode).toBe(429);

      expect(await excepciones(a.cuenta.id)).toEqual([
        {
          id,
          clave: 'qr.tope_diario',
          usuario_id: a.usuario.id,
          valor: 3,
          creada_at: cualquierTexto(),
        },
      ]);
      expect((await pedir('DELETE', `${ruta(a.cuenta.id)}/${id}`)).statusCode).toBe(204);
      expect(await excepciones(a.cuenta.id)).toEqual([]);
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT accion FROM bitacoras WHERE tabla = 'excepciones_de_limite' ORDER BY id",
      );
      expect(bitacora.map((fila: RowDataPacket) => String(fila.accion))).toEqual([
        'creado',
        'eliminado',
      ]);
    });

    it('la del usuario manda sobre la de la cuenta; fijar de nuevo cambia el valor, no duplica', async () => {
      await pedir('PUT', '/plataforma/limites/qr.tope_diario', { valor: 1 });
      await pedir('PUT', ruta(a.cuenta.id), { clave: 'qr.tope_diario', valor: 2 });
      const primera = await pedir('PUT', ruta(a.cuenta.id), {
        clave: 'qr.tope_diario',
        usuario_id: a.usuario.id,
        valor: 1,
      });
      const repetida = await pedir('PUT', ruta(a.cuenta.id), {
        clave: 'qr.tope_diario',
        usuario_id: a.usuario.id,
        valor: 1,
      });
      expect(repetida.json<{ id: string }>().id).toBe(primera.json<{ id: string }>().id);
      expect(await excepciones(a.cuenta.id)).toHaveLength(2);
      // El Miembro tiene 1 (suya), el Administrador 2 (de la cuenta)
      expect((await generar(a.usuario.pin, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await generar(a.usuario.pin, [a.puertaPrincipal.id])).statusCode).toBe(429);
      expect((await generar(a.administrador.pin, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await generar(a.administrador.pin, [a.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await generar(a.administrador.pin, [a.puertaPrincipal.id])).statusCode).toBe(429);
    });

    it('la bolsa solo admite excepción de cuenta; el porcentaje de aviso, ninguna', async () => {
      const deUsuario = await pedir('PUT', ruta(a.cuenta.id), {
        clave: 'qr.bolsa_mensual',
        usuario_id: a.usuario.id,
        valor: 10,
      });
      expect(deUsuario.statusCode).toBe(422);
      expect(deUsuario.json<Problema>().code).toBe('limite.excepcion_no_permitida');
      const global = await pedir('PUT', ruta(a.cuenta.id), {
        clave: 'qr.bolsa_aviso_porcentaje',
        valor: 50,
      });
      expect(global.json<Problema>().code).toBe('limite.excepcion_no_permitida');
      const deCuenta = await pedir('PUT', ruta(a.cuenta.id), {
        clave: 'qr.bolsa_mensual',
        valor: 10,
      });
      expect(deCuenta.statusCode).toBe(200);
    });

    it('valida la clave, el valor, la cuenta y el usuario', async () => {
      const clave = await pedir('PUT', ruta(a.cuenta.id), { clave: 'qr.inventado', valor: 1 });
      expect(clave.json<Problema>().code).toBe('limite.no_encontrado');
      const valor = await pedir('PUT', ruta(a.cuenta.id), { clave: 'qr.tope_diario', valor: 0 });
      expect(valor.json<Problema>().code).toBe('limite.valor_invalido');
      const cuenta = await pedir('PUT', ruta('999999'), { clave: 'qr.tope_diario', valor: 5 });
      expect(cuenta.statusCode).toBe(404);
      expect(cuenta.json<Problema>().code).toBe('cuenta.no_encontrada');
      const listaDeOtra = await pedir('GET', ruta('999999'));
      expect(listaDeOtra.statusCode).toBe(404);
    });

    it('aislamiento: un usuario de otra cuenta no existe, y la excepción de A no se ve ni se borra desde B', async () => {
      const deOtra = await pedir('PUT', ruta(a.cuenta.id), {
        clave: 'qr.tope_diario',
        usuario_id: b.usuario.id,
        valor: 5,
      });
      expect(deOtra.statusCode).toBe(404);
      expect(deOtra.json<Problema>().code).toBe('usuario.no_encontrado');

      const { id } = (
        await pedir('PUT', ruta(a.cuenta.id), { clave: 'qr.tope_diario', valor: 7 })
      ).json<{ id: string }>();
      expect(await excepciones(b.cuenta.id)).toEqual([]);
      const ajena = await pedir('DELETE', `${ruta(b.cuenta.id)}/${id}`);
      expect(ajena.statusCode).toBe(404);
      expect(ajena.json<Problema>().code).toBe('limite.excepcion_no_encontrada');
      expect(await excepciones(a.cuenta.id)).toHaveLength(1);
    });

    it('la excepción de la cuenta A no rige en la cuenta B', async () => {
      await pedir('PUT', '/plataforma/limites/qr.tope_diario', { valor: 1 });
      await pedir('PUT', ruta(a.cuenta.id), { clave: 'qr.tope_diario', valor: 50 });
      expect((await generar(b.usuario.pin, [b.puertaPrincipal.id])).statusCode).toBe(201);
      expect((await generar(b.usuario.pin, [b.puertaPrincipal.id])).statusCode).toBe(429);
    });
  });

  describe('lo que fija cada plan (bolsa mensual y puertas por QR)', () => {
    it('se edita en el plan, se lista y `null` lo devuelve al valor general', async () => {
      const lista = async () =>
        (await pedir('GET', '/plataforma/planes')).json<{
          datos: {
            id: string;
            nombre: string;
            bolsa_qr_mensual: number | null;
            max_puertas_por_qr: number | null;
          }[];
        }>().datos;
      const plan = (await lista()).find((p) => p.nombre === '100 usuarios');
      expect(plan).toMatchObject({ bolsa_qr_mensual: null, max_puertas_por_qr: null });

      const editado = await pedir('PATCH', `/plataforma/planes/${plan?.id ?? ''}`, {
        bolsa_qr_mensual: 800,
        max_puertas_por_qr: 4,
      });
      expect(editado.statusCode, editado.body).toBe(204);
      expect((await lista()).find((p) => p.id === plan?.id)).toMatchObject({
        bolsa_qr_mensual: 800,
        max_puertas_por_qr: 4,
      });
      const devuelto = await pedir('PATCH', `/plataforma/planes/${plan?.id ?? ''}`, {
        bolsa_qr_mensual: null,
      });
      expect(devuelto.statusCode).toBe(204);
      expect((await lista()).find((p) => p.id === plan?.id)).toMatchObject({
        bolsa_qr_mensual: null,
        max_puertas_por_qr: 4,
      });
      const invalido = await pedir('PATCH', `/plataforma/planes/${plan?.id ?? ''}`, {
        bolsa_qr_mensual: 0,
      });
      expect(invalido.statusCode).toBe(400);
    });
  });
});
