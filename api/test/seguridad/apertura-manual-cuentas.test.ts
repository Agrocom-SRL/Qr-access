import type { RowDataPacket } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ROLES_BASE } from '../../src/modules/seguridad/domain/roles-base.js';
import { crearAppDePrueba, type AppDePrueba } from '../helpers/app.js';
import { reiniciarBase } from '../helpers/base.js';
import { crearSuperAdmin } from '../helpers/fixtures.js';
import { conUsuario, iniciarSesionDePlataforma } from '../helpers/http.js';

const USAR = 'accesos.apertura_manual.usar';
const CONFIGURAR = 'accesos.apertura_manual.configurar';

describe('apertura manual en las cuentas nuevas (ADR 0035 §5)', () => {
  let prueba: AppDePrueba;

  beforeEach(async () => {
    prueba = await crearAppDePrueba();
    await reiniciarBase(prueba.pool);
  });
  afterEach(async () => {
    await prueba.cerrar();
  });

  it('los roles base: todos pueden usarla y solo el Administrador (que recibe todo) la configura', () => {
    for (const nombre of ['Titular', 'Miembro', 'Guardia']) {
      const rol = ROLES_BASE.find((base) => base.nombre === nombre);
      expect(rol?.permisos, nombre).toContain(USAR);
      expect(rol?.permisos, nombre).not.toContain(CONFIGURAR);
    }
    const administrador = ROLES_BASE.find((base) => base.nombre === 'Administrador');
    // `null` = todos los permisos de ámbito cuenta del catálogo, entre ellos los dos.
    expect(administrador?.permisos).toBeNull();
  });

  it('una cuenta dada de alta por AGROCOM nace con el modo encendido y con los permisos en cada rol', async () => {
    const lucia = await crearSuperAdmin(prueba.pool, 'lucia.paz');
    const headers = conUsuario(
      await iniciarSesionDePlataforma(prueba.app, 'lucia.paz', lucia.contrasena),
    );
    const [planes] = await prueba.pool.query<RowDataPacket[]>(
      "SELECT id FROM planes WHERE nombre LIKE '% usuarios' ORDER BY max_usuarios",
    );
    const respuesta = await prueba.app.inject({
      method: 'POST',
      url: '/api/v1/plataforma/cuentas',
      headers,
      payload: {
        razon_social: 'Agrícola Guarayos S.A.',
        codigo: 'agu',
        nit: '2876501019',
        ciudad: 'Ascensión de Guarayos',
        contacto_nombre: 'Rodrigo Añez',
        contacto_apellido: 'Pérez',
        contacto_telefono: '7 712 4405',
        contacto_correo: 'rodrigo@guarayos.bo',
        plan_id: String(planes[1]?.id),
        inicio: '2026-10-12',
        administrador_nombre: 'Rodrigo Añez',
        pago: { monto: 21_600, fecha_pago: '2026-10-12', medio: 'efectivo', referencia: 'R-1' },
      },
    });
    expect(respuesta.statusCode, respuesta.body).toBe(201);
    const cuentaId = respuesta.json<{ cuenta: { id: string } }>().cuenta.id;

    const [cuentas] = await prueba.pool.query<RowDataPacket[]>(
      'SELECT apertura_manual_por_omision AS valor FROM cuentas WHERE id = ?',
      [cuentaId],
    );
    expect(Number(cuentas[0]?.valor)).toBe(1);

    const [filas] = await prueba.pool.query<RowDataPacket[]>(
      `SELECT r.nombre, p.codigo FROM roles AS r
         JOIN rol_permisos AS rp ON rp.rol_id = r.id
         JOIN permisos AS p ON p.id = rp.permiso_id
        WHERE r.tenant_id = ? AND p.codigo IN (?, ?)`,
      [cuentaId, USAR, CONFIGURAR],
    );
    const porRol = new Map<string, string[]>();
    for (const fila of filas) {
      porRol.set(String(fila.nombre), [
        ...(porRol.get(String(fila.nombre)) ?? []),
        String(fila.codigo),
      ]);
    }
    expect([...(porRol.get('Administrador') ?? [])].sort()).toEqual([CONFIGURAR, USAR]);
    for (const nombre of ['Titular', 'Miembro', 'Guardia']) {
      expect(porRol.get(nombre), nombre).toEqual([USAR]);
    }
  });
});
