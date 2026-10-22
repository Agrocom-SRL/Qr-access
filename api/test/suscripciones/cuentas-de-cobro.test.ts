import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearEscenario, crearSuperAdmin } from '../helpers/fixtures.js';
import {
  conUsuario,
  iniciarSesion,
  iniciarSesionDePlataforma,
  respaldoDePago,
  type Problema,
} from '../helpers/http.js';

const RUTA = '/api/v1/plataforma/cuentas-de-cobro';

interface CuentaDeCobroDto {
  id: string;
  metodo: 'transferencia' | 'qr';
  banco: string;
  titular: string | null;
  numero_cuenta: string | null;
  imagen_id: string | null;
  nota: string | null;
  activo: boolean;
}

const TRANSFERENCIA = {
  metodo: 'transferencia',
  banco: 'Banco Unión',
  titular: 'AGROCOM S.R.L.',
  numero_cuenta: '10000123456',
  tipo_cuenta: 'corriente',
};

describe('plataforma: cuentas de cobro (ADR 0029)', () => {
  let prueba: AppDePrueba;
  let headers: { authorization: string };

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
    const admin = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', admin.contrasena),
    );
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  const crear = (payload: Record<string, unknown>) =>
    prueba.app.inject({ method: 'POST', url: RUTA, headers, payload });
  const lista = async () => {
    const respuesta = await prueba.app.inject({ method: 'GET', url: RUTA, headers });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    return respuesta.json<{ datos: CuentaDeCobroDto[] }>().datos;
  };
  const crearYLeer = async (payload: Record<string, unknown>) => {
    const respuesta = await crear(payload);
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    return respuesta.json<{ id: string }>().id;
  };

  it('arranca sin cuentas de cobro', async () => {
    expect(await lista()).toEqual([]);
  });

  it('crea una cuenta bancaria y la lista', async () => {
    const id = await crearYLeer(TRANSFERENCIA);
    expect(await lista()).toEqual([
      expect.objectContaining({
        id,
        metodo: 'transferencia',
        banco: 'Banco Unión',
        titular: 'AGROCOM S.R.L.',
        numero_cuenta: '10000123456',
        imagen_id: null,
        activo: true,
      }),
    ]);
  });

  it('una cuenta bancaria pide titular y número', async () => {
    for (const falta of ['titular', 'numero_cuenta']) {
      const respuesta = await crear({ ...TRANSFERENCIA, [falta]: undefined });
      expect(respuesta.statusCode, respuesta.body).toBe(422);
      expect(respuesta.json<Problema>().code).toBe('cuenta_de_cobro.datos_incompletos');
    }
  });

  it('un QR pide su imagen, que no puede ser un PDF ni inexistente', async () => {
    const sinImagen = await crear({ metodo: 'qr', banco: 'Banco Unión' });
    expect(sinImagen.statusCode).toBe(422);
    expect(sinImagen.json<Problema>().code).toBe('cuenta_de_cobro.datos_incompletos');

    const inexistente = await crear({ metodo: 'qr', banco: 'Banco Unión', imagen_id: '999999' });
    expect(inexistente.statusCode).toBe(422);
    expect(inexistente.json<Problema>().code).toBe('comprobante.no_encontrado');

    const { comprobante_id } = await respaldoDePago(prueba.app, headers);
    await prueba.pool.query("UPDATE comprobantes SET tipo_mime = 'application/pdf' WHERE id = ?", [
      comprobante_id,
    ]);
    const pdf = await crear({ metodo: 'qr', banco: 'Banco Unión', imagen_id: comprobante_id });
    expect(pdf.statusCode).toBe(422);
    expect(pdf.json<Problema>().code).toBe('cuenta_de_cobro.imagen_invalida');
  });

  it('crea un QR con su imagen', async () => {
    const { comprobante_id } = await respaldoDePago(prueba.app, headers);
    const id = await crearYLeer({
      metodo: 'qr',
      banco: 'Banco Mercantil Santa Cruz',
      imagen_id: comprobante_id,
      nota: 'Vale para cualquier banco',
    });
    expect((await lista()).find((c) => c.id === id)).toMatchObject({
      metodo: 'qr',
      imagen_id: comprobante_id,
      nota: 'Vale para cualquier banco',
    });
  });

  it('no repite el mismo banco y número', async () => {
    await crearYLeer(TRANSFERENCIA);
    const repetida = await crear(TRANSFERENCIA);
    expect(repetida.statusCode).toBe(409);
    expect(repetida.json<Problema>().code).toBe('cuenta_de_cobro.existente');
    expect(await crear({ ...TRANSFERENCIA, banco: 'Banco BISA' })).toMatchObject({
      statusCode: 201,
    });
  });

  it('edita, desactiva y vuelve a activar una cuenta, con rastro en la bitácora', async () => {
    const id = await crearYLeer(TRANSFERENCIA);
    const cambiar = (payload: Record<string, unknown>) =>
      prueba.app.inject({ method: 'PATCH', url: `${RUTA}/${id}`, headers, payload });

    expect((await cambiar({ titular: 'AGROCOM SRL', nota: 'Cuenta principal' })).statusCode).toBe(
      204,
    );
    expect((await cambiar({ activo: false })).statusCode).toBe(204);
    expect((await lista())[0]).toMatchObject({
      titular: 'AGROCOM SRL',
      nota: 'Cuenta principal',
      activo: false,
    });
    expect((await cambiar({ activo: true })).statusCode).toBe(204);
    expect((await lista())[0]?.activo).toBe(true);

    // No se puede dejar una cuenta bancaria sin número.
    const sinNumero = await cambiar({ numero_cuenta: '' });
    expect(sinNumero.statusCode).toBe(422);

    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT id FROM bitacoras WHERE tabla = 'cuentas_de_cobro'",
    );
    expect(filas.length).toBeGreaterThanOrEqual(3);
  });

  it('una cuenta inexistente da 404 al editar y al eliminar', async () => {
    const editar = await prueba.app.inject({
      method: 'PATCH',
      url: `${RUTA}/999999`,
      headers,
      payload: { activo: false },
    });
    const eliminar = await prueba.app.inject({
      method: 'DELETE',
      url: `${RUTA}/999999`,
      headers,
    });
    expect(editar.statusCode).toBe(404);
    expect(eliminar.statusCode).toBe(404);
  });

  it('eliminar una cuenta la borra de forma lógica y libera su número', async () => {
    const id = await crearYLeer(TRANSFERENCIA);
    const respuesta = await prueba.app.inject({
      method: 'DELETE',
      url: `${RUTA}/${id}`,
      headers,
    });
    expect(respuesta.statusCode).toBe(204);
    expect(await lista()).toEqual([]);
    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT deleted_at FROM cuentas_de_cobro WHERE id = ?',
      [id],
    );
    expect(filas[0]?.deleted_at).not.toBeNull();
    expect(await crear(TRANSFERENCIA)).toMatchObject({ statusCode: 201 });
  });

  it('rechaza datos inválidos', async () => {
    for (const cambio of [
      { metodo: 'cheque' },
      { banco: '' },
      { tipo_cuenta: 'otra' },
      { numero_cuenta: 'x'.repeat(41) },
    ]) {
      expect((await crear({ ...TRANSFERENCIA, ...cambio })).statusCode).toBe(400);
    }
  });

  it('un usuario de una cuenta no las ve ni las cambia', async () => {
    const escenario = await crearEscenario(prueba.pool, 'ZZZ');
    const sesion = conUsuario(await iniciarSesion(prueba.app, escenario.administrador.pin));
    for (const peticion of [
      { method: 'GET', url: RUTA },
      { method: 'POST', url: RUTA },
      { method: 'PATCH', url: `${RUTA}/1` },
      { method: 'DELETE', url: `${RUTA}/1` },
    ] as const) {
      const respuesta = await prueba.app.inject({ ...peticion, headers: sesion, payload: {} });
      expect(respuesta.statusCode).toBe(401);
    }
  });

  it('sin el permiso de plataforma, 403', async () => {
    await prueba.pool.query(
      "DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo = 'suscripciones.cobro.ver'",
    );
    const nueva = await iniciarSesionDePlataforma(
      prueba.app,
      'lucia.paz',
      'contrasena-de-prueba-1',
    );
    const respuesta = await prueba.app.inject({
      method: 'GET',
      url: RUTA,
      headers: conUsuario(nueva),
    });
    expect(respuesta.statusCode).toBe(403);
  });
});
