import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashDeToken } from '../../src/modules/accesos/domain/token-qr.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { armarArbol, type Arbol } from '../helpers/arbol.js';
import { reiniciarBase } from '../helpers/base.js';
import { contarFilas, crearEscenario, crearQr, type Escenario } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';

/** Un lector de CSV (RFC 4180) para comprobar lo que se exporta celda por celda. */
function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charAt(i);
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\r' && texto[i + 1] === '\n') {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
      i += 1;
    } else {
      celda += c;
    }
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

const FORMULAS = [
  '=HYPERLINK("http://evil.test","clic")',
  "+cmd|' /C calc'!A0",
  '-2+3',
  '@SUM(1+1)',
  '\t=1+1',
];
const empiezaComoFormula = (celda: string) => /^[\t\r\n ]*[=+\-@]/.test(celda);

describe('GET /exportaciones/:recurso: CSV de la cuenta (ADR 0033 §3)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let arbol: Arbol;
  let arbolB: Arbol;
  let admin: Sesion;

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
  });

  const exportar = (sesion: Sesion, recurso: string, consulta = '') =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/exportaciones/${recurso}${consulta}`,
      headers: conUsuario(sesion),
    });

  /** Deja intentos reales: uno permitido y uno rechazado en la puerta principal de A. */
  async function dejarLecturas(escenario: Escenario, generadorId: string) {
    const qr = await crearQr(prueba.pool, escenario.cuenta, generadorId, [
      escenario.puertaPrincipal.id,
    ]);
    const validar = (token: string) =>
      prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: escenario.dispositivoPrincipal.encabezado },
        payload: { token },
      });
    await validar(qr.texto);
    await validar(qr.texto);
    await validar('AQ1.' + 'x'.repeat(40));
    return qr;
  }

  describe('forma de la respuesta', () => {
    it('devuelve text/csv sin caché, con encabezado, adjunto y las cabeceras de paginación', async () => {
      const respuesta = await exportar(admin, 'usuarios');
      expect(respuesta.statusCode, respuesta.body).toBe(200);
      expect(respuesta.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(respuesta.headers['content-disposition']).toBe(
        'attachment; filename="usuarios-p1.csv"',
      );
      expect(respuesta.headers).toMatchObject({
        'x-total-filas': '8',
        'x-pagina': '1',
        'x-por-pagina': '500',
        'x-filas': '8',
        'x-hay-mas': 'false',
        'x-truncado': 'false',
      });
      const filas = leerCsv(respuesta.body);
      expect(filas[0]).toEqual([
        'id',
        'etiqueta',
        'rol',
        'superior_id',
        'estado',
        'estado_motivo',
        'creado_at',
      ]);
      expect(filas).toHaveLength(9);
      expect(respuesta.body.endsWith('\r\n')).toBe(true);
    });

    it('las puertas traen su sitio y las lecturas su puerta, resultado y motivo', async () => {
      await dejarLecturas(a, arbol.miembro1.id);
      const puertas = leerCsv((await exportar(admin, 'puertas')).body);
      expect(puertas[0]).toEqual([
        'id',
        'nombre',
        'sitio_id',
        'sitio',
        'zona_horaria',
        'segundos_apertura',
        'activa',
      ]);
      expect(puertas).toHaveLength(3);
      expect(puertas[1]).toEqual([
        a.puertaPrincipal.id,
        a.puertaPrincipal.nombre,
        a.sitioId,
        `Sitio AAA`,
        'America/La_Paz',
        '6',
        '1',
      ]);

      const lecturas = leerCsv((await exportar(admin, 'lecturas')).body);
      expect(lecturas[0]).toEqual([
        'id',
        'ocurrido_at',
        'puerta_id',
        'puerta',
        'sitio',
        'resultado',
        'motivo_code',
        'ejecucion',
        'qr_id',
        'qr_etiqueta',
        'generador_id',
        'generador',
      ]);
      const motivos = lecturas.slice(1).map((fila) => `${fila[5]}:${fila[6]}`);
      expect(motivos).toEqual([
        'permitido:acceso.permitido',
        'rechazado:qr.usado',
        'rechazado:qr.formato_invalido',
      ]);
      expect(lecturas[1]?.[1]).toMatch(/Z$/);
    });

    it('las lecturas aceptan los filtros del listado (resultado, puerta, ventana)', async () => {
      await dejarLecturas(a, arbol.miembro1.id);
      const rechazadas = leerCsv((await exportar(admin, 'lecturas', '?resultado=rechazado')).body);
      expect(rechazadas.slice(1).every((fila) => fila[5] === 'rechazado')).toBe(true);
      expect(rechazadas).toHaveLength(3);
      const otraPuerta = leerCsv(
        (await exportar(admin, 'lecturas', `?puerta_id=${a.puertaTrasera.id}`)).body,
      );
      expect(otraPuerta).toHaveLength(1);
      const futuro = encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString());
      const sinNada = leerCsv((await exportar(admin, 'lecturas', `?desde=${futuro}`)).body);
      expect(sinNada).toHaveLength(1);
    });

    it('rechaza un recurso desconocido, páginas fuera de rango y filtros inválidos (400)', async () => {
      for (const url of [
        ['pines', ''],
        ['usuarios', '?pagina=0'],
        ['usuarios', '?por_pagina=1001'],
        ['usuarios', '?por_pagina=0'],
        ['usuarios', '?pagina=abc'],
        ['lecturas', '?resultado=todos'],
        ['lecturas', '?desde=ayer'],
      ] as const) {
        const respuesta = await exportar(admin, url[0], url[1]);
        expect(respuesta.statusCode, url.join('')).toBe(400);
        expect(respuesta.json<Problema>().code).toBe('validacion.invalida');
      }
    });
  });

  describe('sin secretos', () => {
    it('ningún recurso trae PIN, hash, token ni credenciales de dispositivo', async () => {
      const qr = await dejarLecturas(a, arbol.miembro1.id);
      // Los usuarios de prueba llevan su PIN en la etiqueta; se les pone un nombre neutro para comprobar que el PIN no sale.
      await prueba.pool.query("UPDATE usuarios SET etiqueta = CONCAT('Persona ', id)");
      const token = qr.texto.replace(/^AQ1\./, '');
      const cuerpos = await Promise.all(
        ['usuarios', 'puertas', 'lecturas'].map(
          async (recurso) => (await exportar(admin, recurso)).body,
        ),
      );
      const secretos = [
        qr.texto,
        token,
        hashDeToken(token),
        a.dispositivoPrincipal.clave,
        a.administrador.pin,
        arbol.miembro1.pin,
        '$argon2',
        'pin_hash',
        'pin_indice',
        'token_hash',
        'clave_hash',
        'contrasena',
      ];
      for (const cuerpo of cuerpos) {
        for (const secreto of secretos) expect(cuerpo, secreto).not.toContain(secreto);
      }
    });
  });

  describe('inyección de fórmulas', () => {
    it('ninguna celda de texto de una persona empieza como fórmula en usuarios, puertas ni lecturas', async () => {
      const qr = await dejarLecturas(a, arbol.miembro1.id);
      for (const [i, formula] of FORMULAS.entries()) {
        await prueba.pool.query('UPDATE usuarios SET etiqueta = ? WHERE id = ?', [
          formula,
          [
            arbol.miembro1.id,
            arbol.miembro1b.id,
            arbol.titular1.id,
            arbol.titular2.id,
            arbol.guardia.id,
          ][i],
        ]);
      }
      await prueba.pool.query(
        "UPDATE usuarios SET estado = 'restringido', estado_desde = NOW(3), estado_motivo = ? WHERE id = ?",
        ['=1+1', arbol.miembro2.id],
      );
      await prueba.pool.query('UPDATE puertas SET nombre = ? WHERE id = ?', [
        FORMULAS[0],
        a.puertaTrasera.id,
      ]);
      await prueba.pool.query('UPDATE sitios SET nombre = ? WHERE id = ?', [
        FORMULAS[2],
        a.sitioId,
      ]);
      await prueba.pool.query('UPDATE qr_accesos SET etiqueta = ? WHERE id = ?', [
        FORMULAS[3],
        qr.id,
      ]);

      for (const recurso of ['usuarios', 'puertas', 'lecturas']) {
        const respuesta = await exportar(admin, recurso);
        const filas = leerCsv(respuesta.body);
        expect(filas.length, recurso).toBeGreaterThan(1);
        for (const fila of filas) {
          for (const celda of fila)
            expect(empiezaComoFormula(celda), `${recurso}: ${celda}`).toBe(false);
        }
      }
      const usuarios = (await exportar(admin, 'usuarios')).body;
      expect(usuarios).toContain("'=HYPERLINK(");
      expect(usuarios).toContain("'@SUM(1+1)");
      const lecturas = leerCsv((await exportar(admin, 'lecturas')).body);
      expect(lecturas.some((fila) => fila.includes("'@SUM(1+1)"))).toBe(true);
    });

    it('una coma, una comilla o un salto de línea en un nombre no corren las columnas ni suman filas', async () => {
      await prueba.pool.query('UPDATE puertas SET nombre = ? WHERE id = ?', [
        'Puerta, "norte"\nlinea 2',
        a.puertaTrasera.id,
      ]);
      const filas = leerCsv((await exportar(admin, 'puertas')).body);
      expect(filas).toHaveLength(3);
      expect(filas.every((fila) => fila.length === 7)).toBe(true);
      expect(filas.find((fila) => fila[0] === a.puertaTrasera.id)?.[1]).toBe(
        'Puerta, "norte"\nlinea 2',
      );
    });
  });

  describe('paginación y tope de filas', () => {
    it('pagina sin repetir ni perder filas, y avisa si hay más', async () => {
      const vistas: string[] = [];
      for (const [pagina, filasEsperadas, hayMas] of [
        [1, 3, 'true'],
        [2, 3, 'true'],
        [3, 2, 'false'],
      ] as const) {
        const respuesta = await exportar(admin, 'usuarios', `?por_pagina=3&pagina=${pagina}`);
        expect(respuesta.headers).toMatchObject({
          'x-total-filas': '8',
          'x-filas': String(filasEsperadas),
          'x-hay-mas': hayMas,
          'x-por-pagina': '3',
          'x-pagina': String(pagina),
        });
        const filas = leerCsv(respuesta.body);
        expect(filas[0]?.[0]).toBe('id');
        vistas.push(...filas.slice(1).map((fila) => fila.at(0) ?? ''));
      }
      expect(new Set(vistas).size).toBe(8);
      expect(vistas).toEqual([...vistas].sort((x, y) => Number(x) - Number(y)));
    });

    it('una página más allá del final es válida y viene vacía (solo el encabezado)', async () => {
      const respuesta = await exportar(admin, 'usuarios', '?por_pagina=10&pagina=5');
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.headers['x-filas']).toBe('0');
      expect(leerCsv(respuesta.body)).toHaveLength(1);
    });

    it('más allá del tope de 10000 filas responde 422 exportacion.tope_excedido y no registra nada', async () => {
      const respuesta = await exportar(admin, 'usuarios', '?por_pagina=1000&pagina=11');
      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('exportacion.tope_excedido');
      expect(await contarFilas(prueba.pool, 'exportaciones')).toBe(0);
      const ultima = await exportar(admin, 'usuarios', '?por_pagina=1000&pagina=10');
      expect(ultima.statusCode).toBe(200);
    });
  });

  describe('bitácora', () => {
    it('cada página descargada deja su constancia: quién, qué recurso, cuántas filas y con qué filtros', async () => {
      await dejarLecturas(a, arbol.miembro1.id);
      await exportar(admin, 'usuarios', '?por_pagina=3');
      await exportar(admin, 'lecturas', '?resultado=rechazado');

      const [filas] = await prueba.pool.query<RowDataPacket[]>(
        'SELECT recurso, pagina, por_pagina, filas, filtros, created_by FROM exportaciones ORDER BY id',
      );
      expect(filas).toHaveLength(2);
      expect(filas[0]).toMatchObject({
        recurso: 'usuarios',
        pagina: 1,
        por_pagina: 3,
        filas: 3,
        filtros: null,
        created_by: a.administrador.id,
      });
      expect(filas[1]).toMatchObject({
        recurso: 'lecturas',
        filas: 2,
        created_by: a.administrador.id,
      });
      const filtros: unknown =
        typeof filas[1]?.filtros === 'string' ? JSON.parse(filas[1].filtros) : filas[1]?.filtros;
      expect(filtros).toMatchObject({ resultado: 'rechazado', puerta_id: null });

      const [bitacora] = await prueba.pool.query<RowDataPacket[]>(
        "SELECT usuario_id, accion, origen, despues FROM bitacoras WHERE tabla = 'exportaciones' ORDER BY id",
      );
      expect(bitacora).toHaveLength(2);
      expect(bitacora[0]).toMatchObject({
        usuario_id: a.administrador.id,
        accion: 'creado',
        origen: 'api',
      });
      expect(JSON.stringify(bitacora[0]?.despues)).toContain('usuarios');
    });

    it('la constancia nunca guarda el contenido exportado', async () => {
      await exportar(admin, 'usuarios');
      const [filas] = await prueba.pool.query<RowDataPacket[]>('SELECT * FROM exportaciones');
      expect(JSON.stringify(filas)).not.toContain(a.administrador.pin);
      expect(JSON.stringify(filas)).not.toContain('Usuario AAAAD01');
    });
  });

  describe('aislamiento y permisos', () => {
    it('la cuenta A solo exporta lo suyo: nada de B en usuarios, puertas ni lecturas', async () => {
      await dejarLecturas(a, arbol.miembro1.id);
      await dejarLecturas(b, arbolB.miembro1.id);
      const adminB = await iniciarSesion(prueba.app, b.administrador.pin);

      const deA = {
        usuarios: leerCsv((await exportar(admin, 'usuarios')).body)
          .slice(1)
          .map((f) => f[0]),
        puertas: leerCsv((await exportar(admin, 'puertas')).body)
          .slice(1)
          .map((f) => f[0]),
        lecturas: leerCsv((await exportar(admin, 'lecturas')).body)
          .slice(1)
          .map((f) => f[0]),
      };
      expect(deA.usuarios).toHaveLength(8);
      expect(deA.usuarios).not.toContain(b.administrador.id);
      expect(deA.usuarios).not.toContain(arbolB.miembro1.id);
      expect(deA.puertas).toEqual([a.puertaPrincipal.id, a.puertaTrasera.id]);
      expect(deA.lecturas).toHaveLength(3);

      const deB = leerCsv((await exportar(adminB, 'lecturas')).body).slice(1);
      expect(deB).toHaveLength(3);
      const idsDeA = new Set(deA.lecturas);
      expect(deB.every((fila) => !idsDeA.has(fila[0]))).toBe(true);
      // Y la constancia queda en la cuenta de quien exportó.
      expect(await contarFilas(prueba.pool, 'exportaciones', 'tenant_id = ?', [b.cuenta.id])).toBe(
        1,
      );
    });

    it('solo el Administrador exporta: el Titular, el Miembro y el Guardia reciben 403', async () => {
      for (const pin of [arbol.titular1.pin, arbol.miembro1.pin, arbol.guardia.pin]) {
        const sesion = await iniciarSesion(prueba.app, pin);
        for (const recurso of ['usuarios', 'puertas', 'lecturas']) {
          const respuesta = await exportar(sesion, recurso);
          expect(respuesta.statusCode, `${pin} ${recurso}`).toBe(403);
          expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
        }
      }
      expect(await contarFilas(prueba.pool, 'exportaciones')).toBe(0);
    });

    it('sin sesión es 401', async () => {
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/exportaciones/usuarios',
      });
      expect(respuesta.statusCode).toBe(401);
    });
  });

  describe('límite de uso (ADR 0030 §3)', () => {
    it('la exportación tiene su propio límite por minuto: pasado el tope, 429 con Retry-After y sin constancia de más', async () => {
      const limitada = await crearAppDePrueba(undefined, { LIMITE_EXPORTACION_POR_MINUTO: '2' });
      try {
        const sesion = await iniciarSesion(limitada.app, a.administrador.pin);
        const pedir = () =>
          limitada.app.inject({
            method: 'GET',
            url: '/api/v1/exportaciones/usuarios',
            headers: conUsuario(sesion),
          });
        expect((await pedir()).statusCode).toBe(200);
        expect((await pedir()).statusCode).toBe(200);
        const tercera = await pedir();
        expect(tercera.statusCode).toBe(429);
        expect(tercera.json<Problema>().code).toBe('limite.excedido');
        expect(Number(tercera.headers['retry-after'])).toBeGreaterThan(0);
        expect(await contarFilas(prueba.pool, 'exportaciones')).toBe(2);
        // Las demás lecturas no pagan por la exportación.
        const lista = await limitada.app.inject({
          method: 'GET',
          url: '/api/v1/qr-accesos',
          headers: conUsuario(sesion),
        });
        expect(lista.statusCode).toBe(200);
      } finally {
        await limitada.cerrar();
      }
    });
  });
});
