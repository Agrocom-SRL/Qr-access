import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ejecutar as abrirPuertaManual } from '../../src/modules/accesos/actions/abrir-puerta-manual.js';
import { ContextoCuenta } from '../../src/platform/contexto/contexto-cuenta.js';
import type { PrincipalUsuario } from '../../src/platform/seguridad/principal.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { cualquierTexto } from '../helpers/esperados.js';
import {
  contarFilas,
  crearDispositivo,
  crearEscenario,
  crearPuerta,
  crearRol,
  crearUsuarioConPin,
  marcarEnLinea,
  type Escenario,
} from '../helpers/fixtures.js';
import { conUsuario, iniciarSesion, type Problema, type Sesion } from '../helpers/http.js';

interface Orden {
  orden_id: string;
  estado: string;
  vence_at: string;
}

interface LecturaManual extends RowDataPacket {
  id: string;
  puerta_id: string;
  usuario_id: string | null;
  dispositivo_id: string | null;
  qr_acceso_id: string | null;
  token_hash: string | null;
  metodo: string;
  resultado: string;
  motivo_code: string;
}

/** Los dos campos que un rechazo expone: el código del problema y, si hay, el detalle. */
interface ProblemaConDetalle extends Problema {
  tipo?: string;
  tope?: number;
  reintentar_en_segundos?: number;
}

describe('POST /api/v1/puertas/{id}/abrir: apertura manual desde la app (ADR 0035)', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesion: Sesion;

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
    // Las placas de prueba nacen sin latido: para el modo manual deben estar «en línea».
    await marcarEnLinea(prueba.pool, a.dispositivoPrincipal.id);
    await marcarEnLinea(prueba.pool, a.dispositivoTrasero.id);
    await marcarEnLinea(prueba.pool, b.dispositivoPrincipal.id);
    sesion = await iniciarSesion(prueba.app, a.usuario.pin);
  });

  const abrir = (puertaId: string, clave: string = randomUUID(), con: Sesion = sesion) =>
    prueba.app.inject({
      method: 'POST',
      url: `/api/v1/puertas/${puertaId}/abrir`,
      headers: { ...conUsuario(con), 'idempotency-key': clave },
    });

  async function lecturasManuales(): Promise<LecturaManual[]> {
    const [filas] = await prueba.pool.query<LecturaManual[]>(
      "SELECT id, puerta_id, usuario_id, dispositivo_id, qr_acceso_id, token_hash, metodo, resultado, motivo_code FROM lecturas WHERE metodo = 'manual' ORDER BY id",
    );
    return filas;
  }

  const ordenes = async () => {
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT * FROM ordenes_apertura ORDER BY id',
    );
    return filas;
  };

  /** Envejece las órdenes `segundos` hacia atrás (creación y plazo juntos: la tabla exige vence <= creada + 30 s). */
  const envejecerOrdenes = (segundos: number) =>
    prueba.pool.query(
      'UPDATE ordenes_apertura SET created_at = created_at - INTERVAL ? SECOND, vence_at = vence_at - INTERVAL ? SECOND',
      [segundos, segundos],
    );

  /** Da por terminada la orden: la puerta ya no tiene una orden viva. */
  const resolverOrdenes = () =>
    prueba.pool.query(
      "UPDATE ordenes_apertura SET estado = 'ejecutada' WHERE estado <> 'ejecutada'",
    );

  describe('una petición válida', () => {
    it('crea la orden (202), deja una lectura permitida con el usuario y nada más', async () => {
      const respuesta = await abrir(a.puertaPrincipal.id);

      expect(respuesta.statusCode).toBe(202);
      const orden = respuesta.json<Orden>();
      // Sin sentido ni placa destino: la orden es de la puerta.
      expect(Object.keys(orden).sort()).toEqual(['estado', 'orden_id', 'vence_at']);
      expect(orden.estado).toBe('pendiente');
      expect(respuesta.headers['cache-control']).toContain('no-store');

      const lecturas = await lecturasManuales();
      expect(lecturas).toHaveLength(1);
      expect(lecturas[0]).toMatchObject({
        puerta_id: a.puertaPrincipal.id,
        usuario_id: a.usuario.id,
        // La placa que la tome se conoce después; la lectura es de solo inserción.
        dispositivo_id: null,
        qr_acceso_id: null,
        token_hash: null,
        metodo: 'manual',
        resultado: 'permitido',
        motivo_code: 'manual.ordenada',
      });

      const filas = await ordenes();
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        id: orden.orden_id,
        puerta_id: a.puertaPrincipal.id,
        usuario_id: a.usuario.id,
        lectura_id: lecturas[0]?.id,
        estado: 'pendiente',
        dispositivo_id: null,
      });
      const plazo =
        (filas[0]?.vence_at as Date).getTime() - (filas[0]?.created_at as Date).getTime();
      expect(plazo).toBe(15_000);
      expect(new Date(orden.vence_at).getTime()).toBe((filas[0]?.vence_at as Date).getTime());
    });

    it('guarda la clave de idempotencia hasheada, nunca en claro', async () => {
      const clave = randomUUID();
      await abrir(a.puertaPrincipal.id, clave);
      const [fila] = await ordenes();
      expect(fila?.clave_idempotencia).toMatch(/^[0-9a-f]{64}$/);
      expect(fila?.clave_idempotencia).not.toContain(clave);
    });

    it('con dos placas en la puerta basta con que una esté en línea', async () => {
      const segunda = await crearDispositivo(prueba.pool, a.cuenta, a.puertaPrincipal.id, {
        sentido: 'entrada',
      });
      // La primera es `ambos`: se pasa a `salida` para que las dos convivan, y ninguna late.
      await prueba.pool.query(
        "UPDATE dispositivos SET sentido = 'salida', ultimo_latido_at = NULL WHERE id = ?",
        [a.dispositivoPrincipal.id],
      );
      await marcarEnLinea(prueba.pool, segunda.id);

      expect((await abrir(a.puertaPrincipal.id)).statusCode).toBe(202);
    });
  });

  describe('Idempotency-Key obligatoria', () => {
    it('sin la cabecera: 400 y no queda ni lectura ni orden', async () => {
      const respuesta = await prueba.app.inject({
        method: 'POST',
        url: `/api/v1/puertas/${a.puertaPrincipal.id}/abrir`,
        headers: conUsuario(sesion),
      });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json<Problema>().code).toBe('validacion.invalida');
      expect(await lecturasManuales()).toHaveLength(0);
      expect(await ordenes()).toHaveLength(0);
    });

    it('una clave corta o con caracteres fuera del formato: 400', async () => {
      for (const clave of ['corta', 'x'.repeat(129), `${'a'.repeat(30)} !`]) {
        const respuesta = await abrir(a.puertaPrincipal.id, clave);
        expect(respuesta.statusCode, clave).toBe(400);
      }
      expect(await ordenes()).toHaveLength(0);
    });

    it('el reintento con la misma clave devuelve la misma orden, sin otra lectura ni otra orden', async () => {
      const clave = randomUUID();
      const primera = await abrir(a.puertaPrincipal.id, clave);
      const segunda = await abrir(a.puertaPrincipal.id, clave);

      expect(segunda.statusCode).toBe(202);
      expect(segunda.json<Orden>()).toEqual(primera.json<Orden>());
      expect(segunda.headers['idempotent-replayed']).toBe('true');
      expect(primera.headers['idempotent-replayed']).toBeUndefined();
      expect(await lecturasManuales()).toHaveLength(1);
      expect(await ordenes()).toHaveLength(1);
    });

    it('el reintento sigue devolviendo la orden aunque ya haya vencido o terminado, con su estado', async () => {
      const clave = randomUUID();
      const primera = await abrir(a.puertaPrincipal.id, clave);
      await envejecerOrdenes(20);

      const segunda = await abrir(a.puertaPrincipal.id, clave);
      expect(segunda.statusCode).toBe(202);
      expect(segunda.json<Orden>()).toMatchObject({
        orden_id: primera.json<Orden>().orden_id,
        estado: 'vencida',
      });
      expect(await ordenes()).toHaveLength(1);
    });

    it('la misma clave sobre otra puerta es un uso indebido: 422 idempotencia.conflicto', async () => {
      const clave = randomUUID();
      await abrir(a.puertaPrincipal.id, clave);
      const otra = await abrir(a.puertaTrasera.id, clave);
      expect(otra.statusCode).toBe(422);
      expect(otra.json<Problema>().code).toBe('idempotencia.conflicto');
      expect(await ordenes()).toHaveLength(1);
    });
  });

  describe('aislamiento entre cuentas (invariante 1)', () => {
    it('la cuenta A pidiendo abrir una puerta de la B: 404 y ninguna lectura ni orden en ninguna', async () => {
      const respuesta = await abrir(b.puertaPrincipal.id);

      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json<Problema>().code).toBe('puerta.no_encontrada');
      expect(await lecturasManuales()).toHaveLength(0);
      expect(await ordenes()).toHaveLength(0);
    });

    it('una puerta inexistente o inactiva también es 404', async () => {
      expect((await abrir('999999')).statusCode).toBe(404);
      await prueba.pool.query('UPDATE puertas SET activo = 0 WHERE id = ?', [a.puertaTrasera.id]);
      const inactiva = await abrir(a.puertaTrasera.id);
      expect(inactiva.statusCode).toBe(404);
      expect(inactiva.json<Problema>().code).toBe('puerta.no_encontrada');
      expect(await lecturasManuales()).toHaveLength(0);
    });

    it('la clave de idempotencia de A no devuelve una orden de B ni de otro usuario', async () => {
      const clave = randomUUID();
      const deA = await abrir(a.puertaPrincipal.id, clave);
      expect(deA.statusCode).toBe(202);
      // El administrador de la MISMA cuenta usa la misma clave en otra puerta: es SU clave, otra orden.
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      const delAdmin = await abrir(a.puertaTrasera.id, clave, admin);
      expect(delAdmin.statusCode).toBe(202);
      expect(delAdmin.json<Orden>().orden_id).not.toBe(deA.json<Orden>().orden_id);
      // Y la cuenta B, con la misma clave, tampoco ve la de A.
      const deB = await abrir(
        b.puertaPrincipal.id,
        clave,
        await iniciarSesion(prueba.app, b.usuario.pin),
      );
      expect(deB.statusCode).toBe(202);
      expect(deB.json<Orden>().orden_id).not.toBe(deA.json<Orden>().orden_id);
    });
  });

  describe('rechazos: todos quedan en lecturas con su motivo (invariante 4)', () => {
    async function unicaLectura(): Promise<LecturaManual> {
      const lecturas = await lecturasManuales();
      expect(lecturas).toHaveLength(1);
      const [lectura] = lecturas;
      if (lectura === undefined) throw new Error('falta la lectura');
      return lectura;
    }

    it('puerta con el modo apagado: 409 manual.no_habilitada', async () => {
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);
      const respuesta = await abrir(a.puertaPrincipal.id);

      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('manual.no_habilitada');
      expect(await unicaLectura()).toMatchObject({
        usuario_id: a.usuario.id,
        resultado: 'rechazado',
        motivo_code: 'manual.no_habilitada',
        dispositivo_id: null,
      });
      expect(await ordenes()).toHaveLength(0);
    });

    it('puerta sin placa en servicio: 409 puerta.sin_dispositivo', async () => {
      const sinPlaca = await crearPuerta(prueba.pool, a.cuenta, a.sitioId, 'Sin placa');
      const respuesta = await abrir(sinPlaca.id);

      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('puerta.sin_dispositivo');
      expect(await unicaLectura()).toMatchObject({
        resultado: 'rechazado',
        motivo_code: 'manual.sin_dispositivo',
      });
    });

    it('una placa revocada no cuenta como placa en servicio', async () => {
      await prueba.pool.query('UPDATE dispositivos SET revocado_at = NOW(3) WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      const respuesta = await abrir(a.puertaPrincipal.id);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('puerta.sin_dispositivo');
    });

    it('placa sin conexión (latido viejo o ninguno): 409 puerta.sin_conexion', async () => {
      await prueba.pool.query(
        'UPDATE dispositivos SET ultimo_latido_at = NOW(3) - INTERVAL 10 MINUTE WHERE id = ?',
        [a.dispositivoPrincipal.id],
      );
      const viejo = await abrir(a.puertaPrincipal.id);
      expect(viejo.statusCode).toBe(409);
      expect(viejo.json<Problema>().code).toBe('puerta.sin_conexion');

      await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = NULL WHERE id = ?', [
        a.dispositivoPrincipal.id,
      ]);
      expect((await abrir(a.puertaPrincipal.id)).json<Problema>().code).toBe('puerta.sin_conexion');

      const lecturas = await lecturasManuales();
      expect(lecturas.map((l) => l.motivo_code)).toEqual([
        'manual.sin_conexion',
        'manual.sin_conexion',
      ]);
      expect(await ordenes()).toHaveLength(0);
    });

    it('suscripción vencida: 403 suscripcion.vencida', async () => {
      await prueba.pool.query('UPDATE suscripciones SET hasta = NOW(3) - INTERVAL 1 DAY');
      const respuesta = await abrir(a.puertaPrincipal.id);

      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('suscripcion.vencida');
      expect(await unicaLectura()).toMatchObject({
        resultado: 'rechazado',
        motivo_code: 'manual.suscripcion_vencida',
      });
    });

    it('usuario restringido: 403 manual.usuario_restringido (a diferencia de un QR ya generado, no abre)', async () => {
      const restringido = await crearUsuarioConPin(
        prueba.pool,
        a.cuenta,
        'RE01',
        [a.rolMiembroId],
        {
          estado: 'restringido',
          superiorId: a.administrador.id,
        },
      );
      const respuesta = await abrir(
        a.puertaPrincipal.id,
        randomUUID(),
        await iniciarSesion(prueba.app, restringido.pin),
      );

      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('manual.usuario_restringido');
      expect(await unicaLectura()).toMatchObject({
        usuario_id: restringido.id,
        resultado: 'rechazado',
        motivo_code: 'manual.usuario_restringido',
      });
      expect(await ordenes()).toHaveLength(0);
    });

    describe('estado que cambia entre la autenticación y la orden (se relee y bloquea en la transacción)', () => {
      // Un usuario suspendido o eliminado ni siquiera autentica (401): su caso es el de quien lo era justo antes.
      const principalDe = (usuarioId: string): PrincipalUsuario => ({
        tipo: 'usuario',
        usuarioId,
        cuentaId: a.cuenta.id,
        sesionId: '1',
        rolActivoId: a.rolMiembroId,
        permisos: new Set(['accesos.apertura_manual.usar']),
        estado: 'activo',
        origenDelEstado: null,
      });
      const pedirComo = (usuarioId: string) =>
        ContextoCuenta.ejecutar(
          {
            cuentaId: a.cuenta.id,
            usuarioId,
            rolActivoId: a.rolMiembroId,
            dispositivoId: null,
            origen: 'api',
          },
          () =>
            abrirPuertaManual(prueba.pool, principalDe(usuarioId), {
              puertaId: a.puertaPrincipal.id,
              idempotencia: { clave: randomUUID(), secreto: 'secreto-de-pruebas-0123456789abcdef' },
            }),
        );

      it('suspendido: manual.usuario_suspendido', async () => {
        const suspendido = await crearUsuarioConPin(
          prueba.pool,
          a.cuenta,
          'SU01',
          [a.rolMiembroId],
          {
            estado: 'suspendido',
            superiorId: a.administrador.id,
          },
        );
        await expect(pedirComo(suspendido.id)).rejects.toMatchObject({
          code: 'manual.usuario_suspendido',
          status: 403,
        });
        expect(await unicaLectura()).toMatchObject({
          usuario_id: suspendido.id,
          motivo_code: 'manual.usuario_suspendido',
        });
        expect(await ordenes()).toHaveLength(0);
      });

      it('la cuenta suspendida: manual.cuenta_suspendida', async () => {
        await prueba.pool.query(
          "UPDATE cuentas SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
          [a.cuenta.id],
        );
        await expect(pedirComo(a.usuario.id)).rejects.toMatchObject({
          code: 'manual.cuenta_suspendida',
        });
        expect((await unicaLectura()).motivo_code).toBe('manual.cuenta_suspendida');
      });

      it('un superior suspendido deja sin abrir a todo lo que cuelga de él', async () => {
        await prueba.pool.query(
          "UPDATE usuarios SET estado = 'suspendido', estado_desde = NOW(3), estado_motivo = 'prueba' WHERE id = ?",
          [a.administrador.id],
        );
        await expect(pedirComo(a.usuario.id)).rejects.toMatchObject({
          code: 'manual.usuario_suspendido',
        });
      });

      it('eliminado: manual.usuario_eliminado', async () => {
        await prueba.pool.query('UPDATE usuarios SET deleted_at = NOW(3) WHERE id = ?', [
          a.usuario.id,
        ]);
        await expect(pedirComo(a.usuario.id)).rejects.toMatchObject({
          code: 'manual.usuario_eliminado',
        });
        expect((await unicaLectura()).motivo_code).toBe('manual.usuario_eliminado');
      });
    });

    it('sin el permiso de usar: 403 y no es un intento (no llega a la acción)', async () => {
      const rolSinPermiso = await crearRol(prueba.pool, a.cuenta, 'Sin permiso', []);
      const sin = await crearUsuarioConPin(prueba.pool, a.cuenta, 'SP01', [rolSinPermiso], {
        superiorId: a.administrador.id,
      });
      const respuesta = await abrir(
        a.puertaPrincipal.id,
        randomUUID(),
        await iniciarSesion(prueba.app, sin.pin),
      );
      expect(respuesta.statusCode).toBe(403);
      expect(respuesta.json<Problema>().code).toBe('permiso.denegado');
      expect(await lecturasManuales()).toHaveLength(0);
    });
  });

  describe('orden viva en la puerta', () => {
    it('la de otro usuario: 409 manual.orden_en_curso, con su lectura rechazada', async () => {
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      expect((await abrir(a.puertaPrincipal.id, randomUUID(), admin)).statusCode).toBe(202);

      const respuesta = await abrir(a.puertaPrincipal.id);
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<Problema>().code).toBe('manual.orden_en_curso');

      const lecturas = await lecturasManuales();
      expect(lecturas.map((l) => [l.usuario_id, l.resultado, l.motivo_code])).toEqual([
        [a.administrador.id, 'permitido', 'manual.ordenada'],
        [a.usuario.id, 'rechazado', 'manual.orden_en_curso'],
      ]);
      expect(await ordenes()).toHaveLength(1);
    });

    it('la propia con otra clave tampoco se acumula: 409', async () => {
      await abrir(a.puertaPrincipal.id);
      const otra = await abrir(a.puertaPrincipal.id);
      expect(otra.statusCode).toBe(409);
      expect(otra.json<Problema>().code).toBe('manual.orden_en_curso');
    });

    it('una orden entregada y todavía vigente también bloquea', async () => {
      await abrir(a.puertaPrincipal.id);
      await prueba.pool.query(
        "UPDATE ordenes_apertura SET estado = 'entregada', dispositivo_id = ?, entregada_at = NOW(3)",
        [a.dispositivoPrincipal.id],
      );
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      expect((await abrir(a.puertaPrincipal.id, randomUUID(), admin)).statusCode).toBe(409);
    });

    it('una orden que nunca se entregó y ya venció no impide pedir otra: queda vencida', async () => {
      const vieja = await abrir(a.puertaPrincipal.id);
      await envejecerOrdenes(20);

      const nueva = await abrir(a.puertaPrincipal.id);
      expect(nueva.statusCode).toBe(202);
      const filas = await ordenes();
      expect(filas.map((f) => String(f.estado))).toEqual(['vencida', 'pendiente']);
      expect(filas[0]?.id).toBe(vieja.json<Orden>().orden_id);
    });

    it('terminada la orden, otra persona puede pedir', async () => {
      await abrir(a.puertaPrincipal.id);
      await resolverOrdenes();
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      expect((await abrir(a.puertaPrincipal.id, randomUUID(), admin)).statusCode).toBe(202);
    });

    it('dos personas a la vez sobre la misma puerta: una orden y un 409 (nunca dos pulsos)', async () => {
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      const [uno, dos] = await Promise.all([
        abrir(a.puertaPrincipal.id, randomUUID(), sesion),
        abrir(a.puertaPrincipal.id, randomUUID(), admin),
      ]);

      expect([uno.statusCode, dos.statusCode].sort()).toEqual([202, 409]);
      expect(await ordenes()).toHaveLength(1);
      // Las dos peticiones dejaron su lectura: una permitida y una rechazada.
      const lecturas = await lecturasManuales();
      expect(lecturas.map((l) => l.resultado).sort()).toEqual(['permitido', 'rechazado']);
    });

    it('la misma clave a la vez devuelve una sola orden', async () => {
      const clave = randomUUID();
      const [uno, dos] = await Promise.all([
        abrir(a.puertaPrincipal.id, clave),
        abrir(a.puertaPrincipal.id, clave),
      ]);
      expect([uno.statusCode, dos.statusCode]).toEqual([202, 202]);
      expect(uno.json<Orden>().orden_id).toBe(dos.json<Orden>().orden_id);
      expect(await ordenes()).toHaveLength(1);
      expect(await lecturasManuales()).toHaveLength(1);
    });
  });

  describe('límites (ADR 0030): solo al PEDIR abrir', () => {
    it('enfriamiento: otra orden del mismo usuario en la misma puerta antes de 10 s es 429 manual.limite', async () => {
      await abrir(a.puertaPrincipal.id);
      await resolverOrdenes();

      const respuesta = await abrir(a.puertaPrincipal.id);
      expect(respuesta.statusCode).toBe(429);
      const problema = respuesta.json<ProblemaConDetalle>();
      expect(problema.code).toBe('manual.limite');
      expect(problema).toMatchObject({ tipo: 'enfriamiento', tope: 10 });
      expect(problema.reintentar_en_segundos).toBeGreaterThanOrEqual(1);
      expect(problema.reintentar_en_segundos).toBeLessThanOrEqual(10);

      const lecturas = await lecturasManuales();
      expect(lecturas.map((l) => [l.resultado, l.motivo_code])).toEqual([
        ['permitido', 'manual.ordenada'],
        ['rechazado', 'manual.limite'],
      ]);

      // Pasado el enfriamiento vuelve a poder.
      await envejecerOrdenes(11);
      expect((await abrir(a.puertaPrincipal.id)).statusCode).toBe(202);
    });

    it('el enfriamiento es por puerta: otra puerta de la cuenta no espera', async () => {
      await abrir(a.puertaPrincipal.id);
      expect((await abrir(a.puertaTrasera.id)).statusCode).toBe(202);
    });

    it('el enfriamiento es por usuario: otra persona en la misma puerta no espera', async () => {
      await abrir(a.puertaPrincipal.id);
      await resolverOrdenes();
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      expect((await abrir(a.puertaPrincipal.id, randomUUID(), admin)).statusCode).toBe(202);
    });

    it('el enfriamiento sale de la configuración de la plataforma y admite excepción por usuario', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 0 WHERE clave = 'manual.enfriamiento_segundos'",
      );
      await abrir(a.puertaPrincipal.id);
      await resolverOrdenes();
      expect((await abrir(a.puertaPrincipal.id)).statusCode).toBe(202);
    });

    it('tope diario por usuario: pasado, 429 manual.limite con tipo diario; otro usuario no se afecta', async () => {
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 2 WHERE clave = 'manual.tope_diario'",
      );
      for (let i = 0; i < 2; i += 1) {
        expect((await abrir(a.puertaPrincipal.id)).statusCode).toBe(202);
        await resolverOrdenes();
        await envejecerOrdenes(11);
      }

      const tercera = await abrir(a.puertaPrincipal.id);
      expect(tercera.statusCode).toBe(429);
      expect(tercera.json<ProblemaConDetalle>()).toMatchObject({
        code: 'manual.limite',
        tipo: 'diario',
        tope: 2,
      });
      const lecturas = await lecturasManuales();
      expect(lecturas.map((l) => l.motivo_code)).toEqual([
        'manual.ordenada',
        'manual.ordenada',
        'manual.limite',
      ]);

      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      expect((await abrir(a.puertaPrincipal.id, randomUUID(), admin)).statusCode).toBe(202);
    });

    it('el tope diario cuenta el día de la zona horaria del sitio, no el de UTC', async () => {
      // La Paz es UTC-4: a las 02:00 UTC todavía es el día anterior allá. Una orden de las 01:00 UTC y otra de
      // las 05:00 UTC son del mismo día de La Paz solo si el día se cuenta con la zona del sitio.
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 1 WHERE clave = 'manual.tope_diario'",
      );
      const ahora = new Date('2026-11-10T05:00:00.000Z'); // 01:00 del 10 en La Paz
      const principal: PrincipalUsuario = {
        tipo: 'usuario',
        usuarioId: a.usuario.id,
        cuentaId: a.cuenta.id,
        sesionId: '1',
        rolActivoId: a.rolMiembroId,
        permisos: new Set(),
        estado: 'activo',
        origenDelEstado: null,
      };
      const pedir = (cuando: Date, clave: string) =>
        ContextoCuenta.ejecutar(
          {
            cuentaId: a.cuenta.id,
            usuarioId: a.usuario.id,
            rolActivoId: null,
            dispositivoId: null,
            origen: 'api',
          },
          () =>
            abrirPuertaManual(
              prueba.pool,
              principal,
              {
                puertaId: a.puertaPrincipal.id,
                idempotencia: { clave, secreto: 'secreto-de-pruebas-0123456789abcdef' },
              },
              cuando,
            ),
        );
      // El latido de la placa se mide contra el reloj de la petición.
      await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = ?', [ahora]);

      await pedir(ahora, randomUUID());
      await resolverOrdenes();
      // 17:00 UTC del mismo 10 (13:00 en La Paz): mismo día local → tope.
      const mismoDia = new Date('2026-11-10T17:00:00.000Z');
      await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = ?', [mismoDia]);
      await expect(pedir(mismoDia, randomUUID())).rejects.toMatchObject({
        code: 'manual.limite',
        extra: { tipo: 'diario' },
      });
      // 05:00 UTC del 11 (01:00 del 11 en La Paz): día local nuevo → pasa.
      const otroDia = new Date('2026-11-11T05:00:00.000Z');
      await prueba.pool.query('UPDATE dispositivos SET ultimo_latido_at = ?', [otroDia]);
      await expect(pedir(otroDia, randomUUID())).resolves.toMatchObject({ estado: 'pendiente' });
    });

    it('un rechazo no cuenta para el tope ni para el enfriamiento', async () => {
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 0 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);
      await abrir(a.puertaPrincipal.id);
      await prueba.pool.query('UPDATE puertas SET apertura_manual = 1 WHERE id = ?', [
        a.puertaPrincipal.id,
      ]);
      expect((await abrir(a.puertaPrincipal.id)).statusCode).toBe(202);
    });

    it('validar un QR nunca se limita por la apertura manual', async () => {
      // El tope manual agotado no toca la validación: la ruta de validación no consulta estos topes.
      await prueba.pool.query(
        "UPDATE configuracion_limites SET valor = 1 WHERE clave = 'manual.tope_diario'",
      );
      await abrir(a.puertaPrincipal.id);
      await resolverOrdenes();
      await envejecerOrdenes(11);
      expect((await abrir(a.puertaPrincipal.id)).statusCode).toBe(429);

      const { crearQr } = await import('../helpers/fixtures.js');
      const qr = await crearQr(prueba.pool, a.cuenta, a.usuario.id, [a.puertaPrincipal.id]);
      const validacion = await prueba.app.inject({
        method: 'POST',
        url: '/api/v1/dispositivos/validaciones',
        headers: { authorization: a.dispositivoPrincipal.encabezado },
        payload: { token: qr.texto },
      });
      expect(validacion.statusCode).toBe(200);
      expect(validacion.json<{ abrir: boolean }>().abrir).toBe(true);
    });
  });

  describe('lecturas: solo inserción', () => {
    it('ninguna ruta edita ni borra la lectura de una apertura manual', async () => {
      await abrir(a.puertaPrincipal.id);
      const antes = await lecturasManuales();
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      for (const metodo of ['PUT', 'PATCH', 'DELETE'] as const) {
        const respuesta = await prueba.app.inject({
          method: metodo,
          url: `/api/v1/lecturas/${antes[0]?.id}`,
          headers: conUsuario(admin),
        });
        expect(respuesta.statusCode).toBe(404);
      }
      expect(await lecturasManuales()).toEqual(antes);
      expect(await contarFilas(prueba.pool, 'lecturas')).toBe(1);
    });

    it('el administrador ve la apertura manual en su listado de lecturas, sin sentido', async () => {
      await abrir(a.puertaPrincipal.id);
      const admin = await iniciarSesion(prueba.app, a.administrador.pin);
      const respuesta = await prueba.app.inject({
        method: 'GET',
        url: '/api/v1/lecturas',
        headers: conUsuario(admin),
      });
      expect(respuesta.statusCode).toBe(200);
      const { datos } = respuesta.json<{ datos: Record<string, unknown>[] }>();
      expect(datos).toHaveLength(1);
      expect(datos[0]).toMatchObject({ motivo_code: 'manual.ordenada', resultado: 'permitido' });
      expect(JSON.stringify(datos)).not.toMatch(/sentido|entrada|salida/);
    });
  });
});

describe('GET /api/v1/ordenes-apertura/{id}', () => {
  let prueba: AppDePrueba;
  let a: Escenario;
  let b: Escenario;
  let sesion: Sesion;

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
    await marcarEnLinea(prueba.pool, a.dispositivoPrincipal.id);
    await marcarEnLinea(prueba.pool, b.dispositivoPrincipal.id);
    sesion = await iniciarSesion(prueba.app, a.usuario.pin);
  });

  const abrir = async (con: Sesion, puertaId: string): Promise<string> => {
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: `/api/v1/puertas/${puertaId}/abrir`,
      headers: { ...conUsuario(con), 'idempotency-key': randomUUID() },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(202);
    return respuesta.json<Orden>().orden_id;
  };
  const consultar = (id: string, con: Sesion = sesion) =>
    prueba.app.inject({
      method: 'GET',
      url: `/api/v1/ordenes-apertura/${id}`,
      headers: conUsuario(con),
    });

  it('una orden recién creada está pendiente y sin resultado', async () => {
    const id = await abrir(sesion, a.puertaPrincipal.id);
    const respuesta = await consultar(id);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      orden_id: id,
      puerta_id: a.puertaPrincipal.id,
      estado: 'pendiente',
      vence_at: cualquierTexto(),
      resultado: null,
    });
    expect(respuesta.headers['cache-control']).toContain('no-store');
  });

  it('muestra el resultado que informó la placa (abierta o falló)', async () => {
    const id = await abrir(sesion, a.puertaPrincipal.id);
    const [fila] = await prueba.pool
      .query<RowDataPacket[]>('SELECT lectura_id FROM ordenes_apertura WHERE id = ?', [id])
      .then(([filas]) => filas);
    await prueba.pool.query(
      "UPDATE ordenes_apertura SET estado = 'ejecutada', dispositivo_id = ?, entregada_at = NOW(3), resuelta_at = NOW(3) WHERE id = ?",
      [a.dispositivoPrincipal.id, id],
    );
    await prueba.pool.query(
      `INSERT INTO confirmaciones_apertura (tenant_id, evento_acceso_id, dispositivo_id, puerta_id, origen, resultado, causa, registrada_at)
       VALUES (?, ?, ?, ?, 'placa', 'ejecutada', 'puerta_abrio', NOW(3))`,
      [a.cuenta.id, fila?.lectura_id, a.dispositivoPrincipal.id, a.puertaPrincipal.id],
    );

    expect((await consultar(id)).json()).toMatchObject({
      estado: 'ejecutada',
      resultado: { resultado: 'ejecutada', causa: 'puerta_abrio' },
    });
  });

  it('una orden fallida informa la causa', async () => {
    const id = await abrir(sesion, a.puertaPrincipal.id);
    const [fila] = await prueba.pool
      .query<RowDataPacket[]>('SELECT lectura_id FROM ordenes_apertura WHERE id = ?', [id])
      .then(([filas]) => filas);
    await prueba.pool.query(
      "UPDATE ordenes_apertura SET estado = 'fallida', dispositivo_id = ?, entregada_at = NOW(3), resuelta_at = NOW(3) WHERE id = ?",
      [a.dispositivoPrincipal.id, id],
    );
    await prueba.pool.query(
      `INSERT INTO confirmaciones_apertura (tenant_id, evento_acceso_id, dispositivo_id, puerta_id, origen, resultado, causa, registrada_at)
       VALUES (?, ?, ?, ?, 'placa', 'fallida', 'puerta_no_abrio', NOW(3))`,
      [a.cuenta.id, fila?.lectura_id, a.dispositivoPrincipal.id, a.puertaPrincipal.id],
    );
    expect((await consultar(id)).json()).toMatchObject({
      estado: 'fallida',
      resultado: { resultado: 'fallida', causa: 'puerta_no_abrio' },
    });
  });

  it('una orden cuyo plazo corrió se ve vencida aunque el barrido no la haya marcado', async () => {
    const id = await abrir(sesion, a.puertaPrincipal.id);
    await prueba.pool.query(
      'UPDATE ordenes_apertura SET created_at = created_at - INTERVAL 20 SECOND, vence_at = vence_at - INTERVAL 20 SECOND',
    );
    const respuesta = await consultar(id);
    expect(respuesta.json<{ estado: string }>().estado).toBe('vencida');
    // La tabla sigue como estaba: la vista no escribe nada.
    const [fila] = await prueba.pool
      .query<RowDataPacket[]>('SELECT estado FROM ordenes_apertura WHERE id = ?', [id])
      .then(([filas]) => filas);
    expect(fila?.estado).toBe('pendiente');
  });

  it('la orden de otro usuario de la misma cuenta es 404 orden.no_encontrada', async () => {
    const admin = await iniciarSesion(prueba.app, a.administrador.pin);
    const idDelAdmin = await abrir(admin, a.puertaPrincipal.id);
    const respuesta = await consultar(idDelAdmin);
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json<Problema>().code).toBe('orden.no_encontrada');
  });

  it('aislamiento: la orden de la cuenta B es 404 para la A', async () => {
    const deB = await abrir(await iniciarSesion(prueba.app, b.usuario.pin), b.puertaPrincipal.id);
    const respuesta = await consultar(deB);
    expect(respuesta.statusCode).toBe(404);
    expect(respuesta.json<Problema>().code).toBe('orden.no_encontrada');
    // Una orden inexistente da exactamente la misma respuesta: no se revela si existe.
    expect((await consultar('999999')).statusCode).toBe(404);
  });

  it('sin el permiso de usar: 403', async () => {
    const id = await abrir(sesion, a.puertaPrincipal.id);
    const rolSinPermiso = await crearRol(prueba.pool, a.cuenta, 'Sin permiso', []);
    const sin = await crearUsuarioConPin(prueba.pool, a.cuenta, 'SP01', [rolSinPermiso], {
      superiorId: a.administrador.id,
    });
    const respuesta = await consultar(id, await iniciarSesion(prueba.app, sin.pin));
    expect(respuesta.statusCode).toBe(403);
  });

  it('sin sesión: 401', async () => {
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: '/api/v1/ordenes-apertura/1',
    });
    expect(respuesta.statusCode).toBe(401);
  });
});
