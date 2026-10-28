import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearQr, crearSuperAdmin, type Escenario } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  type Problema,
} from '../helpers/http.js';
import { evento, marcaDeBolsa } from '../helpers/senales.js';

const HORA = 3_600_000;
const DIA = 24 * HORA;

interface Consumo {
  cuenta: { id: string; codigo: string };
  plan: string | null;
  usado: number;
  tope: number | null;
  porcentaje: number | null;
  estado: string;
  origen_del_tope: string | null;
  aviso_at: string | null;
  superada_at: string | null;
}
interface ListadoDeConsumo {
  datos: Consumo[];
  meta: {
    pagina: number;
    por_pagina: number;
    total: number;
    mes: string;
    desde: string;
    aviso_porcentaje: number;
    por_estado: Record<string, number>;
  };
}
interface Senal {
  id: string;
  cuenta: { id: string; codigo: string; nombre: string };
  usuario: { id: string; etiqueta: string | null };
  tipo: string;
  gravedad: string;
  descripcion: string | null;
  evidencia: { qr_ids: string[]; evento_acceso_ids: string[]; evento_limite_ids: string[] };
  estado: string;
  ocurrido_at: string;
}
interface ListadoDeSenales {
  datos: Senal[];
  meta: { total: number; pagina: number; por_pagina: number };
}
interface DiaDeFlujo {
  dia: string;
  aperturas: number;
  rechazos: number;
  generados: number;
  por_usuario: number;
  atipico: boolean;
  base: number | null;
  veces_la_base: number | null;
}

describe('la vista de AGROCOM: consumo de la bolsa, señales abiertas y flujo atípico (ADR 0030 §5, W12)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let c: Escenario;
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
    c = await crearEscenario(prueba.pool, 'CCC');
    arbol = await armarArbol(prueba.pool, a);
    arbolB = await armarArbol(prueba.pool, b);
    const sa = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    superAcceso = (await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', sa.contrasena)).acceso;
    adminA = (await iniciarSesion(prueba.app, a.administrador.pin)).acceso;
  });

  const get = (url: string, acceso?: string) =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1${url}`,
      ...(acceso === undefined ? {} : { headers: conUsuario({ acceso }) }),
    });
  const json = async <T>(url: string): Promise<T> => {
    const r = await get(url, superAcceso);
    expect(r.statusCode, r.body).toBe(200);
    return r.json<T>();
  };
  const rutas = [
    ['/plataforma/consumo-de-bolsa', 'limites.consumo.ver'],
    [`/plataforma/cuentas/\${A}/consumo-de-bolsa`, 'limites.consumo.ver'],
    ['/plataforma/senales', 'seguridad.senal.ver'],
    ['/plataforma/senales/resumen', 'seguridad.senal.ver'],
    ['/plataforma/flujo-de-cuentas', 'seguridad.senal.ver'],
    [`/plataforma/cuentas/\${A}/flujo`, 'seguridad.senal.ver'],
  ] as const;

  describe('permisos: solo el super admin con el permiso de plataforma', () => {
    for (const [plantilla, permiso] of rutas) {
      it(`${plantilla.replace('${A}', ':cuenta_id')}: 401 sin sesión o con un token de cuenta, 403 sin ${permiso}`, async () => {
        const url = plantilla.replace('${A}', a.cuenta.id);
        expect((await get(url)).statusCode).toBe(401);
        // Un rol de cuenta, ni el Administrador propietario, alcanza una ruta de plataforma.
        const deCuenta = await get(url, adminA);
        expect(deCuenta.statusCode).toBe(401);
        expect(deCuenta.json<Problema>().code).toBe('autenticacion.requerida');

        expect((await get(url, superAcceso)).statusCode).toBe(200);

        await prueba.pool.query(
          'DELETE rp FROM rol_permisos AS rp JOIN permisos AS p ON p.id = rp.permiso_id WHERE p.codigo = ?',
          [permiso],
        );
        const sa = await crearSuperAdmin(prueba.pool, 'sin.permiso');
        const sesion = await iniciarSesionDePlataforma(prueba.app, 'sin.permiso', sa.contrasena);
        const sinPermiso = await get(url, sesion.acceso);
        expect(sinPermiso.statusCode).toBe(403);
        expect(sinPermiso.json<Problema>().code).toBe('permiso.denegado');
      });
    }

    it('los permisos son de ámbito plataforma y ningún rol de cuenta los tiene', async () => {
      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT codigo, ambito FROM permisos WHERE codigo IN ('limites.consumo.ver', 'seguridad.senal.ver')",
      );
      expect(filas.map((f) => String(f.ambito))).toEqual(['plataforma', 'plataforma']);
      const [deCuenta] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM rol_permisos AS rp JOIN permisos AS p ON p.id = rp.permiso_id JOIN roles AS r ON r.id = rp.rol_id WHERE p.codigo IN ('limites.consumo.ver', 'seguridad.senal.ver') AND r.tenant_id IS NOT NULL",
      );
      expect(Number(deCuenta[0]?.total)).toBe(0);
    });

    it('son de solo lectura: ningún método de escritura existe en estas rutas', async () => {
      for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        const r = await prueba.app.inject({
          method: metodo,
          url: '/api/v1/plataforma/senales',
          headers: conUsuario({ acceso: superAcceso }),
          payload: {},
        });
        expect(r.statusCode).toBe(404);
      }
    });

    it('lleva Cache-Control no-store y Vary: Authorization (ADR 0033 §2)', async () => {
      const r = await get('/plataforma/senales', superAcceso);
      expect(r.headers['cache-control']).toContain('no-store');
      expect(String(r.headers.vary)).toContain('Authorization');
    });
  });

  describe('consumo de la bolsa', () => {
    /** `n` QR generados ahora (este mes) por el usuario de la cuenta. */
    async function generar(escenario: Escenario, generadorId: string, n: number) {
      for (let i = 0; i < n; i++) {
        await crearQr(prueba.pool, escenario.cuenta, generadorId, [escenario.puertaPrincipal.id]);
      }
    }
    beforeEach(async () => {
      // A: bolsa de 10 por excepción de la cuenta, 9 QR (90 %); C: bolsa de 20 por plan, 21 QR (105 %);
      // B: la general de 5000, 2 QR.
      await prueba.pool.query(
        "INSERT INTO excepciones_de_limite (tenant_id, usuario_id, clave, valor) VALUES (?, NULL, 'qr.bolsa_mensual', 10)",
        [a.cuenta.id],
      );
      await prueba.pool.query("UPDATE planes SET bolsa_qr_mensual = 20 WHERE nombre = 'Plan CCC'");
      await generar(a, arbol.miembro1.id, 9);
      await generar(b, arbolB.miembro1.id, 2);
      await generar(c, c.usuario.id, 21);
    });

    it('lista el ranking: usado, tope, porcentaje, estado y de dónde sale la bolsa', async () => {
      const lista = await json<ListadoDeConsumo>('/plataforma/consumo-de-bolsa');
      expect(lista.datos.map((x) => x.cuenta.codigo)).toEqual(['CCC', 'AAA', 'BBB']);
      expect(lista.datos[0]).toMatchObject({
        usado: 21,
        tope: 20,
        porcentaje: 105,
        estado: 'superada',
        origen_del_tope: 'plan',
        plan: 'Plan CCC',
      });
      expect(lista.datos[1]).toMatchObject({
        usado: 9,
        tope: 10,
        porcentaje: 90,
        estado: 'aviso',
        origen_del_tope: 'excepcion',
      });
      expect(lista.datos[2]).toMatchObject({
        usado: 2,
        tope: 5000,
        porcentaje: 0,
        estado: 'normal',
        origen_del_tope: 'general',
      });
      expect(lista.meta).toMatchObject({
        total: 3,
        pagina: 1,
        por_pagina: 25,
        aviso_porcentaje: 80,
        por_estado: { normal: 1, aviso: 1, superada: 1, sin_tope: 0 },
      });
      expect(lista.meta.mes).toMatch(/^\d{4}-\d{2}$/);
      expect(lista.meta.desde).toMatch(/Z$/);
    });

    it('filtra por estado, busca por código o nombre, ordena y pagina', async () => {
      expect(
        (await json<ListadoDeConsumo>('/plataforma/consumo-de-bolsa?estado=aviso')).datos.map(
          (x) => x.cuenta.codigo,
        ),
      ).toEqual(['AAA']);
      expect(
        (await json<ListadoDeConsumo>('/plataforma/consumo-de-bolsa?buscar=bbb')).datos.map(
          (x) => x.cuenta.codigo,
        ),
      ).toEqual(['BBB']);
      expect(
        (
          await json<ListadoDeConsumo>('/plataforma/consumo-de-bolsa?orden=usado&sentido=asc')
        ).datos.map((x) => x.usado),
      ).toEqual([2, 9, 21]);
      const pagina2 = await json<ListadoDeConsumo>(
        '/plataforma/consumo-de-bolsa?por_pagina=2&pagina=2',
      );
      expect(pagina2.datos.map((x) => x.cuenta.codigo)).toEqual(['BBB']);
      expect(pagina2.meta).toMatchObject({ total: 3, pagina: 2, por_pagina: 2 });
      // El conteo por estado no depende del filtro de estado.
      expect(
        (await json<ListadoDeConsumo>('/plataforma/consumo-de-bolsa?estado=normal')).meta
          .por_estado,
      ).toEqual({ normal: 1, aviso: 1, superada: 1, sin_tope: 0 });
    });

    it('parámetros inválidos son 400 y un orden inventado no se interpola en el SQL', async () => {
      for (const consulta of [
        'orden=usado;DROP TABLE cuentas',
        "estado=' OR 1=1",
        'por_pagina=1000',
        'pagina=0',
        'buscar=%27%20OR%201%3D1',
      ]) {
        const r = await get(`/plataforma/consumo-de-bolsa?${consulta}`, superAcceso);
        // Un `buscar` raro es solo un texto que no coincide con nada; los demás son 400.
        expect([200, 400], consulta).toContain(r.statusCode);
        if (r.statusCode === 200) expect(r.json<ListadoDeConsumo>().datos).toEqual([]);
      }
      const cuentas = await prueba.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM cuentas');
      expect(Number(cuentas[0][0]?.n)).toBe(3);
    });

    it('muestra cuándo se marcó el aviso y cuándo se pasó de la bolsa este mes', async () => {
      await marcaDeBolsa(prueba.pool, a.cuenta, arbol.miembro1.id, {
        tipo: 'bolsa.aviso',
        claveUnica: 'bolsa.aviso:mes',
        cuando: new Date(),
        valor: 8,
        tope: 10,
      });
      const lista = await json<ListadoDeConsumo>('/plataforma/consumo-de-bolsa?estado=aviso');
      expect(lista.datos[0]?.aviso_at).toMatch(/Z$/);
      expect(lista.datos[0]?.superada_at).toBeNull();
    });

    it('el detalle de una cuenta trae los QR generados por día del mes en curso', async () => {
      const detalle = await json<
        Consumo & { serie: { dia: string; generados: number }[]; mes: string }
      >(`/plataforma/cuentas/${a.cuenta.id}/consumo-de-bolsa`);
      expect(detalle).toMatchObject({
        usado: 9,
        tope: 10,
        estado: 'aviso',
        cuenta: { codigo: 'AAA' },
      });
      expect(detalle.serie.at(-1)?.generados).toBe(9);
      expect(detalle.serie.reduce((suma, d) => suma + d.generados, 0)).toBe(9);
      expect(detalle.serie.every((d) => d.dia.startsWith(detalle.mes))).toBe(true);
      const r = await get('/plataforma/cuentas/999999/consumo-de-bolsa', superAcceso);
      expect(r.statusCode).toBe(404);
      expect(r.json<Problema>().code).toBe('cuenta.no_encontrada');
    });

    it('una cuenta sin bolsa que comparar queda en sin_tope, al final de la lista', async () => {
      await prueba.pool.query("DELETE FROM configuracion_limites WHERE clave = 'qr.bolsa_mensual'");
      await prueba.pool.query(
        "UPDATE planes SET bolsa_qr_mensual = NULL WHERE nombre = 'Plan CCC'",
      );
      const lista = await json<ListadoDeConsumo>('/plataforma/consumo-de-bolsa');
      expect(lista.datos.map((x) => [x.cuenta.codigo, x.estado])).toEqual([
        ['AAA', 'aviso'],
        ['BBB', 'sin_tope'],
        ['CCC', 'sin_tope'],
      ]);
      expect(lista.datos[1]).toMatchObject({ tope: null, porcentaje: null, origen_del_tope: null });
    });
  });

  describe('señales abiertas', () => {
    let n = 0;
    async function incidente(
      escenario: Escenario,
      usuarioId: string,
      datos: {
        tipo?: string;
        gravedad?: string;
        origen?: 'sistema' | 'persona';
        cuando?: Date;
      } = {},
    ): Promise<string> {
      n += 1;
      const origen = datos.origen ?? 'sistema';
      const [r] = await prueba.pool.query(
        'INSERT INTO incidentes_uso (tenant_id, usuario_id, tipo, gravedad, origen, registrado_por, descripcion, evidencia, clave_unica, ocurrido_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          escenario.cuenta.id,
          usuarioId,
          datos.tipo ?? 'uso_masivo',
          datos.gravedad ?? 'media',
          origen,
          origen === 'persona' ? escenario.administrador.id : null,
          'aperturas=13;umbral=12',
          JSON.stringify({ qr_ids: ['7'], evento_acceso_ids: ['8', '9'], evento_limite_ids: [] }),
          origen === 'sistema' ? `clave-${String(n)}` : null,
          datos.cuando ?? new Date(),
        ],
      );
      return String((r as { insertId: number }).insertId);
    }
    const resolver = (escenario: Escenario, incidenteId: string, resultado: string) =>
      prueba.pool.query(
        'INSERT INTO resoluciones_de_incidente (tenant_id, incidente_id, resultado, motivo, resuelto_por, resuelta_at) VALUES (?, ?, ?, ?, ?, NOW(3))',
        [
          escenario.cuenta.id,
          incidenteId,
          resultado,
          resultado === 'confirmado' ? 'motivo' : null,
          escenario.administrador.id,
        ],
      );

    it('lista las del sistema de TODAS las cuentas, las más recientes primero, con cuenta y usuario', async () => {
      const i1 = await incidente(a, arbol.guardia.id, { cuando: new Date(Date.now() - 3 * HORA) });
      const i2 = await incidente(b, arbolB.miembro1.id, { tipo: 'qr_reenviado', gravedad: 'alta' });
      await incidente(a, arbol.miembro1.id, { origen: 'persona' }); // a mano: no es una señal del sistema
      const lista = await json<ListadoDeSenales>('/plataforma/senales');
      expect(lista.datos.map((s) => s.id)).toEqual([i2, i1]);
      expect(lista.meta.total).toBe(2);
      expect(lista.datos[0]).toMatchObject({
        tipo: 'qr_reenviado',
        gravedad: 'alta',
        estado: 'sin_resolver',
        cuenta: { id: b.cuenta.id, codigo: 'BBB' },
        usuario: { id: arbolB.miembro1.id, etiqueta: expect.any(String) as string },
        descripcion: 'aperturas=13;umbral=12',
        evidencia: { qr_ids: ['7'], evento_acceso_ids: ['8', '9'], evento_limite_ids: [] },
      });
    });

    it('filtra por cuenta, usuario, tipo, gravedad, estado y fechas', async () => {
      const i1 = await incidente(a, arbol.guardia.id, { cuando: new Date(Date.now() - 3 * DIA) });
      const i2 = await incidente(a, arbol.miembro1.id, {
        tipo: 'pin_compartido',
        gravedad: 'alta',
      });
      const i3 = await incidente(b, arbolB.guardia.id);
      await resolver(a, i2, 'descartado');
      const ids = async (consulta: string) =>
        (await json<ListadoDeSenales>(`/plataforma/senales?${consulta}`)).datos.map((s) => s.id);
      expect(await ids(`cuenta_id=${a.cuenta.id}`)).toEqual([i2, i1]);
      expect(await ids(`usuario_id=${arbolB.guardia.id}`)).toEqual([i3]);
      expect(await ids('tipo=pin_compartido')).toEqual([i2]);
      expect(await ids('gravedad=alta')).toEqual([i2]);
      expect(await ids('estado=descartado')).toEqual([i2]);
      expect(await ids('estado=sin_resolver')).toEqual([i3, i1]);
      // «abiertas» deja las que nadie decidió (sin resolver o pendientes), no las descartadas ni confirmadas.
      await resolver(b, i3, 'pendiente');
      expect(await ids('estado=abiertas')).toEqual([i3, i1]);
      await resolver(b, i3, 'confirmado');
      expect(await ids('estado=abiertas')).toEqual([i1]);
      const desde = new Date(Date.now() - 1 * DIA).toISOString();
      expect(await ids(`desde=${encodeURIComponent(desde)}`)).toEqual([i3, i2]);
      expect(await ids(`hasta=${encodeURIComponent(desde)}`)).toEqual([i1]);
      expect(await ids('por_pagina=1&pagina=2')).toEqual([i2]);
    });

    it('un id inválido es 400 y no se interpola nada', async () => {
      for (const consulta of ["cuenta_id=1' OR '1'='1", 'tipo=inventado', 'estado=cualquiera']) {
        expect((await get(`/plataforma/senales?${consulta}`, superAcceso)).statusCode).toBe(400);
      }
    });

    it('no expone tokens, hashes, PIN ni IP', async () => {
      await incidente(a, arbol.guardia.id);
      const r = await get('/plataforma/senales', superAcceso);
      expect(r.body).not.toMatch(/token|hash|pin_|refresh|ip"/i);
    });

    it('el resumen cuenta por tipo y por cuenta en la ventana', async () => {
      await incidente(a, arbol.guardia.id);
      await incidente(a, arbol.miembro1.id, { tipo: 'uso_imposible', gravedad: 'alta' });
      await incidente(b, arbolB.guardia.id);
      const viejo = await incidente(b, arbolB.miembro1.id, {
        cuando: new Date(Date.now() - 20 * DIA),
      });
      await resolver(b, viejo, 'confirmado');
      const resumen = await json<{
        total: number;
        abiertas: number;
        dias: number;
        por_tipo: { tipo: string; total: number; abiertas: number; altas: number }[];
        cuentas: { cuenta: { codigo: string }; total: number; abiertas: number; altas: number }[];
      }>('/plataforma/senales/resumen?dias=7');
      expect(resumen).toMatchObject({ total: 3, abiertas: 3, dias: 7 });
      expect(resumen.por_tipo).toEqual([
        { tipo: 'uso_masivo', total: 2, abiertas: 2, altas: 0 },
        { tipo: 'uso_imposible', total: 1, abiertas: 1, altas: 1 },
      ]);
      expect(resumen.cuentas.map((x) => [x.cuenta.codigo, x.total, x.altas])).toEqual([
        ['AAA', 2, 1],
        ['BBB', 1, 0],
      ]);
      const largo = await json<{ total: number }>('/plataforma/senales/resumen?dias=30');
      expect(largo.total).toBe(4);
      expect((await get('/plataforma/senales/resumen?dias=0', superAcceso)).statusCode).toBe(400);
      expect((await get('/plataforma/senales/resumen?dias=91', superAcceso)).statusCode).toBe(400);
    });
  });

  describe('flujo atípico', () => {
    /** `n` aperturas por QR en la puerta principal de la cuenta, `hace` ms antes de ahora, una cada 5 s. */
    async function flujo(escenario: Escenario, n: number, haceMs = 0) {
      const base = Date.now() - haceMs;
      for (let i = 0; i < n; i++) {
        await evento(prueba.pool, escenario.cuenta, {
          puertaId: escenario.puertaPrincipal.id,
          dispositivoId: escenario.dispositivoPrincipal.id,
          cuando: new Date(base - i * 1000),
        });
      }
    }
    /** Deja a la cuenta con solo `total` usuarios activos. */
    async function dejarUsuarios(escenario: Escenario, total: number) {
      const [lista] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT id FROM usuarios WHERE tenant_id = ? ORDER BY id',
        [escenario.cuenta.id],
      );
      for (const fila of lista.slice(total)) {
        await prueba.pool.query(
          "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba', estado_impuesto_por = ? WHERE id = ?",
          [escenario.administrador.id, fila.id],
        );
      }
    }

    it('la serie diaria de una cuenta marca el día atípico y trae la base habitual', async () => {
      await dejarUsuarios(a, 2);
      // Cuatro días normales (10 por día) y hoy 60 entre 2 usuarios: 30 por usuario.
      for (let d = 1; d <= 4; d++) await flujo(a, 10, d * DIA);
      await flujo(a, 60, 0);
      const r = await json<{
        cuenta: { codigo: string };
        usuarios_activos: number;
        umbrales: { aperturas_minimo: number; aperturas_por_usuario: number };
        zona_horaria: string;
        serie: DiaDeFlujo[];
      }>(`/plataforma/cuentas/${a.cuenta.id}/flujo?dias=7`);
      expect(r).toMatchObject({
        cuenta: { codigo: 'AAA' },
        usuarios_activos: 2,
        umbrales: { aperturas_minimo: 50, aperturas_por_usuario: 25 },
        zona_horaria: 'America/La_Paz',
      });
      expect(r.serie).toHaveLength(7);
      const hoy = r.serie.at(-1);
      expect(hoy).toMatchObject({ aperturas: 60, por_usuario: 30, atipico: true, base: 10 });
      expect(hoy?.veces_la_base).toBe(6);
      // Los días normales no son atípicos y los vacíos van en cero.
      expect(r.serie.filter((d) => d.atipico)).toHaveLength(1);
      expect(r.serie.some((d) => d.aperturas === 0 && d.generados === 0)).toBe(true);
      // `dias` fuera de rango es 400.
      for (const dias of [0, 91]) {
        expect(
          (await get(`/plataforma/cuentas/${a.cuenta.id}/flujo?dias=${String(dias)}`, superAcceso))
            .statusCode,
        ).toBe(400);
      }
      expect((await get('/plataforma/cuentas/999999/flujo', superAcceso)).statusCode).toBe(404);
    });

    it('incluye los QR generados y los rechazos de cada día', async () => {
      await crearQr(prueba.pool, a.cuenta, arbol.miembro1.id, [a.puertaPrincipal.id]);
      await evento(prueba.pool, a.cuenta, {
        puertaId: a.puertaPrincipal.id,
        dispositivoId: a.dispositivoPrincipal.id,
        resultado: 'rechazado',
        motivo: 'qr.vencido',
        cuando: new Date(),
      });
      const r = await json<{ serie: DiaDeFlujo[] }>(
        `/plataforma/cuentas/${a.cuenta.id}/flujo?dias=1`,
      );
      expect(r.serie).toHaveLength(1);
      expect(r.serie[0]).toMatchObject({ generados: 1, rechazos: 1, aperturas: 0, atipico: false });
    });

    it('la lista ordena las cuentas por aperturas por usuario y filtra las atípicas', async () => {
      await dejarUsuarios(a, 2);
      await flujo(a, 60);
      await flujo(b, 55); // B tiene 8 usuarios activos: ~7 por usuario, tráfico normal
      const lista = await json<{
        datos: {
          cuenta: { codigo: string };
          usuarios_activos: number;
          aperturas_hoy: number;
          por_usuario_hoy: number;
          atipica_hoy: boolean;
          dias_atipicos: number;
          ultimo_dia_atipico: string | null;
        }[];
        meta: { total: number; dias: number; hoy: string };
      }>('/plataforma/flujo-de-cuentas');
      expect(lista.datos.map((x) => x.cuenta.codigo)).toEqual(['AAA', 'BBB', 'CCC']);
      expect(lista.datos[0]).toMatchObject({
        usuarios_activos: 2,
        aperturas_hoy: 60,
        por_usuario_hoy: 30,
        atipica_hoy: true,
        dias_atipicos: 1,
      });
      expect(lista.datos[1]).toMatchObject({
        atipica_hoy: false,
        dias_atipicos: 0,
        ultimo_dia_atipico: null,
      });
      expect(lista.meta).toMatchObject({ total: 3, dias: 7 });
      expect(lista.meta.hoy).toBe(lista.datos[0]?.ultimo_dia_atipico);

      const soloAtipicas = await json<{
        datos: { cuenta: { codigo: string } }[];
        meta: { total: number };
      }>('/plataforma/flujo-de-cuentas?solo_atipicas=true');
      expect(soloAtipicas.datos.map((x) => x.cuenta.codigo)).toEqual(['AAA']);
      expect(soloAtipicas.meta.total).toBe(1);
      const todas = await json<{ meta: { total: number } }>(
        '/plataforma/flujo-de-cuentas?solo_atipicas=false',
      );
      expect(todas.meta.total).toBe(3);
      const porNombre = await json<{ datos: { cuenta: { codigo: string } }[] }>(
        '/plataforma/flujo-de-cuentas?orden=nombre&sentido=asc&por_pagina=2&pagina=2',
      );
      expect(porNombre.datos.map((x) => x.cuenta.codigo)).toEqual(['CCC']);
      expect((await get('/plataforma/flujo-de-cuentas?dias=31', superAcceso)).statusCode).toBe(400);
      expect((await get('/plataforma/flujo-de-cuentas?orden=x', superAcceso)).statusCode).toBe(400);
    });

    it('la excepción de la cuenta cambia el umbral que ve el panel', async () => {
      await prueba.pool.query(
        "INSERT INTO excepciones_de_limite (tenant_id, usuario_id, clave, valor) VALUES (?, NULL, 'senal.flujo_aperturas_por_usuario', 100)",
        [a.cuenta.id],
      );
      await dejarUsuarios(a, 2);
      await flujo(a, 60);
      const r = await json<{
        umbrales: { aperturas_por_usuario: number };
        serie: DiaDeFlujo[];
      }>(`/plataforma/cuentas/${a.cuenta.id}/flujo?dias=1`);
      expect(r.umbrales.aperturas_por_usuario).toBe(100);
      expect(r.serie[0]?.atipico).toBe(false);
    });
  });
});
