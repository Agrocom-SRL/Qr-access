import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as resolverIncidente } from '../../src/modules/incidentes/actions/resolver-incidente.js';
import type { ResultadoDeResolucionDeIncidente } from '../../src/modules/incidentes/actions/resolver-incidente.js';
import type { TipoDeIncidente } from '../../src/modules/incidentes/domain/incidente.js';
import { ejecutar as entregar } from '../../src/modules/notificaciones/actions/entregar-pendientes.js';
import { crearServicioDeArbol } from '../../src/modules/seguridad/contracts.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../src/platform/db/transaccion.js';
import type { PrincipalUsuario } from '../../src/platform/seguridad/principal.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import {
  contarFilas,
  crearEscenario,
  crearQr,
  crearRol,
  crearSuperAdmin,
  crearUsuarioConPin,
  PERMISOS_DE_ADMINISTRADOR,
  PERMISOS_DE_TITULAR,
  type Escenario,
  type UsuarioDePrueba,
} from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
  type Sesion,
} from '../helpers/http.js';

const DIA = 86_400_000;
const en = (ids: readonly string[], i: number): string => {
  const id = ids[i];
  if (id === undefined) throw new Error(`falta el elemento ${i}`);
  return id;
};
const AHORA = new Date('2026-11-10T12:00:00.000Z');
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA);

describe('reincidencia: de «caso raro» a baja (ADR 0033 §4.3 y §4.4)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let admin: PrincipalUsuario;
  let titular: PrincipalUsuario;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(async () => {
    await prueba.cerrar();
  });

  const principalDe = (
    escenario: Escenario,
    usuario: UsuarioDePrueba,
    rolId: string,
    permisos: readonly string[],
  ): PrincipalUsuario => ({
    tipo: 'usuario',
    usuarioId: usuario.id,
    cuentaId: escenario.cuenta.id,
    sesionId: '0',
    rolActivoId: rolId,
    permisos: new Set(permisos),
    estado: 'activo',
    origenDelEstado: null,
  });

  beforeEach(async () => {
    await reiniciarBase(prueba.pool);
    a = await crearEscenario(prueba.pool, 'AAA');
    b = await crearEscenario(prueba.pool, 'BBB');
    arbol = await armarArbol(prueba.pool, a);
    admin = principalDe(a, a.administrador, a.rolAdministradorId, PERMISOS_DE_ADMINISTRADOR);
    titular = principalDe(a, arbol.titular1, a.rolTitularId, PERMISOS_DE_TITULAR);
  });

  /** Un incidente escrito directo en la base con la fecha que se quiera. */
  async function incidente(
    usuario: UsuarioDePrueba,
    ocurridoAt: Date,
    tipo: TipoDeIncidente = 'uso_masivo',
    escenario: Escenario = a,
    registradoPor: string | null = escenario.administrador.id,
  ): Promise<string> {
    const [resultado] = await prueba.pool.query<RowDataPacket[] & { insertId: number }>(
      "INSERT INTO incidentes_uso (tenant_id, usuario_id, tipo, gravedad, origen, registrado_por, evidencia, ocurrido_at) VALUES (?, ?, ?, 'media', ?, ?, '{}', ?)",
      [
        escenario.cuenta.id,
        usuario.id,
        tipo,
        registradoPor === null ? 'sistema' : 'persona',
        registradoPor,
        ocurridoAt,
      ],
    );
    return String((resultado as unknown as { insertId: number }).insertId);
  }

  /** Tres confirmados de `usuario` que NO registró una sola persona: el contraste que pide la restricción automática. */
  async function confirmarConContraste(usuario: UsuarioDePrueba): Promise<void> {
    for (const [dias, registrador] of [
      [2, arbol.titular1.id],
      [1, a.administrador.id],
      [0, a.administrador.id],
    ] as const) {
      await confirmar(await incidente(usuario, hace(dias), 'uso_masivo', a, registrador));
    }
  }

  const comoApi = <T>(principal: PrincipalUsuario, fn: () => Promise<T>): Promise<T> =>
    ContextoCuenta.ejecutar(
      {
        cuentaId: principal.cuentaId,
        usuarioId: principal.usuarioId,
        rolActivoId: null,
        dispositivoId: null,
        origen: 'api',
      },
      fn,
    );

  /** Confirma un incidente como `quien`, con el reloj en `ahora`. */
  const confirmar = (
    id: string,
    quien: PrincipalUsuario = admin,
    ahora: Date = AHORA,
  ): Promise<ResultadoDeResolucionDeIncidente> =>
    comoApi(quien, () =>
      resolverIncidente(
        prueba.pool,
        quien,
        id,
        { resultado: 'confirmado', motivo: 'confirmado' },
        ahora,
      ),
    );

  const estadoDe = async (usuario: UsuarioDePrueba) => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT estado, estado_impuesto_por, estado_motivo FROM usuarios WHERE id = ?',
      [usuario.id],
    );
    return filas[0] as {
      estado: string;
      estado_impuesto_por: string | null;
      estado_motivo: string | null;
    };
  };

  const fijarConfiguracion = (clave: string, valor: number) =>
    prueba.pool.query('UPDATE configuracion_limites SET valor = ? WHERE clave = ?', [valor, clave]);
  const fijarExcepcion = (escenario: Escenario, clave: string, valor: number) =>
    prueba.pool.query(
      'INSERT INTO excepciones_de_limite (tenant_id, usuario_id, clave, valor) VALUES (?, NULL, ?, ?)',
      [escenario.cuenta.id, clave, valor],
    );

  async function propuestasEnCola(): Promise<{ audiencia: string; carga: string | object }[]> {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT audiencia, carga FROM cola_de_notificaciones WHERE agrupacion_clave LIKE 'incidente.propuesta:%' ORDER BY id",
    );
    return filas as { audiencia: string; carga: string | object }[];
  }
  const objeto = (valor: string | object): Record<string, unknown> =>
    (typeof valor === 'string' ? JSON.parse(valor) : valor) as Record<string, unknown>;

  describe('umbral y ventana móvil (reloj inyectado)', () => {
    it('uno y dos confirmados no proponen nada; el tercero propone restringir y NO lo aplica', async () => {
      const ids = [
        await incidente(arbol.miembro1, hace(2)),
        await incidente(arbol.miembro1, hace(1)),
        await incidente(arbol.miembro1, hace(0)),
      ];
      const primero = await confirmar(en(ids, 0));
      expect(primero.reincidencia).toMatchObject({ confirmados: 1, minimo: 3, propuesta: null });
      const segundo = await confirmar(en(ids, 1));
      expect(segundo.reincidencia).toMatchObject({ confirmados: 2, propuesta: null });
      expect(await propuestasEnCola()).toEqual([]);

      const tercero = await confirmar(en(ids, 2));
      expect(tercero.reincidencia).toEqual({
        confirmados: 3,
        minimo: 3,
        ventanaDias: 30,
        propuesta: 'restringir',
        aplicadaAutomaticamente: false,
      });
      // La propuesta no aplica: el usuario sigue activo, sin motivo, y la bitácora no registra ningún cambio de estado.
      expect(await estadoDe(arbol.miembro1)).toMatchObject({
        estado: 'activo',
        estado_motivo: null,
      });
      const [cambios] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT id FROM bitacoras WHERE tabla = 'usuarios' AND JSON_EXTRACT(despues, '$.estado') IS NOT NULL",
      );
      expect(cambios).toHaveLength(0);
    });

    it('solo cuentan los confirmados: descartados y pendientes no suman', async () => {
      const ids = [
        await incidente(arbol.miembro1, hace(3)),
        await incidente(arbol.miembro1, hace(2)),
        await incidente(arbol.miembro1, hace(1)),
        await incidente(arbol.miembro1, hace(0)),
      ];
      await comoApi(admin, () =>
        resolverIncidente(
          prueba.pool,
          admin,
          en(ids, 0),
          { resultado: 'descartado', motivo: null },
          AHORA,
        ),
      );
      await comoApi(admin, () =>
        resolverIncidente(
          prueba.pool,
          admin,
          en(ids, 1),
          { resultado: 'pendiente', motivo: null },
          AHORA,
        ),
      );
      await confirmar(en(ids, 2));
      const ultimo = await confirmar(en(ids, 3));
      expect(ultimo.reincidencia).toMatchObject({ confirmados: 2, propuesta: null });
    });

    it('la ventana es móvil: lo que ocurrió hace más de 30 días ya no cuenta', async () => {
      const viejo1 = await incidente(arbol.miembro1, hace(41));
      const viejo2 = await incidente(arbol.miembro1, hace(35));
      const reciente = await incidente(arbol.miembro1, hace(0));
      // Se confirman los tres hoy, pero dos ocurrieron fuera de la ventana de 30 días.
      await confirmar(viejo1);
      await confirmar(viejo2);
      const resultado = await confirmar(reciente);
      expect(resultado.reincidencia).toMatchObject({ confirmados: 1, propuesta: null });
      expect(await propuestasEnCola()).toEqual([]);
    });

    it('el límite de la ventana es inclusivo y se mueve con el reloj', async () => {
      const enElBorde = await incidente(arbol.miembro1, hace(30));
      const medio = await incidente(arbol.miembro1, hace(10));
      const hoy = await incidente(arbol.miembro1, hace(0));
      await confirmar(enElBorde);
      await confirmar(medio);
      // Hoy: los tres caen en [hoy - 30 días, hoy]: reincidencia.
      expect((await confirmar(hoy)).reincidencia).toMatchObject({
        confirmados: 3,
        propuesta: 'restringir',
      });

      // Un día después la misma cuenta ya no ve el incidente del borde: con otro incidente nuevo son 3 de nuevo, no 4.
      const manana = new Date(AHORA.getTime() + DIA);
      const nuevo = await incidente(arbol.miembro1, manana);
      const tras = await confirmar(nuevo, admin, manana);
      expect(tras.reincidencia).toMatchObject({ confirmados: 3 });
    });

    it('el umbral y la ventana salen de la configuración de plataforma', async () => {
      await fijarConfiguracion('incidente.reincidencia_minimo', 2);
      await fijarConfiguracion('incidente.reincidencia_ventana_dias', 5);
      const viejo = await incidente(arbol.miembro1, hace(6));
      const uno = await incidente(arbol.miembro1, hace(2));
      const dos = await incidente(arbol.miembro1, hace(0));
      await confirmar(viejo);
      await confirmar(uno);
      const resultado = await confirmar(dos);
      expect(resultado.reincidencia).toEqual({
        confirmados: 2,
        minimo: 2,
        ventanaDias: 5,
        propuesta: 'restringir',
        aplicadaAutomaticamente: false,
      });
    });

    it('una excepción de la cuenta manda sobre la general, y solo para esa cuenta', async () => {
      await fijarExcepcion(a, 'incidente.reincidencia_minimo', 1);
      const deA = await incidente(arbol.miembro1, hace(0));
      expect((await confirmar(deA)).reincidencia).toMatchObject({
        minimo: 1,
        propuesta: 'restringir',
      });

      const arbolB = await armarArbol(prueba.pool, b);
      const adminB = principalDe(
        b,
        b.administrador,
        b.rolAdministradorId,
        PERMISOS_DE_ADMINISTRADOR,
      );
      const deB = await incidente(arbolB.miembro1, hace(0), 'uso_masivo', b);
      const resultado = await confirmar(deB, adminB);
      expect(resultado.reincidencia).toMatchObject({ minimo: 3, propuesta: null });
    });

    it('descartar después un incidente confirmado lo saca de la cuenta', async () => {
      const ids = [
        await incidente(arbol.miembro1, hace(2)),
        await incidente(arbol.miembro1, hace(1)),
        await incidente(arbol.miembro1, hace(0)),
      ];
      await confirmar(en(ids, 0));
      await confirmar(en(ids, 1));
      await comoApi(admin, () =>
        resolverIncidente(
          prueba.pool,
          admin,
          en(ids, 0),
          { resultado: 'descartado', motivo: 'falso positivo' },
          AHORA,
        ),
      );
      const resultado = await confirmar(en(ids, 2));
      expect(resultado.reincidencia).toMatchObject({ confirmados: 2, propuesta: null });
    });

    it('dos confirmaciones simultáneas de un mismo usuario no se pierden la reincidencia una a la otra', async () => {
      await fijarConfiguracion('incidente.reincidencia_minimo', 2);
      const uno = await incidente(arbol.miembro1, hace(1));
      const dos = await incidente(arbol.miembro1, hace(0));
      const [x, y] = await Promise.all([confirmar(uno), confirmar(dos)]);
      const confirmadosVistos = [x.reincidencia?.confirmados, y.reincidencia?.confirmados].sort();
      expect(confirmadosVistos).toEqual([1, 2]);
      expect(
        [x.reincidencia?.propuesta, y.reincidencia?.propuesta].filter((p) => p === 'restringir'),
      ).toHaveLength(1);
    });
  });

  describe('qué se propone', () => {
    it('reincidencia estando restringido propone suspender (severidad crítica) y no lo aplica', async () => {
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'restringido', estado_desde = NOW(3), estado_motivo = 'prueba', estado_impuesto_por = ? WHERE id = ?",
        [arbol.titular1.id, arbol.miembro1.id],
      );
      await fijarConfiguracion('incidente.reincidencia_minimo', 1);
      const resultado = await confirmar(await incidente(arbol.miembro1, hace(0)));
      expect(resultado.reincidencia).toMatchObject({
        propuesta: 'suspender',
        aplicadaAutomaticamente: false,
      });
      expect((await estadoDe(arbol.miembro1)).estado).toBe('restringido');
      const cola = await propuestasEnCola();
      expect(cola.length).toBeGreaterThan(0);
      for (const fila of cola) expect(objeto(fila.carga).severidad).toBe('critica');
    });

    it('perdida_o_robo confirmado propone suspender y anular sus QR, sin esperar el umbral, y no toca nada', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, arbol.miembro1.id, [a.puertaPrincipal.id]);
      const sesion = await iniciarSesion(prueba.app, arbol.miembro1.pin);
      const resultado = await confirmar(await incidente(arbol.miembro1, hace(0), 'perdida_o_robo'));
      expect(resultado.reincidencia).toMatchObject({
        confirmados: 1,
        propuesta: 'suspender_y_anular',
        aplicadaAutomaticamente: false,
      });
      // Sigue activo, con su QR vigente y su sesión viva: eso lo decide una persona.
      expect((await estadoDe(arbol.miembro1)).estado).toBe('activo');
      const [qrs] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT anulado_at FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      expect(qrs[0]?.anulado_at).toBeNull();
      const [sesiones] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM sesiones WHERE usuario_id = ? AND revocada_at IS NULL',
        [arbol.miembro1.id],
      );
      expect(Number(sesiones[0]?.total)).toBeGreaterThan(0);
      expect(
        (
          await prueba.app.inject({
            method: 'GET',
            url: '/api/v1/qr-accesos',
            headers: conUsuario(sesion),
          })
        ).statusCode,
      ).toBe(200);
    });

    it('nunca propone nada a quien ya está suspendido', async () => {
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
        [arbol.miembro1.id],
      );
      const resultado = await confirmar(await incidente(arbol.miembro1, hace(0), 'perdida_o_robo'));
      expect(resultado.reincidencia?.propuesta).toBeNull();
    });
  });

  describe('a quién se avisa (bandeja de W9)', () => {
    async function confirmarTres(usuario: UsuarioDePrueba, quien: PrincipalUsuario = admin) {
      let ultimo: ResultadoDeResolucionDeIncidente | null = null;
      for (const dias of [2, 1, 0]) {
        ultimo = await confirmar(await incidente(usuario, hace(dias)), quien);
      }
      return ultimo;
    }

    it('la propuesta llega al Administrador de la rama y a AGROCOM, no al Titular, y la cuenta B no la ve', async () => {
      const superAdmin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
      const resultado = await confirmarTres(arbol.miembro1);
      expect(resultado?.reincidencia?.propuesta).toBe('restringir');
      await entregar(prueba.pool, AHORA);

      const adminA = await iniciarSesion(prueba.app, a.administrador.pin);
      const adminB = await iniciarSesion(prueba.app, b.administrador.pin);
      const titularSesion = await iniciarSesion(prueba.app, arbol.titular1.pin);
      const bandeja = async (sesion: Sesion) =>
        (
          await prueba.app.inject({
            method: 'GET',
            url: '/api/v1/notificaciones',
            headers: conUsuario(sesion),
          })
        ).json<{
          datos: {
            tipo: string;
            severidad: string;
            datos: { propuesta?: Record<string, unknown> };
          }[];
        }>();

      const delAdmin = (await bandeja(adminA)).datos.filter(
        (n) => n.tipo === 'incidente.propuesta',
      );
      expect(delAdmin).toHaveLength(1);
      expect(delAdmin[0]).toMatchObject({
        severidad: 'aviso',
        datos: {
          propuesta: {
            accion: 'restringir',
            usuario_id: arbol.miembro1.id,
            confirmados: 3,
            minimo: 3,
            ventana_dias: 30,
            aplicada_automaticamente: false,
          },
        },
      });
      expect((await bandeja(adminB)).datos).toEqual([]);
      // El Titular no recibe avisos de la cuenta (no tiene notificaciones.aviso.ver): la ve el Administrador.
      const deTitular = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/notificaciones',
        headers: conUsuario(titularSesion),
      });
      expect(deTitular.statusCode).toBe(403);

      const plataforma = await iniciarSesionDePlataforma(
        prueba.app,
        'lucia.paz',
        superAdmin.contrasena,
      );
      const deAgrocom = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/plataforma/notificaciones',
        headers: conUsuario(plataforma),
      });
      expect(deAgrocom.json<{ datos: { tipo: string; cuenta_id: string }[] }>().datos).toEqual([
        expect.objectContaining({ tipo: 'incidente.propuesta', cuenta_id: a.cuenta.id }),
      ]);
    });

    it('el aviso no lleva tokens ni hashes: solo ids y recuentos', async () => {
      const qr = await crearQr(prueba.pool, a.cuenta, arbol.miembro1.id, [a.puertaPrincipal.id]);
      await confirmarTres(arbol.miembro1);
      await entregar(prueba.pool, AHORA);
      const [filas] = await prueba.pool.query<RowDataPacket[]>('SELECT datos FROM notificaciones');
      const texto = JSON.stringify(filas);
      expect(texto).not.toContain(qr.texto);
      expect(texto).not.toMatch(/token|hash|pin/i);
    });

    it('el incidente de un Administrador no lo resuelve otro Administrador (404): cada uno ve solo su rama (ADR 0028 §4)', async () => {
      const segundoAdmin = await crearUsuarioConPin(prueba.pool, a.cuenta, 'AD02', [
        a.rolAdministradorId,
      ]);
      const id = await incidente(segundoAdmin, hace(0));
      await expect(confirmar(id)).rejects.toMatchObject({
        code: 'incidente.no_encontrado',
        status: 404,
      });
      expect(await propuestasEnCola()).toEqual([]);
    });

    it('un Titular que confirma el incidente de su Miembro propone al Administrador, no a sí mismo', async () => {
      await confirmarTres(arbol.miembro1, titular);
      const cola = await propuestasEnCola();
      const deCuenta = cola.filter((fila) => fila.audiencia === 'cuenta');
      expect(deCuenta.length).toBeGreaterThan(0);
      for (const fila of deCuenta) {
        const destinatarios = objeto(fila.carga).soloPara as string[];
        expect(destinatarios).toContain(a.administrador.id);
        expect(destinatarios).toContain(arbol.titular1.id);
        expect(destinatarios).not.toContain(arbol.miembro1.id);
      }
    });
  });

  describe('restricción automática (opcional por cuenta, apagada por omisión, solo el nivel leve)', () => {
    it('apagada: al cruzar el umbral solo propone, aunque haya reincidencia', async () => {
      for (const dias of [2, 1, 0]) await confirmar(await incidente(arbol.miembro1, hace(dias)));
      expect((await estadoDe(arbol.miembro1)).estado).toBe('activo');
    });

    it('encendida en la cuenta: restringe sola en la misma transacción, con origen sistema', async () => {
      await fijarExcepcion(a, 'incidente.restriccion_automatica', 1);
      const sesion = await iniciarSesion(prueba.app, arbol.miembro1.pin);
      const qr = await crearQr(prueba.pool, a.cuenta, arbol.miembro1.id, [a.puertaPrincipal.id]);
      // Contraste: no los registró una sola persona (el Titular y el Administrador).
      let ultimo: ResultadoDeResolucionDeIncidente | null = null;
      let ultimoId = '';
      for (const [dias, registrador] of [
        [2, arbol.titular1.id],
        [1, a.administrador.id],
        [0, a.administrador.id],
      ] as const) {
        ultimoId = await incidente(arbol.miembro1, hace(dias), 'uso_masivo', a, registrador);
        ultimo = await confirmar(ultimoId);
      }
      expect(ultimo?.reincidencia).toMatchObject({
        propuesta: 'restringir',
        aplicadaAutomaticamente: true,
      });

      expect(await estadoDe(arbol.miembro1)).toMatchObject({
        estado: 'restringido',
        // Queda a nombre de su superior directo: él (o quien esté sobre él) puede levantarlo.
        estado_impuesto_por: arbol.titular1.id,
        // La bitácora dice QUÉ incidente la provocó (MEDIA-1 de la auditoría de W11).
        estado_motivo: `incidente.reincidencia:${ultimoId}`,
      });
      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id, origen, despues FROM bitacoras WHERE tabla = 'usuarios' AND registro_id = ? AND JSON_EXTRACT(despues, '$.estado') = 'restringido'",
        [arbol.miembro1.id],
      );
      expect(bitacora).toEqual([expect.objectContaining({ usuario_id: null, origen: 'sistema' })]);
      expect(JSON.stringify(bitacora[0]?.despues)).toContain(`incidente.reincidencia:${ultimoId}`);

      // Nivel leve: la sesión sigue abierta, consulta, y su QR vigente sigue vivo; pero ya no genera.
      expect(
        (
          await prueba.app.inject({
            method: 'GET',
            url: '/api/v1/qr-accesos',
            headers: conUsuario(sesion),
          })
        ).statusCode,
      ).toBe(200);
      const [qrs] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT anulado_at FROM qr_accesos WHERE id = ?',
        [qr.id],
      );
      expect(qrs[0]?.anulado_at).toBeNull();
      const genera = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/qr-accesos',
        headers: conUsuario(sesion),
        payload: { puerta_ids: [a.puertaPrincipal.id] },
      });
      expect(genera.statusCode).toBe(403);
      expect(genera.json<Problema>().code).toBe('qr.generacion_restringida');
    });

    it('su superior directo y el Administrador pueden levantar la restricción que puso el sistema; un par no', async () => {
      await fijarExcepcion(a, 'incidente.restriccion_automatica', 1);
      await confirmarConContraste(arbol.miembro1);
      const reactivar = (sesion: Sesion) =>
        prueba.app.inject({
          method: 'POST',
          url: `/api/v1/usuarios/${arbol.miembro1.id}/reactivacion`,
          headers: conUsuario(sesion),
        });
      const delTitular = await iniciarSesion(prueba.app, arbol.titular1.pin);
      const otroTitular = await iniciarSesion(prueba.app, arbol.titular2.pin);
      expect((await reactivar(otroTitular)).statusCode).toBe(404);
      expect((await reactivar(delTitular)).statusCode).toBe(204);
      expect((await estadoDe(arbol.miembro1)).estado).toBe('activo');
    });

    it('nunca suspende: con el usuario ya restringido y reincidencia solo propone suspender', async () => {
      await fijarExcepcion(a, 'incidente.restriccion_automatica', 1);
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'restringido', estado_desde = NOW(3), estado_motivo = 'manual', estado_impuesto_por = ? WHERE id = ?",
        [arbol.titular1.id, arbol.miembro1.id],
      );
      let ultimo: ResultadoDeResolucionDeIncidente | null = null;
      for (const dias of [2, 1, 0])
        ultimo = await confirmar(await incidente(arbol.miembro1, hace(dias)));
      expect(ultimo?.reincidencia).toMatchObject({
        propuesta: 'suspender',
        aplicadaAutomaticamente: false,
      });
      expect((await estadoDe(arbol.miembro1)).estado).toBe('restringido');
    });

    it('perdida_o_robo no se aplica solo, aunque la cuenta tenga la restricción automática', async () => {
      await fijarExcepcion(a, 'incidente.restriccion_automatica', 1);
      const resultado = await confirmar(await incidente(arbol.miembro1, hace(0), 'perdida_o_robo'));
      expect(resultado.reincidencia).toMatchObject({
        propuesta: 'suspender_y_anular',
        aplicadaAutomaticamente: false,
      });
      expect((await estadoDe(arbol.miembro1)).estado).toBe('activo');
    });

    it('si todos los confirmados los registró una MISMA persona, solo propone: la restricción automática pide contraste', async () => {
      await fijarExcepcion(a, 'incidente.restriccion_automatica', 1);
      let ultimo: ResultadoDeResolucionDeIncidente | null = null;
      // `incidente()` registra siempre a nombre del Administrador: una sola persona.
      for (const dias of [2, 1, 0])
        ultimo = await confirmar(await incidente(arbol.miembro1, hace(dias)));
      expect(ultimo?.reincidencia).toMatchObject({
        propuesta: 'restringir',
        aplicadaAutomaticamente: false,
      });
      expect((await estadoDe(arbol.miembro1)).estado).toBe('activo');
    });

    it('los confirmados del sistema (sin autor) no cuentan como «una sola persona»', async () => {
      await fijarExcepcion(a, 'incidente.restriccion_automatica', 1);
      let ultimo: ResultadoDeResolucionDeIncidente | null = null;
      for (const dias of [2, 1, 0])
        ultimo = await confirmar(
          await incidente(arbol.miembro1, hace(dias), 'uso_masivo', a, null),
        );
      expect(ultimo?.reincidencia).toMatchObject({ aplicadaAutomaticamente: true });
      expect((await estadoDe(arbol.miembro1)).estado).toBe('restringido');
    });

    it('nunca restringe a un Titular: arrastraría a toda su rama (aunque la cuenta lo habilite y haya contraste)', async () => {
      await fijarExcepcion(a, 'incidente.restriccion_automatica', 1);
      let ultimo: ResultadoDeResolucionDeIncidente | null = null;
      for (const [dias, registrador] of [
        [2, a.administrador.id],
        [1, null],
        [0, null],
      ] as const)
        ultimo = await confirmar(
          await incidente(arbol.titular1, hace(dias), 'uso_masivo', a, registrador),
        );
      expect(ultimo?.reincidencia).toMatchObject({
        propuesta: 'restringir',
        aplicadaAutomaticamente: false,
      });
      expect((await estadoDe(arbol.titular1)).estado).toBe('activo');
      expect((await estadoDe(arbol.miembro1)).estado).toBe('activo');
    });

    it('defensa en profundidad: restringirComoSistema se niega por sí sola con un Administrador o un Titular, y también con un rol sin nivel', async () => {
      const sinNivel = await crearUsuarioConPin(
        prueba.pool,
        a.cuenta,
        'RX01',
        [await crearRol(prueba.pool, a.cuenta, 'Auditor', ['accesos.qr.ver'])],
        { superiorId: a.administrador.id },
      );
      const intentar = async (usuario: UsuarioDePrueba) =>
        ContextoCuenta.ejecutarEn(a.cuenta.id, () =>
          enTransaccion(prueba.pool, (tx) =>
            crearServicioDeArbol(prueba.pool).restringirComoSistema(
              tx,
              usuario.id,
              'incidente.reincidencia:1',
              AHORA,
            ),
          ),
        );
      expect(await intentar(a.administrador)).toBe('sin_cambio');
      expect(await intentar(arbol.titular1)).toBe('sin_cambio');
      expect(await intentar(sinNivel)).toBe('sin_cambio');
      expect(await intentar(arbol.guardia)).toBe('aplicada');
      expect(await intentar(arbol.miembro1)).toBe('aplicada');
      expect((await estadoDe(a.administrador)).estado).toBe('activo');
      expect((await estadoDe(arbol.titular1)).estado).toBe('activo');
      expect((await estadoDe(sinNivel)).estado).toBe('activo');
    });

    it('encenderla en la cuenta A no la enciende en la cuenta B', async () => {
      await fijarExcepcion(a, 'incidente.restriccion_automatica', 1);
      const arbolB = await armarArbol(prueba.pool, b);
      const adminB = principalDe(
        b,
        b.administrador,
        b.rolAdministradorId,
        PERMISOS_DE_ADMINISTRADOR,
      );
      for (const dias of [2, 1, 0])
        await confirmar(await incidente(arbolB.miembro1, hace(dias), 'uso_masivo', b), adminB);
      expect((await estadoDe(arbolB.miembro1)).estado).toBe('activo');
    });
  });

  it('confirmar un incidente de otra cuenta no existe (404) y no cuenta para nadie', async () => {
    const arbolB = await armarArbol(prueba.pool, b);
    const deB = await incidente(arbolB.miembro1, hace(0), 'uso_masivo', b);
    await expect(confirmar(deB)).rejects.toMatchObject({
      code: 'incidente.no_encontrado',
      status: 404,
    });
    expect(await contarFilas(prueba.pool, 'resoluciones_de_incidente')).toBe(0);
  });
});
