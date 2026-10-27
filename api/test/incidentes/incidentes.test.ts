import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashDeToken } from '../../src/modules/accesos/domain/token-qr.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
  type Escenario,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';

interface Persona {
  id: string;
  etiqueta: string | null;
}
interface Resolucion {
  resultado: string;
  motivo: string | null;
  resuelto_por: Persona;
  resuelta_at: string;
}
interface Incidente {
  id: string;
  usuario: Persona;
  tipo: string;
  gravedad: string;
  origen: string;
  registrado_por: Persona | null;
  descripcion: string | null;
  evidencia: { qr_ids: string[]; evento_acceso_ids: string[]; evento_limite_ids: string[] };
  estado: string;
  resolucion: Resolucion | null;
  ocurrido_at: string;
  created_at: string;
  historial?: Resolucion[];
}
interface Listado {
  datos: Incidente[];
  meta: { total: number };
}
interface Resultado {
  incidente: Incidente;
  reincidencia: {
    confirmados: number;
    minimo: number;
    ventana_dias: number;
    propuesta: string | null;
    aplicada_automaticamente: boolean;
  } | null;
}

describe('incidentes de uso: registro, lectura y resolución (ADR 0033 §3 y §4)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let arbolB: Arbol;
  let admin: Sesion;
  let adminB: Sesion;
  let titular1: Sesion;
  let miembro1: Sesion;
  let guardia: Sesion;

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
    admin = await iniciarSesion(prueba.app, a.administrador.pin);
    adminB = await iniciarSesion(prueba.app, b.administrador.pin);
    titular1 = await iniciarSesion(prueba.app, arbol.titular1.pin);
    miembro1 = await iniciarSesion(prueba.app, arbol.miembro1.pin);
    guardia = await iniciarSesion(prueba.app, arbol.guardia.pin);
  });

  const registrar = (sesion: Sesion, cuerpo: object) =>
    prueba.app.inject({
      method: 'POST',
      url: '/api/v1/incidentes',
      headers: conUsuario(sesion),
      payload: cuerpo,
    });
  const resolver = (sesion: Sesion, id: string, cuerpo: object) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/incidentes/${id}/resolucion`,
      headers: conUsuario(sesion),
      payload: cuerpo,
    });
  const ver = (sesion: Sesion, id: string) =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/incidentes/${id}`,
      headers: conUsuario(sesion),
    });
  const listar = (sesion: Sesion, consulta = '') =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/incidentes${consulta}`,
      headers: conUsuario(sesion),
    });

  /** Registra por la API como Administrador de A y devuelve el incidente. */
  async function crear(usuario: UsuarioDePrueba, extra: object = {}, quien: Sesion = admin) {
    const respuesta = await registrar(quien, {
      usuario_id: usuario.id,
      tipo: 'uso_masivo',
      gravedad: 'media',
      ...extra,
    });
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    return respuesta.json<Incidente>();
  }

  describe('registro manual', () => {
    it('el Administrador registra un incidente: origen persona, con autor y sin resolver', async () => {
      const respuesta = await registrar(admin, {
        usuario_id: arbol.miembro1.id,
        tipo: 'pin_compartido',
        gravedad: 'alta',
        descripcion: '  Tres personas usan su PIN  ',
      });
      expect(respuesta.statusCode, respuesta.body).toBe(201);
      const incidente = respuesta.json<Incidente>();
      expect(incidente).toMatchObject({
        usuario: { id: arbol.miembro1.id },
        tipo: 'pin_compartido',
        gravedad: 'alta',
        origen: 'persona',
        registrado_por: { id: a.administrador.id },
        descripcion: 'Tres personas usan su PIN',
        estado: 'sin_resolver',
        resolucion: null,
        historial: [],
        evidencia: { qr_ids: [], evento_acceso_ids: [], evento_limite_ids: [] },
      });
      expect(incidente.created_at).toMatch(/Z$/);
    });

    it('acepta evidencia: ids de QR y de intentos de la cuenta, nunca el token', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, arbol.miembro1.id, [a.puertaPrincipal.id]);
      const validacion = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token: qr.texto },
      });
      const eventoId = validacion.json<{ evento_id: string }>().evento_id;

      const incidente = await crear(arbol.miembro1, {
        tipo: 'qr_reenviado',
        evidencia: { qr_ids: [qr.id, qr.id], evento_acceso_ids: [eventoId] },
      });
      expect(incidente.evidencia).toEqual({
        qr_ids: [qr.id],
        evento_acceso_ids: [eventoId],
        evento_limite_ids: [],
      });

      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT evidencia FROM incidentes_uso WHERE id = ?',
        [incidente.id],
      );
      const guardado = JSON.stringify(filas[0]?.evidencia);
      const respuestaCompleta = JSON.stringify(incidente);
      const textoSinPrefijo = qr.texto.replace(/^AQ1\./, '');
      for (const texto of [guardado, respuestaCompleta]) {
        expect(texto).not.toContain(qr.texto);
        expect(texto).not.toContain(textoSinPrefijo);
        expect(texto).not.toContain(hashDeToken(textoSinPrefijo));
      }
    });

    it('rechaza evidencia que no existe en la cuenta, también la de otra cuenta (422)', async () => {
      const qrDeB = await crearQr(prueba.pool, b.cuenta, b.usuario.id, [b.puertaPrincipal.id]);
      for (const evidencia of [
        { qr_ids: [qrDeB.id] },
        { qr_ids: ['999999'] },
        { evento_acceso_ids: ['999999'] },
      ]) {
        const respuesta = await registrar(admin, {
          usuario_id: arbol.miembro1.id,
          tipo: 'otro',
          gravedad: 'baja',
          evidencia,
        });
        expect(respuesta.statusCode, JSON.stringify(evidencia)).toBe(422);
        expect(respuesta.json<Problema>().code).toBe('incidente.evidencia_invalida');
      }
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('valida la entrada: tipo y gravedad de la lista, descripción corta, evidencia acotada, sin campos de más', async () => {
      const base = { usuario_id: arbol.miembro1.id, tipo: 'otro', gravedad: 'baja' };
      const casos: object[] = [
        { ...base, tipo: 'inventado' },
        { ...base, gravedad: 'critica' },
        { ...base, descripcion: 'x'.repeat(301) },
        { ...base, evidencia: { qr_ids: Array.from({ length: 51 }, (_, i) => String(i + 1)) } },
        { ...base, evidencia: { token: 'AQ1.secreto' } },
        { ...base, origen: 'sistema' },
        { ...base, registrado_por: '1' },
        { ...base, usuario_id: 'abc' },
        { tipo: 'otro', gravedad: 'baja' },
      ];
      for (const caso of casos) {
        const respuesta = await registrar(admin, caso);
        expect(respuesta.statusCode, JSON.stringify(caso)).toBe(400);
        expect(respuesta.json<Problema>().code).toBe('validacion.invalida');
      }
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('no acepta una fecha futura (422) y respeta una pasada', async () => {
      const futura = await registrar(admin, {
        usuario_id: arbol.miembro1.id,
        tipo: 'otro',
        gravedad: 'baja',
        ocurrido_at: new Date(Date.now() + 3_600_000).toISOString(),
      });
      expect(futura.statusCode).toBe(422);
      expect(futura.json<Problema>().code).toBe('incidente.fecha_futura');

      const ayer = new Date(Date.now() - 86_400_000).toISOString();
      const incidente = await crear(arbol.miembro1, { ocurrido_at: ayer });
      expect(incidente.ocurrido_at).toBe(ayer);
    });

    it('una descripción con SQL o HTML se guarda inerte', async () => {
      const rara = `'); DROP TABLE incidentes_uso; -- <img src=x onerror=alert(1)>`;
      const incidente = await crear(arbol.miembro1, { descripcion: rara });
      expect(incidente.descripcion).toBe(rara);
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
    });

    it('nadie registra sobre sí mismo (403 incidente.propio)', async () => {
      for (const [sesion, usuario] of [
        [admin, a.administrador],
        [titular1, arbol.titular1],
      ] as const) {
        const respuesta = await registrar(sesion, {
          usuario_id: usuario.id,
          tipo: 'otro',
          gravedad: 'baja',
        });
        expect(respuesta.statusCode).toBe(403);
        expect(respuesta.json<Problema>().code).toBe('incidente.propio');
      }
    });

    it('escalada de privilegios: el Titular solo registra sobre su rama; el Miembro y el Guardia no tienen el permiso', async () => {
      await crear(arbol.miembro1, {}, titular1);
      for (const usuario of [arbol.miembro2, arbol.titular2, a.administrador, arbol.guardia]) {
        const respuesta = await registrar(titular1, {
          usuario_id: usuario.id,
          tipo: 'otro',
          gravedad: 'baja',
        });
        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
      }
      for (const sesion of [miembro1, guardia]) {
        const respuesta = await registrar(sesion, {
          usuario_id: arbol.miembro1b.id,
          tipo: 'otro',
          gravedad: 'baja',
        });
        expect(respuesta.statusCode).toBe(403);
        expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
      }
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
    });

    it('aislamiento: el Administrador de A no registra sobre un usuario de B (404) ni se crea nada', async () => {
      const respuesta = await registrar(admin, {
        usuario_id: arbolB.miembro1.id,
        tipo: 'otro',
        gravedad: 'baja',
      });
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('usuario.no_encontrado');
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(0);
    });

    it('sin sesión es 401', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/incidentes',
        payload: { usuario_id: '1', tipo: 'otro', gravedad: 'baja' },
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('lectura y alcance', () => {
    let delMiembro1: Incidente;
    let delMiembro2: Incidente;
    let delTitular1: Incidente;
    let delGuardia: Incidente;

    beforeEach(async () => {
      delMiembro1 = await crear(arbol.miembro1, { tipo: 'uso_masivo' });
      delMiembro2 = await crear(arbol.miembro2, { tipo: 'qr_reenviado' });
      delTitular1 = await crear(arbol.titular1, { tipo: 'pin_compartido' });
      delGuardia = await crear(arbol.guardia, { tipo: 'perdida_o_robo' });
    });

    const ids = (listado: Listado) => listado.datos.map((i) => i.id).sort();

    it('el Administrador ve los de toda la cuenta', async () => {
      const respuesta = await listar(admin);
      expect(respuesta.statusCode).toBe(200);
      expect(ids(respuesta.json<Listado>())).toEqual(
        [delMiembro1, delMiembro2, delTitular1, delGuardia].map((i) => i.id).sort(),
      );
      expect(respuesta.json<Listado>().meta.total).toBe(4);
    });

    it('el Titular ve los de sus Miembros y los suyos, no los de otra rama ni el del Guardia', async () => {
      const respuesta = await listar(titular1);
      expect(ids(respuesta.json<Listado>())).toEqual([delMiembro1.id, delTitular1.id].sort());
    });

    it('el Miembro y el Guardia ven solo los propios', async () => {
      expect(ids((await listar(miembro1)).json<Listado>())).toEqual([delMiembro1.id]);
      expect(ids((await listar(guardia)).json<Listado>())).toEqual([delGuardia.id]);
    });

    it('un incidente fuera del alcance es 404, igual que uno inexistente', async () => {
      for (const [sesion, incidente] of [
        [titular1, delMiembro2],
        [titular1, delGuardia],
        [miembro1, delTitular1],
        [guardia, delMiembro1],
      ] as const) {
        const respuesta = await ver(sesion, incidente.id);
        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.json<Problema>().code).toBe('incidente.no_encontrado');
      }
      expect((await ver(admin, '999999')).statusCode).toBe(404);
      expect((await ver(titular1, delMiembro1.id)).statusCode).toBe(200);
      expect((await ver(miembro1, delMiembro1.id)).statusCode).toBe(200);
    });

    it('aislamiento: A no ve ni lista ni resuelve los incidentes de B (404)', async () => {
      const deB = await crear(arbolB.miembro1, {}, adminB);
      expect(ids((await listar(admin)).json<Listado>())).not.toContain(deB.id);
      expect(ids((await listar(adminB)).json<Listado>())).toEqual([deB.id]);
      expect((await ver(admin, deB.id)).statusCode).toBe(404);
      const resolucion = await resolver(admin, deB.id, { resultado: 'descartado' });
      expect(resolucion.statusCode).toBe(404);
      expect(resolucion.json<Problema>().code).toBe('incidente.no_encontrado');
      expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
    });

    it('filtra por usuario, tipo, origen y estado', async () => {
      await resolver(admin, delMiembro1.id, {
        resultado: 'confirmado',
        motivo: 'visto en la puerta',
      });
      await resolver(admin, delMiembro2.id, { resultado: 'descartado' });

      const porUsuario = await listar(admin, `?usuario_id=${arbol.miembro1.id}`);
      expect(ids(porUsuario.json<Listado>())).toEqual([delMiembro1.id]);
      const porTipo = await listar(admin, '?tipo=perdida_o_robo');
      expect(ids(porTipo.json<Listado>())).toEqual([delGuardia.id]);
      const porOrigen = await listar(admin, '?origen=sistema');
      expect(porOrigen.json<Listado>().datos).toEqual([]);
      for (const [estado, esperado] of [
        ['confirmado', [delMiembro1.id]],
        ['descartado', [delMiembro2.id]],
        ['sin_resolver', [delTitular1.id, delGuardia.id].sort()],
        ['pendiente', []],
      ] as const) {
        const respuesta = await listar(admin, `?estado=${estado}`);
        expect(ids(respuesta.json<Listado>()), estado).toEqual(esperado);
      }
      // Un filtro fuera del alcance no devuelve nada (y no revela que existe).
      const ajeno = await listar(titular1, `?usuario_id=${arbol.miembro2.id}`);
      expect(ajeno.json<Listado>().datos).toEqual([]);
    });

    it('rechaza filtros fuera de la lista y cargas de inyección en la consulta', async () => {
      for (const consulta of [
        '?tipo=otro%27%20OR%201%3D1',
        '?estado=todos',
        '?usuario_id=1%3BDROP%20TABLE%20usuarios',
        '?origen=persona%27--',
        '?por_pagina=101',
      ]) {
        const respuesta = await listar(admin, consulta);
        expect(respuesta.statusCode, consulta).toBe(400);
      }
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(4);
    });

    it('pagina y ordena del más reciente al más antiguo', async () => {
      const primera = await listar(admin, '?por_pagina=3&pagina=1');
      const segunda = await listar(admin, '?por_pagina=3&pagina=2');
      expect(primera.json<Listado>().datos).toHaveLength(3);
      expect(segunda.json<Listado>().datos).toHaveLength(1);
      expect(primera.json<Listado>().meta).toMatchObject({ pagina: 1, por_pagina: 3, total: 4 });
    });
  });

  describe('resolución', () => {
    let incidente: Incidente;
    beforeEach(async () => {
      incidente = await crear(arbol.miembro1);
    });

    it('confirmar exige un motivo (422 incidente.motivo_requerido) y no deja huella si falta', async () => {
      for (const cuerpo of [
        { resultado: 'confirmado' },
        { resultado: 'confirmado', motivo: '' },
        { resultado: 'confirmado', motivo: '   ' },
        { resultado: 'confirmado', motivo: null },
      ]) {
        const respuesta = await resolver(admin, incidente.id, cuerpo);
        expect(respuesta.statusCode, JSON.stringify(cuerpo)).toBe(422);
        expect(respuesta.json<Problema>().code).toBe('incidente.motivo_requerido');
      }
      expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
    });

    it('descartar y dejar pendiente no exigen motivo; confirmar con motivo lo guarda', async () => {
      const descartado = await resolver(admin, incidente.id, { resultado: 'descartado' });
      expect(descartado.statusCode, descartado.body).toBe(200);
      expect(descartado.json<Resultado>().incidente).toMatchObject({
        estado: 'descartado',
        resolucion: {
          resultado: 'descartado',
          motivo: null,
          resuelto_por: { id: a.administrador.id },
        },
      });
      expect(descartado.json<Resultado>().reincidencia).toBeNull();

      const pendiente = await resolver(admin, incidente.id, { resultado: 'pendiente' });
      expect(pendiente.json<Resultado>().incidente.estado).toBe('pendiente');

      const confirmado = await resolver(admin, incidente.id, {
        resultado: 'confirmado',
        motivo: '  Lo vi pasar tres veces  ',
      });
      expect(confirmado.statusCode, confirmado.body).toBe(200);
      const cuerpo = confirmado.json<Resultado>();
      expect(cuerpo.incidente.estado).toBe('confirmado');
      expect(cuerpo.incidente.resolucion?.motivo).toBe('Lo vi pasar tres veces');
      expect(cuerpo.reincidencia).toEqual({
        confirmados: 1,
        minimo: 3,
        ventana_dias: 30,
        propuesta: null,
        aplicada_automaticamente: false,
      });
    });

    it('cada decisión es una fila nueva y el historial las conserva en orden', async () => {
      await resolver(admin, incidente.id, { resultado: 'pendiente' });
      await resolver(admin, incidente.id, { resultado: 'confirmado', motivo: 'sí fue' });
      await resolver(admin, incidente.id, { resultado: 'descartado', motivo: 'era un error' });
      const detalle = (await ver(admin, incidente.id)).json<Incidente>();
      expect(detalle.estado).toBe('descartado');
      expect(detalle.historial?.map((r) => r.resultado)).toEqual([
        'pendiente',
        'confirmado',
        'descartado',
      ]);
      expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(3);
      // El hecho no se tocó: sigue siendo el mismo registro.
      expect(detalle.tipo).toBe('uso_masivo');
      expect(await contarFilas(prueba.pool, 'incidentes_uso')).toBe(1);
    });

    it('repetir el mismo resultado no agrega nada (un doble clic es inofensivo)', async () => {
      const primera = await resolver(admin, incidente.id, {
        resultado: 'confirmado',
        motivo: 'confirmado',
      });
      const segunda = await resolver(admin, incidente.id, {
        resultado: 'confirmado',
        motivo: 'confirmado',
      });
      expect(primera.statusCode).toBe(200);
      expect(segunda.statusCode).toBe(200);
      expect(segunda.json<Resultado>().reincidencia).toBeNull();
      expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(1);
    });

    it('valida la entrada: resultado de la lista, sin campos de más, id numérico', async () => {
      for (const cuerpo of [
        { resultado: 'aprobado' },
        {},
        { resultado: 'descartado', resuelto_por: '1' },
        { resultado: 'confirmado', motivo: 'x'.repeat(201) },
      ]) {
        const respuesta = await resolver(admin, incidente.id, cuerpo);
        expect(respuesta.statusCode, JSON.stringify(cuerpo)).toBe(400);
      }
      const idMalo = await resolver(admin, 'abc', { resultado: 'descartado' });
      expect(idMalo.statusCode).toBe(400);
    });

    it('el Titular resuelve los de sus Miembros; los de otra rama no existen para él (404)', async () => {
      const ajeno = await crear(arbol.miembro2);
      const propio = await resolver(titular1, incidente.id, { resultado: 'descartado' });
      expect(propio.statusCode, propio.body).toBe(200);
      const deOtro = await resolver(titular1, ajeno.id, { resultado: 'descartado' });
      expect(deOtro.statusCode).toBe(404);
      expect(deOtro.json<Problema>().code).toBe('incidente.no_encontrado');
    });

    it('nadie resuelve un incidente sobre sí mismo: ni el Titular ni el Administrador (403 incidente.propio)', async () => {
      const deTitular = await crear(arbol.titular1);
      // Nadie puede registrar un incidente sobre sí mismo por la API: el del Administrador se arma en la base.
      const [insertado] = await prueba.pool.query<RowDataPacket[] & { insertId: number }>(
        "INSERT INTO incidentes_uso (tenant_id, usuario_id, tipo, gravedad, origen, registrado_por, evidencia, ocurrido_at) VALUES (?, ?, 'otro', 'baja', 'persona', ?, '{}', NOW(3))",
        [a.cuenta.id, a.administrador.id, arbol.titular1.id],
      );
      const deAdmin = { id: String((insertado as unknown as { insertId: number }).insertId) };
      for (const [sesion, id] of [
        [titular1, deTitular.id],
        [admin, deAdmin.id],
      ] as const) {
        const respuesta = await resolver(sesion, id, { resultado: 'descartado' });
        expect(respuesta.statusCode).toBe(403);
        expect(respuesta.json<Problema>().code).toBe('incidente.propio');
      }
      // Otro lo resuelve: el Administrador el del Titular.
      expect((await resolver(admin, deTitular.id, { resultado: 'descartado' })).statusCode).toBe(
        200,
      );
      expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(1);
    });

    it('el Miembro y el Guardia ven su incidente pero no lo resuelven (403 permiso.denegado)', async () => {
      const visto = await ver(miembro1, incidente.id);
      expect(visto.statusCode).toBe(200);
      const respuesta = await resolver(miembro1, incidente.id, { resultado: 'descartado' });
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
      const deGuardia = await crear(arbol.guardia);
      const delGuardia = await resolver(guardia, deGuardia.id, { resultado: 'descartado' });
      expect(delGuardia.statusCode).toBe(403);
      expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
    });

    it('resolver un incidente no restringe ni suspende a nadie por sí solo', async () => {
      await resolver(admin, incidente.id, { resultado: 'confirmado', motivo: 'visto' });
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT estado FROM usuarios WHERE id = ?',
        [arbol.miembro1.id],
      );
      expect(filas[0]?.estado).toBe('activo');
    });
  });

  describe('política que le aplica a la cuenta', () => {
    const politica = (sesion: Sesion) =>
      prueba.app.inject({
        method: 'GET',
        url: '/api/v1/incidentes/politica',
        headers: conUsuario(sesion),
      });

    it('muestra los valores de partida: 3 confirmados en 30 días y restricción automática apagada', async () => {
      const respuesta = await politica(admin);
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.json()).toEqual({
        reincidencia_minimo: 3,
        reincidencia_ventana_dias: 30,
        restriccion_automatica: false,
      });
    });

    it('refleja la excepción de la cuenta y no la de otra', async () => {
      await prueba.pool.query(
        "INSERT INTO excepciones_de_limite (tenant_id, usuario_id, clave, valor) VALUES (?, NULL, 'incidente.restriccion_automatica', 1), (?, NULL, 'incidente.reincidencia_minimo', 5)",
        [a.cuenta.id, a.cuenta.id],
      );
      expect((await politica(admin)).json()).toMatchObject({
        reincidencia_minimo: 5,
        restriccion_automatica: true,
      });
      expect((await politica(adminB)).json()).toMatchObject({
        reincidencia_minimo: 3,
        restriccion_automatica: false,
      });
    });

    it('la ven todos los roles con seguridad.incidente.ver', async () => {
      for (const sesion of [titular1, miembro1, guardia]) {
        expect((await politica(sesion)).statusCode).toBe(200);
      }
    });
  });
});
