import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin, type Escenario } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';

interface Listado {
  datos: { id: string; usuario: { id: string } }[];
  meta: { total: number };
}

describe('AGROCOM y los incidentes de una cuenta (ADR 0033 §4)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let arbolB: Arbol;
  let superAcceso: string;
  let adminA: string;

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
    arbol = await armarArbol(prueba.pool, a);
    arbolB = await armarArbol(prueba.pool, b);
    const sa = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    superAcceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena)).acceso;
    adminA = (await iniciarSesion(prueba.app, a.administrador.pin)).acceso;
  });

  const registrar = (acceso: string, usuarioId: string) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/incidentes',
      headers: conUsuario({ acceso }),
      payload: { usuario_id: usuarioId, tipo: 'uso_masivo', gravedad: 'media' },
    });
  const deLaCuenta = (acceso: string, cuentaId: string, consulta = '') =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/plataforma/cuentas/${cuentaId}/incidentes${consulta}`,
      headers: conUsuario({ acceso }),
    });

  describe('lista los incidentes de una cuenta', () => {
    it('solo los de esa cuenta, con filtros', async () => {
      const adminB = (await iniciarSesion(prueba.app, b.administrador.pin)).acceso;
      const deA = (await registrar(adminA, arbol.miembro1.id)).json<{ id: string }>();
      await registrar(adminB, arbolB.miembro1.id);

      const respuesta = await deLaCuenta(superAcceso, a.cuenta.id);
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      const cuerpo = respuesta.json<Listado>();
      expect(cuerpo.datos.map((i) => i.id)).toEqual([deA.id]);
      expect(cuerpo.meta.total).toBe(1);

      const filtrado = await deLaCuenta(superAcceso, a.cuenta.id, '?estado=confirmado');
      expect(filtrado.json<Listado>().datos).toEqual([]);
    });

    it('una cuenta que no existe es 404', async () => {
      const respuesta = await deLaCuenta(superAcceso, '999999');
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('cuenta.no_encontrada');
    });

    it('un token de cuenta no sirve en la ruta de plataforma, ni sin sesión', async () => {
      expect((await deLaCuenta(adminA, a.cuenta.id)).statusCode).toBe(401);
      const sinSesion = await prueba.app.inject({
        method: 'GET',
        url: `/api/v1/plataforma/cuentas/${a.cuenta.id}/incidentes`,
      });
      expect(sinSesion.statusCode).toBe(401);
    });

    it('esta ruta es de lectura: AGROCOM no registra incidentes por ella (resolver tiene su propia ruta)', async () => {
      const escritura = await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/plataforma/cuentas/${a.cuenta.id}/incidentes`,
        headers: conUsuario({ acceso: superAcceso }),
        payload: {},
      });
      expect(escritura.statusCode).toBe(404);
    });
  });

  describe('política de la cuenta fijada por AGROCOM (configuración y excepciones)', () => {
    const fijar = (cuentaId: string, cuerpo: object) =>
      prueba.app.inject({
        method: 'PUT',
        url: `/api/v1/plataforma/cuentas/${cuentaId}/excepciones-de-limite`,
        headers: conUsuario({ acceso: superAcceso }),
        payload: cuerpo,
      });
    const politica = (acceso: string) =>
      prueba.app.inject({
        method: 'GET',
        url: '/api/v1/incidentes/politica',
        headers: conUsuario({ acceso }),
      });

    it('enciende la restricción automática solo para una cuenta, con valores 0 o 1', async () => {
      const adminB = (await iniciarSesion(prueba.app, b.administrador.pin)).acceso;
      expect(
        (await fijar(a.cuenta.id, { clave: 'incidente.restriccion_automatica', valor: 1 }))
          .statusCode,
      ).toBe(200);
      expect((await politica(adminA)).json()).toMatchObject({ restriccion_automatica: true });
      expect((await politica(adminB)).json()).toMatchObject({ restriccion_automatica: false });

      const fueraDeRango = await fijar(a.cuenta.id, {
        clave: 'incidente.restriccion_automatica',
        valor: 2,
      });
      expect(fueraDeRango.statusCode).toBe(422);
      expect(fueraDeRango.json<Problema>().code).toBe('limite.valor_invalido');
    });

    it('cambia el umbral de una cuenta y no se puede fijar por usuario', async () => {
      await fijar(a.cuenta.id, { clave: 'incidente.reincidencia_minimo', valor: 5 });
      await fijar(a.cuenta.id, { clave: 'incidente.reincidencia_ventana_dias', valor: 60 });
      expect((await politica(adminA)).json()).toMatchObject({
        reincidencia_minimo: 5,
        reincidencia_ventana_dias: 60,
      });
      const porUsuario = await fijar(a.cuenta.id, {
        clave: 'incidente.reincidencia_minimo',
        usuario_id: arbol.miembro1.id,
        valor: 1,
      });
      expect(porUsuario.statusCode).toBe(422);
      expect(porUsuario.json<Problema>().code).toBe('limite.excepcion_no_permitida');
    });

    it('los umbrales de la detección de generación ruidosa son globales: no admiten excepción por cuenta', async () => {
      const respuesta = await fijar(a.cuenta.id, {
        clave: 'incidente.rechazos_generacion_minimo',
        valor: 2,
      });
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('limite.excepcion_no_permitida');
    });

    it('el valor general se edita con la ruta de límites y queda en la bitácora', async () => {
      const cambio = await prueba.app.inject({
        method: 'PUT',
        url: '/api/v1/plataforma/limites/incidente.reincidencia_minimo',
        headers: conUsuario({ acceso: superAcceso }),
        payload: { valor: 4 },
      });
      expect(cambio.statusCode).toBe(204);
      expect((await politica(adminA)).json()).toMatchObject({ reincidencia_minimo: 4 });
      const fuera = await prueba.app.inject({
        method: 'PUT',
        url: '/api/v1/plataforma/limites/incidente.reincidencia_minimo',
        headers: conUsuario({ acceso: superAcceso }),
        payload: { valor: 0 },
      });
      expect(fuera.statusCode).toBe(422);
    });
  });
});
