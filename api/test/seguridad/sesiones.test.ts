import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FALLOS_POR_IP } from '../../src/modules/seguridad/servicios.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  crearCuenta,
  crearEscenario,
  crearRol,
  crearUsuarioConPin,
  PERMISOS_DE_ADMINISTRADOR,
  PERMISOS_DE_USUARIO,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion } from '../helpers/http.js';
import { cualquierTexto, fechaIsoUtc } from '../helpers/esperados.js';

const RUTA = '/api/v1/sesiones';

describe('sesiones: login por PIN (ADR 0018)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;

  // Una app por test: el límite de intentos vive en memoria y no debe contaminar al siguiente.
  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const ingresar = (pin: string, ip?: string) =>
    prueba.app.inject({
      method: 'POST',
      url: RUTA,
      payload: { pin },
      ...(ip === undefined ? {} : { remoteAddress: ip }),
    });

  it('entra con un PIN válido y entrega la sesión del contrato', async () => {
    const respuesta = await ingresar(a.administrador.pin);
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      acceso: cualquierTexto(),
      refresco: cualquierTexto(),
      usuario: { id: a.administrador.id, etiqueta: `Usuario ${a.administrador.pin}` },
      cuenta: { id: a.cuenta.id, codigo: 'AAA', nombre: 'Cuenta AAA' },
      roles: [{ id: a.rolAdministradorId, nombre: 'Administrador' }],
      rol_activo_id: a.rolAdministradorId,
    });
  });

  it('acepta el PIN en minúsculas y con espacios', async () => {
    const respuesta = await ingresar(` ${a.administrador.pin.toLowerCase()} `);
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json<{ usuario: { id: string } }>().usuario.id).toBe(a.administrador.id);
  });

  it('el PIN de la cuenta A con el sufijo válido de la B se rechaza', async () => {
    const sufijoSoloDeB = 'BX99';
    await crearUsuarioConPin(prueba.pool, b.cuenta, sufijoSoloDeB, [b.rolUsuarioId]);

    const cruzado = await ingresar(`AAA${sufijoSoloDeB}`);
    expect(cruzado.statusCode).toBe(401);
    expect(cruzado.json()).toMatchObject({ code: 'sesion.credenciales_invalidas' });
    expect((await ingresar(`BBB${sufijoSoloDeB}`)).statusCode).toBe(200);
  });

  it('el mismo sufijo en dos cuentas: cada PIN entra solo a la suya', async () => {
    expect(a.administrador.pin.slice(3)).toBe(b.administrador.pin.slice(3));
    const enA = await ingresar(a.administrador.pin);
    const enB = await ingresar(b.administrador.pin);
    expect(enA.json<{ cuenta: { codigo: string } }>().cuenta.codigo).toBe('AAA');
    expect(enB.json<{ cuenta: { codigo: string } }>().cuenta.codigo).toBe('BBB');
  });

  it('cualquier fallo responde exactamente lo mismo: PIN erróneo, cuenta inexistente, formato ilegible, usuario inactivo', async () => {
    await crearUsuarioConPin(prueba.pool, a.cuenta, 'INAC', [a.rolUsuarioId], { activo: false });
    const casos = [
      'AAAZ9Z9',
      'ZZZ1234',
      'no es un pin',
      'AAAINAC',
      'ÑAA1234',
      `${a.administrador.pin}0`,
    ];
    const cuerpos = [];
    for (const [indice, pin] of casos.entries()) {
      const respuesta = await ingresar(pin, `10.1.1.${indice + 1}`);
      expect(respuesta.statusCode).toBe(401);
      cuerpos.push(respuesta.json());
    }
    expect(cuerpos[0]).toMatchObject({ code: 'sesion.credenciales_invalidas' });
    for (const cuerpo of cuerpos) expect(cuerpo).toEqual(cuerpos[0]);
  });

  it('una cuenta dada de baja no entra aunque el PIN sea correcto', async () => {
    await prueba.pool.query('UPDATE cuentas SET activo = 0 WHERE id = ?', [a.cuenta.id]);
    expect((await ingresar(a.administrador.pin)).statusCode).toBe(401);
  });

  it('bloquea tras los fallos permitidos: ni el PIN correcto entra mientras dura el bloqueo', async () => {
    const ip = '10.9.9.9';
    for (let i = 0; i < FALLOS_POR_IP; i += 1) {
      expect((await ingresar('AAA0000', ip)).statusCode).toBe(401);
    }
    const bloqueada = await ingresar('AAA0000', ip);
    expect(bloqueada.statusCode).toBe(429);
    expect(bloqueada.json()).toMatchObject({
      code: 'sesion.bloqueada',
      reintentar_en_segundos: 60,
    });
    expect((await ingresar(a.administrador.pin, ip)).statusCode).toBe(429);
    // Otra IP sigue entrando: el bloqueo es por IP y código de cuenta.
    expect((await ingresar(a.administrador.pin, '10.8.8.8')).statusCode).toBe(200);
  });

  it('un acierto borra los fallos de esa IP', async () => {
    const ip = '10.7.7.7';
    for (let i = 0; i < FALLOS_POR_IP - 1; i += 1) await ingresar('AAA0000', ip);
    expect((await ingresar(a.administrador.pin, ip)).statusCode).toBe(200);
    for (let i = 0; i < FALLOS_POR_IP - 1; i += 1) {
      expect((await ingresar('AAA0000', ip)).statusCode).toBe(401);
    }
  });

  it('un body sin PIN es una validación inválida, no un 500', async () => {
    const respuesta = await prueba.app.inject({ method: 'POST', url: RUTA, payload: {} });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toMatchObject({ code: 'validacion.invalida' });
  });

  describe('roles y rol activo', () => {
    async function usuarioConDosRoles() {
      const rolGuardia = await crearRol(prueba.pool, a.cuenta, 'Guardia', [
        'accesos.evento.ver_todos',
      ]);
      const usuario = await crearUsuarioConPin(prueba.pool, a.cuenta, 'DOS2', [
        a.rolUsuarioId,
        rolGuardia,
      ]);
      return { usuario, rolGuardia };
    }

    it('con varios roles y ninguno preferido, entra sin rol activo y sin permisos', async () => {
      const { usuario, rolGuardia } = await usuarioConDosRoles();
      const sesion = await iniciarSesion(prueba.app, usuario.pin);
      expect(sesion.rol_activo_id).toBeNull();
      const actual = await prueba.app.inject({
        method: 'GET',
        url: `${RUTA}/actual`,
        headers: conUsuario(sesion),
      });
      expect(actual.statusCode).toBe(200);
      expect(actual.json()).toMatchObject({ rol_activo: null, permisos: [] });
      // Al reabrir sin rol activo, la app ofrece elegir entre estos
      const roles = actual.json<{ roles: { id: string }[] }>().roles.map((rol) => rol.id);
      expect(roles.sort()).toEqual([a.rolUsuarioId, rolGuardia].sort());
      const puertas = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/puertas',
        headers: conUsuario(sesion),
      });
      expect(puertas.statusCode).toBe(403);
      expect(puertas.json()).toMatchObject({ code: 'permiso.denegado' });
    });

    it('los permisos son los del rol activo, nunca la unión de sus roles', async () => {
      const { usuario, rolGuardia } = await usuarioConDosRoles();
      const sesion = await iniciarSesion(prueba.app, usuario.pin);

      const comoGuardia = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/rol-activo`,
        headers: conUsuario(sesion),
        payload: { rol_id: rolGuardia },
      });
      expect(comoGuardia.statusCode).toBe(200);
      const tokenGuardia = { acceso: comoGuardia.json<{ acceso: string }>().acceso };
      const actualGuardia = await prueba.app.inject({
        method: 'GET',
        url: `${RUTA}/actual`,
        headers: conUsuario(tokenGuardia),
      });
      expect(actualGuardia.json()).toMatchObject({
        rol_activo: { id: rolGuardia, nombre: 'Guardia' },
        permisos: ['accesos.evento.ver_todos'],
      });
      // El permiso de emitir es del rol Usuario, que NO es el activo
      const emitir = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos',
        headers: conUsuario(tokenGuardia),
        payload: { puerta_ids: [a.puertaPrincipal.id] },
      });
      expect(emitir.statusCode).toBe(403);

      const comoUsuario = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/rol-activo`,
        headers: conUsuario(sesion),
        payload: { rol_id: a.rolUsuarioId },
      });
      const actualUsuario = await prueba.app.inject({
        method: 'GET',
        url: `${RUTA}/actual`,
        headers: conUsuario({ acceso: comoUsuario.json<{ acceso: string }>().acceso }),
      });
      expect(actualUsuario.json<{ permisos: string[] }>().permisos).toEqual(
        [...PERMISOS_DE_USUARIO].sort(),
      );
    });

    it('recuerda el último rol elegido para la próxima sesión', async () => {
      const { usuario, rolGuardia } = await usuarioConDosRoles();
      const primera = await iniciarSesion(prueba.app, usuario.pin);
      await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/rol-activo`,
        headers: conUsuario(primera),
        payload: { rol_id: rolGuardia },
      });
      expect((await iniciarSesion(prueba.app, usuario.pin)).rol_activo_id).toBe(rolGuardia);
    });

    it('un rol que no es del usuario, o de otra cuenta, es un 404', async () => {
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      for (const rolId of [a.rolAdministradorId, b.rolUsuarioId, '99999999']) {
        const respuesta = await prueba.app.inject({
          method: 'POST',
          url: `${RUTA}/rol-activo`,
          headers: conUsuario(sesion),
          payload: { rol_id: rolId },
        });
        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.json()).toMatchObject({ code: 'rol.no_encontrado' });
      }
    });

    it('un rol quitado deja de servir de inmediato, sin esperar a que venza el JWT', async () => {
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const antes = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/puertas',
        headers: conUsuario(sesion),
      });
      expect(antes.statusCode).toBe(200);
      await prueba.pool.query('UPDATE usuario_roles SET deleted_at = NOW(3) WHERE usuario_id = ?', [
        a.administrador.id,
      ]);
      const despues = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/puertas',
        headers: conUsuario(sesion),
      });
      expect(despues.statusCode).toBe(403);
    });
  });

  describe('sesión actual', () => {
    it('devuelve el usuario, la cuenta, el rol activo y sus permisos', async () => {
      const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${RUTA}/actual`,
        headers: conUsuario(sesion),
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toEqual({
        usuario: { id: a.administrador.id, etiqueta: `Usuario ${a.administrador.pin}` },
        cuenta: { id: a.cuenta.id, codigo: 'AAA', nombre: 'Cuenta AAA' },
        roles: [{ id: a.rolAdministradorId, nombre: 'Administrador' }],
        rol_activo: { id: a.rolAdministradorId, nombre: 'Administrador' },
        permisos: [...PERMISOS_DE_ADMINISTRADOR].sort(),
        suscripcion: { plan: 'Plan AAA', hasta: fechaIsoUtc() },
      });
    });

    it('sin token, con basura o con un JWT firmado por otro secreto: 401', async () => {
      for (const authorization of [
        undefined,
        'Bearer',
        'Bearer a.b.c',
        'Basic abc',
        'Dispositivo 1.xxxxxxxxxxxxxxxxxx',
      ]) {
        const respuesta = await prueba.app.inject({
          method: 'GET',
          url: `${RUTA}/actual`,
          headers: authorization === undefined ? {} : { authorization },
        });
        expect(respuesta.statusCode).toBe(401);
        expect(respuesta.json()).toMatchObject({ code: 'autenticacion.requerida' });
      }
    });

    it('un usuario dado de baja pierde el acceso con el mismo JWT', async () => {
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      await prueba.pool.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [a.usuario.id]);
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: `${RUTA}/actual`,
        headers: conUsuario(sesion),
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('refresco rotativo y cierre de sesión', () => {
    it('entrega un par nuevo y el refresh anterior deja de servir', async () => {
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const rotada = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/refresco`,
        payload: { refresco: sesion.refresco },
      });
      expect(rotada.statusCode).toBe(200);
      const nueva = rotada.json<{ acceso: string; refresco: string }>();
      expect(nueva.refresco).not.toBe(sesion.refresco);

      const reuso = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/refresco`,
        payload: { refresco: sesion.refresco },
      });
      expect(reuso.statusCode).toBe(401);
      expect(reuso.json()).toMatchObject({ code: 'sesion.refresco_invalido' });

      const actual = await prueba.app.inject({
        method: 'GET',
        url: `${RUTA}/actual`,
        headers: conUsuario(nueva),
      });
      expect(actual.statusCode).toBe(200);
      const rotadaOtraVez = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/refresco`,
        payload: { refresco: nueva.refresco },
      });
      expect(rotadaOtraVez.statusCode).toBe(200);
    });

    it('dos refrescos simultáneos con el mismo token: solo uno rota', async () => {
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const respuestas = await Promise.all(
        [1, 2, 3].map(() =>
          prueba.app.inject({
            method: 'POST',
            url: `${RUTA}/refresco`,
            payload: { refresco: sesion.refresco },
          }),
        ),
      );
      expect(respuestas.filter((r) => r.statusCode === 200)).toHaveLength(1);
      expect(respuestas.filter((r) => r.statusCode === 401)).toHaveLength(2);
    });

    it('un refresh inventado, vencido o de un usuario dado de baja es inválido', async () => {
      const inventado = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/refresco`,
        payload: { refresco: 'x' },
      });
      expect(inventado.statusCode).toBe(401);

      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      await prueba.pool.query('UPDATE sesiones SET expira_at = NOW(3) - INTERVAL 1 MINUTE');
      const vencido = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/refresco`,
        payload: { refresco: sesion.refresco },
      });
      expect(vencido.statusCode).toBe(401);

      const otra = await iniciarSesion(prueba.app, a.administrador.pin);
      await prueba.pool.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [a.administrador.id]);
      const baja = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/refresco`,
        payload: { refresco: otra.refresco },
      });
      expect(baja.statusCode).toBe(401);
    });

    it('cerrar la sesión revoca el refresh y el JWT de acceso', async () => {
      const sesion = await iniciarSesion(prueba.app, a.usuario.pin);
      const salida = await prueba.app.inject({
        method: 'DELETE',
        url: `${RUTA}/actual`,
        headers: conUsuario(sesion),
      });
      expect(salida.statusCode).toBe(204);
      expect(salida.body).toBe('');

      const refresh = await prueba.app.inject({
        method: 'POST',
        url: `${RUTA}/refresco`,
        payload: { refresco: sesion.refresco },
      });
      expect(refresh.statusCode).toBe(401);
      const actual = await prueba.app.inject({
        method: 'GET',
        url: `${RUTA}/actual`,
        headers: conUsuario(sesion),
      });
      expect(actual.statusCode).toBe(401);
    });
  });

  it('no guarda el PIN ni el refresh en claro, y el índice del PIN depende de la cuenta', async () => {
    const sesion = await iniciarSesion(prueba.app, a.administrador.pin);
    const [usuarios] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT pin_indice, pin_hash FROM usuarios ORDER BY id',
    );
    const texto = JSON.stringify(usuarios);
    expect(texto).not.toContain(a.administrador.pin);
    expect(texto).not.toContain(a.administrador.pin.slice(3));
    expect(String(usuarios[0]?.pin_hash)).toMatch(/^\$argon2id\$/);
    // Mismo sufijo en dos cuentas, índices distintos
    expect(usuarios[0]?.pin_indice).not.toBe(usuarios[2]?.pin_indice);

    const [sesiones] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT refresh_hash FROM sesiones',
    );
    expect(JSON.stringify(sesiones)).not.toContain(sesion.refresco);
  });

  it('una cuenta sin usuarios sembrados no filtra su existencia (mismo cuerpo que una que no existe)', async () => {
    await crearCuenta(prueba.pool, 'CCC');
    const existente = await ingresar('CCC1234', '10.4.4.4');
    const inexistente = await ingresar('ZZZ1234', '10.5.5.5');
    expect(existente.statusCode).toBe(inexistente.statusCode);
    expect(existente.json()).toEqual(inexistente.json());
  });
});
