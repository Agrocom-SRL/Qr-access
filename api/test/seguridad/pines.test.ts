import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

const BASE = '/api/v1/plataforma';

interface CuentaCreadaDto {
  cuenta: { id: string };
  administrador: { id: string; pin: string };
}

describe('plataforma: código de la cuenta y PIN de los administradores (ADR 0023)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };
  let plan: string;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    const [filas] = await prueba.pool.query<RowDataPacket[]>('SELECT id FROM planes LIMIT 1');
    plan = String(filas[0]?.id);
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const alta = async (codigo: string): Promise<CuentaCreadaDto> => {
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: `${BASE}/cuentas`,
      headers,
      payload: {
        razon_social: `Empresa ${codigo}`,
        codigo,
        nit: '1020304050',
        ciudad: 'Montero',
        contacto_nombre: 'Luis',
        contacto_apellido: 'Pérez',
        contacto_telefono: '3 922 0011',
        plan_id: plan,
        inicio: '2026-10-12',
        administrador_nombre: `Admin ${codigo}`,
        pago: { monto: 12_000, fecha_pago: '2026-10-12', medio: 'efectivo', referencia: 'R-1' },
      },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    return respuesta.json<CuentaCreadaDto>();
  };
  const ingresar = (pin: string) =>
    prueba.app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { pin } });
  const cambiarCodigo = (cuentaId: string, codigo: string) =>
    prueba.app.inject({
      method: 'PUT',
      url: `${BASE}/cuentas/${cuentaId}/codigo`,
      headers,
      payload: { codigo },
    });

  describe('cambiar el código de la cuenta', () => {
    it('cambia las 3 primeras letras del PIN de todos sus usuarios y deja el sufijo', async () => {
      const { cuenta, administrador } = await alta('AGR');
      const sufijo = administrador.pin.slice(3);
      expect((await ingresar(administrador.pin)).statusCode).toBe(200);

      const respuesta = await cambiarCodigo(cuenta.id, 'xyz');
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json()).toEqual({ codigo: 'XYZ' });

      expect((await ingresar(`XYZ${sufijo}`)).statusCode).toBe(200);
      const viejo = await ingresar(administrador.pin);
      expect(viejo.statusCode).toBe(401);
      expect(viejo.json<Problema>().code).toBe('sesion.credenciales_invalidas');
    });

    it('también cambia el de los usuarios que creó el administrador, sin que nadie reciba un PIN', async () => {
      const { cuenta, administrador } = await alta('AGR');
      const sesion = await iniciarSesion(prueba.app, administrador.pin);
      const roles = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/roles',
        headers: conUsuario(sesion),
      });
      const rolId = roles
        .json<{ datos: { id: string; nombre: string }[] }>()
        .datos.find((r) => r.nombre === 'Usuario')?.id;
      const usuario = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/usuarios',
        headers: conUsuario(sesion),
        payload: { etiqueta: 'Portería', rol_ids: [rolId] },
      });
      const pin = usuario.json<{ pin: string }>().pin;
      await cambiarCodigo(cuenta.id, 'XYZ');
      expect((await ingresar(`XYZ${pin.slice(3)}`)).statusCode).toBe(200);
    });

    it('las sesiones abiertas siguen funcionando y el código viejo queda libre', async () => {
      const { cuenta, administrador } = await alta('AGR');
      const sesion = await iniciarSesion(prueba.app, administrador.pin);
      await cambiarCodigo(cuenta.id, 'XYZ');
      const actual = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesion),
      });
      expect(actual.statusCode).toBe(200);
      expect(actual.json<{ cuenta: { codigo: string } }>().cuenta.codigo).toBe('XYZ');
      await alta('AGR');
    });

    it('rechaza un código en uso, inválido, igual al actual o de una cuenta inexistente', async () => {
      const a = await alta('AAA');
      await alta('BBB');
      const repetido = await cambiarCodigo(a.cuenta.id, 'BBB');
      expect(repetido.statusCode).toBe(409);
      expect(repetido.json()).toMatchObject({
        code: 'cuenta.codigo_existente',
        cuenta: 'Empresa BBB',
      });
      expect((await cambiarCodigo(a.cuenta.id, 'B1B')).json<Problema>().code).toBe(
        'cuenta.codigo_invalido',
      );
      expect((await cambiarCodigo(a.cuenta.id, 'aaa')).json<Problema>().code).toBe(
        'cuenta.codigo_sin_cambio',
      );
      expect((await cambiarCodigo('999999', 'CCC')).statusCode).toBe(404);
    });

    it('deja la bitácora del cambio con el código anterior y el nuevo', async () => {
      const { cuenta } = await alta('AGR');
      await cambiarCodigo(cuenta.id, 'XYZ');
      const bitacora = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/bitacora`,
        headers,
        query: { cuenta_id: cuenta.id },
      });
      const evento = bitacora
        .json<{ datos: { codigo: string; antes: unknown; despues: unknown }[] }>()
        .datos.find((e) => e.codigo === 'cuenta.codigo_cambiado');
      expect(evento).toMatchObject({ antes: { codigo: 'AGR' }, despues: { codigo: 'XYZ' } });
    });

    it('un usuario de una cuenta no puede cambiar códigos', async () => {
      const escenario = await crearEscenario(prueba.pool, 'ZZZ');
      const sesion = await iniciarSesion(prueba.app, escenario.administrador.pin);
      const respuesta = await prueba.app.inject({
        method: 'PUT',
        url: `${BASE}/cuentas/${escenario.cuenta.id}/codigo`,
        headers: conUsuario(sesion),
        payload: { codigo: 'QQQ' },
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('regenerar el PIN de un administrador', () => {
    const regenerar = (cuentaId: string, usuarioId: string) =>
      prueba.app.inject({
        method: 'POST',
        url: `${BASE}/cuentas/${cuentaId}/administradores/${usuarioId}/pin`,
        headers,
      });

    it('lista a los administradores de la cuenta', async () => {
      const { cuenta, administrador } = await alta('AGR');
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${BASE}/cuentas/${cuenta.id}/administradores`,
        headers,
      });
      expect(respuesta.json()).toMatchObject({
        datos: [{ id: administrador.id, etiqueta: 'Admin AGR', ultimo_ingreso_at: null }],
      });
    });

    it('sortea un PIN nuevo con el código vigente, invalida el anterior y corta sus sesiones', async () => {
      const { cuenta, administrador } = await alta('AGR');
      const sesion = await iniciarSesion(prueba.app, administrador.pin);
      await cambiarCodigo(cuenta.id, 'XYZ');
      const respuesta = await regenerar(cuenta.id, administrador.id);
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      const { pin } = respuesta.json<{ pin: string }>();
      expect(pin).toMatch(/^XYZ[A-Z0-9]{4}$/);
      expect(pin).not.toBe(`XYZ${administrador.pin.slice(3)}`);

      expect((await ingresar(pin)).statusCode).toBe(200);
      expect((await ingresar(`XYZ${administrador.pin.slice(3)}`)).statusCode).toBe(401);
      const conSesionVieja = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/sesiones/actual',
        headers: conUsuario(sesion),
      });
      expect(conSesionVieja.statusCode).toBe(401);
    });

    it('el PIN nuevo no queda en la bitácora ni en texto en la base', async () => {
      const { cuenta, administrador } = await alta('AGR');
      const { pin } = (await regenerar(cuenta.id, administrador.id)).json<{ pin: string }>();
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT pin_hash, pin_indice FROM usuarios WHERE id = ?',
        [administrador.id],
      );
      expect(JSON.stringify(filas)).not.toContain(pin.slice(3));
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT despues FROM bitacoras WHERE tabla = ? AND registro_id = ?',
        ['usuarios', administrador.id],
      );
      expect(JSON.stringify(bitacora)).not.toContain(pin.slice(3));
    });

    it('solo vale para administradores de ESA cuenta: un usuario común o de otra cuenta da 404', async () => {
      const a = await alta('AAA');
      const b = await alta('BBB');
      const escenario = await crearEscenario(prueba.pool, 'CCC');
      for (const [cuentaId, usuarioId] of [
        [a.cuenta.id, b.administrador.id],
        [b.cuenta.id, a.administrador.id],
        [escenario.cuenta.id, escenario.usuario.id],
      ] as const) {
        const respuesta = await regenerar(cuentaId, usuarioId);
        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
      }
      expect((await regenerar('999999', a.administrador.id)).statusCode).toBe(404);
    });

    it('un administrador de cuenta no puede regenerar PIN por esta ruta', async () => {
      const { cuenta, administrador } = await alta('AGR');
      const sesion = await iniciarSesion(prueba.app, administrador.pin);
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: `${BASE}/cuentas/${cuenta.id}/administradores/${administrador.id}/pin`,
        headers: conUsuario(sesion),
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });
});
