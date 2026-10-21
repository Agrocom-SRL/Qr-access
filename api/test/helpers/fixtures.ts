import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { cargarConfig } from '../../src/config.js';
import { calcularIndiceDePin, secretoDePin } from '../../src/modules/seguridad/domain/pin.js';
import { hashear } from '../../src/platform/seguridad/hash.js';
import { generarTokenOpaco } from '../../src/platform/seguridad/tokens.js';
import {
  generarTokenQr,
  hashDeToken,
  textoDeQr,
} from '../../src/modules/accesos/domain/token-qr.js';

/**
 * Datos de prueba escritos directo con SQL (no con la API ni los repositorios): así un
 * defecto de la API no puede esconderse en el propio armado del escenario.
 */

async function insertar(pool: Pool, sql: string, valores: unknown[]): Promise<string> {
  const [resultado] = await pool.query<ResultSetHeader>(sql, valores);
  return String(resultado.insertId);
}

export const PERMISOS_DE_ADMINISTRADOR = [
  'organizacion.puerta.ver',
  'organizacion.puerta.supervisar',
  'organizacion.sitio.administrar',
  'organizacion.puerta.administrar',
  'organizacion.guardia.asignar',
  'accesos.qr.generar',
  'accesos.qr.ver',
  'accesos.qr.ver_todos',
  'accesos.qr.anular',
  'accesos.qr.anular_todos',
  'accesos.evento.ver',
  'accesos.evento.ver_todos',
  'seguridad.usuario.ver',
  'seguridad.usuario.crear',
  'seguridad.usuario.editar',
  'seguridad.usuario.eliminar',
  'seguridad.cupo.ver',
  'seguridad.estadistica.ver',
];

/** Lo que tiene un Miembro (ADR 0028): usar la puerta con sus QR. */
export const PERMISOS_DE_USUARIO = [
  'organizacion.puerta.ver',
  'accesos.qr.generar',
  'accesos.qr.ver',
  'accesos.qr.anular',
  'accesos.evento.ver',
];

/** Un Titular tiene lo del Miembro y además administra a sus Miembros. */
export const PERMISOS_DE_TITULAR = [
  ...PERMISOS_DE_USUARIO,
  'seguridad.usuario.ver',
  'seguridad.usuario.crear',
  'seguridad.usuario.editar',
  'seguridad.usuario.eliminar',
];

export interface Cuenta {
  readonly id: string;
  readonly codigo: string;
}

export async function crearCuenta(pool: Pool, codigo: string, activo = true): Promise<Cuenta> {
  const id = await insertar(pool, 'INSERT INTO cuentas (nombre, codigo, activo) VALUES (?, ?, ?)', [
    `Cuenta ${codigo}`,
    codigo,
    activo ? 1 : 0,
  ]);
  return { id, codigo };
}

export async function crearRol(
  pool: Pool,
  cuenta: Cuenta,
  nombre: string,
  permisos: readonly string[],
): Promise<string> {
  // Administrador es protegido, como lo crea la API al dar de alta una cuenta.
  const id = await insertar(
    pool,
    'INSERT INTO roles (tenant_id, nombre, protegido) VALUES (?, ?, ?)',
    [cuenta.id, nombre, nombre === 'Administrador' ? 1 : 0],
  );
  for (const codigo of permisos) {
    await pool.query(
      'INSERT INTO rol_permisos (rol_id, permiso_id) SELECT ?, id FROM permisos WHERE codigo = ?',
      [id, codigo],
    );
  }
  return id;
}

export interface UsuarioDePrueba {
  readonly id: string;
  readonly pin: string;
}

export async function crearUsuarioConPin(
  pool: Pool,
  cuenta: Cuenta,
  sufijo: string,
  rolIds: readonly string[],
  opciones: { activo?: boolean; superiorId?: string } = {},
): Promise<UsuarioDePrueba> {
  const pin = `${cuenta.codigo}${sufijo}`;
  const id = await insertar(
    pool,
    'INSERT INTO usuarios (tenant_id, superior_id, etiqueta, pin_indice, pin_hash, pin_generado_at, activo) VALUES (?, ?, ?, ?, ?, NOW(3), ?)',
    [
      cuenta.id,
      opciones.superiorId ?? null,
      `Usuario ${pin}`,
      calcularIndiceDePin(cargarConfig().PIN_PIMIENTA, cuenta.id, sufijo),
      await hashear(secretoDePin(cuenta.id, sufijo)),
      opciones.activo === false ? 0 : 1,
    ],
  );
  for (const rolId of rolIds) {
    await pool.query('INSERT INTO usuario_roles (tenant_id, usuario_id, rol_id) VALUES (?, ?, ?)', [
      cuenta.id,
      id,
      rolId,
    ]);
  }
  return { id, pin };
}

export async function crearSuscripcion(
  pool: Pool,
  cuenta: Cuenta,
  opciones: {
    vigente?: boolean;
    maxVigenciaQrHoras?: number | null;
    maxUsuarios?: number | null;
    maxDispositivos?: number | null;
  } = {},
): Promise<void> {
  const planId = await insertar(
    pool,
    'INSERT INTO planes (nombre, max_vigencia_qr_horas, max_usuarios, max_dispositivos) VALUES (?, ?, ?, ?)',
    [
      `Plan ${cuenta.codigo}`,
      opciones.maxVigenciaQrHoras ?? null,
      opciones.maxUsuarios ?? null,
      opciones.maxDispositivos ?? null,
    ],
  );
  const dia = 86_400_000;
  const ahora = Date.now();
  const vigente = opciones.vigente !== false;
  await pool.query(
    'INSERT INTO suscripciones (tenant_id, plan_id, desde, hasta, estado) VALUES (?, ?, ?, ?, ?)',
    [
      cuenta.id,
      planId,
      new Date(ahora - (vigente ? 30 : 60) * dia),
      new Date(ahora + (vigente ? 30 : -1) * dia),
      'vigente',
    ],
  );
}

export interface PuertaDePrueba {
  readonly id: string;
  readonly nombre: string;
  readonly sitioId: string;
}

export async function crearSitio(pool: Pool, cuenta: Cuenta, nombre: string): Promise<string> {
  return insertar(pool, 'INSERT INTO sitios (tenant_id, nombre) VALUES (?, ?)', [
    cuenta.id,
    nombre,
  ]);
}

export async function crearPuerta(
  pool: Pool,
  cuenta: Cuenta,
  sitioId: string,
  nombre: string,
  segundosApertura = 5,
): Promise<PuertaDePrueba> {
  const id = await insertar(
    pool,
    'INSERT INTO puertas (tenant_id, sitio_id, nombre, segundos_apertura) VALUES (?, ?, ?, ?)',
    [cuenta.id, sitioId, nombre, segundosApertura],
  );
  return { id, nombre, sitioId };
}

export interface DispositivoDePrueba {
  readonly id: string;
  readonly clave: string;
  /** El valor del encabezado `Authorization`. */
  readonly encabezado: string;
}

export async function crearDispositivo(
  pool: Pool,
  cuenta: Cuenta,
  puertaId: string,
): Promise<DispositivoDePrueba> {
  const clave = generarTokenOpaco(32);
  const id = await insertar(
    pool,
    'INSERT INTO dispositivos (tenant_id, puerta_id, nombre, clave_hash) VALUES (?, ?, ?, ?)',
    [cuenta.id, puertaId, `Dispositivo ${puertaId}`, await hashear(clave)],
  );
  return { id, clave, encabezado: `Dispositivo ${id}.${clave}` };
}

export interface QrDePrueba {
  readonly id: string;
  readonly texto: string;
}

/** Un QR escrito directo en la base, para armar estados (vencido, usado…) que la API no genera. */
export async function crearQr(
  pool: Pool,
  cuenta: Cuenta,
  generadorId: string,
  puertaIds: readonly string[],
  opciones: { venceAt?: Date; usadoAt?: Date; anuladoAt?: Date } = {},
): Promise<QrDePrueba> {
  const token = generarTokenQr();
  const id = await insertar(
    pool,
    'INSERT INTO qr_accesos (tenant_id, generado_por, token_hash, vence_at, usado_at, anulado_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      cuenta.id,
      generadorId,
      hashDeToken(token),
      opciones.venceAt ?? new Date(Date.now() + 3_600_000),
      opciones.usadoAt ?? null,
      opciones.anuladoAt ?? null,
    ],
  );
  for (const puertaId of puertaIds) {
    await pool.query(
      'INSERT INTO qr_acceso_puertas (tenant_id, qr_acceso_id, puerta_id) VALUES (?, ?, ?)',
      [cuenta.id, id, puertaId],
    );
  }
  return { id, texto: textoDeQr(token) };
}

/**
 * Una cuenta completa: administrador, un Miembro que cuelga de él (`usuario`), sitio, dos puertas con
 * su dispositivo y suscripción vigente. Trae los roles Administrador, Titular y Miembro (ADR 0028);
 * el Titular no tiene usuario: cada test arma su propio árbol cuando lo necesita.
 */
export interface Escenario {
  readonly cuenta: Cuenta;
  readonly rolAdministradorId: string;
  readonly rolTitularId: string;
  readonly rolMiembroId: string;
  readonly administrador: UsuarioDePrueba;
  readonly usuario: UsuarioDePrueba;
  readonly sitioId: string;
  readonly puertaPrincipal: PuertaDePrueba;
  readonly puertaTrasera: PuertaDePrueba;
  readonly dispositivoPrincipal: DispositivoDePrueba;
  readonly dispositivoTrasero: DispositivoDePrueba;
}

export async function crearEscenario(pool: Pool, codigo: string): Promise<Escenario> {
  const cuenta = await crearCuenta(pool, codigo);
  const rolAdministradorId = await crearRol(
    pool,
    cuenta,
    'Administrador',
    PERMISOS_DE_ADMINISTRADOR,
  );
  const rolTitularId = await crearRol(pool, cuenta, 'Titular', PERMISOS_DE_TITULAR);
  const rolMiembroId = await crearRol(pool, cuenta, 'Miembro', PERMISOS_DE_USUARIO);
  const administrador = await crearUsuarioConPin(pool, cuenta, 'AD01', [rolAdministradorId]);
  const usuario = await crearUsuarioConPin(pool, cuenta, 'US01', [rolMiembroId], {
    superiorId: administrador.id,
  });
  await crearSuscripcion(pool, cuenta);
  const sitioId = await crearSitio(pool, cuenta, `Sitio ${codigo}`);
  const puertaPrincipal = await crearPuerta(pool, cuenta, sitioId, `Principal ${codigo}`, 6);
  const puertaTrasera = await crearPuerta(pool, cuenta, sitioId, `Trasera ${codigo}`);
  return {
    cuenta,
    rolAdministradorId,
    rolTitularId,
    rolMiembroId,
    administrador,
    usuario,
    sitioId,
    puertaPrincipal,
    puertaTrasera,
    dispositivoPrincipal: await crearDispositivo(pool, cuenta, puertaPrincipal.id),
    dispositivoTrasero: await crearDispositivo(pool, cuenta, puertaTrasera.id),
  };
}

export async function contarFilas(
  pool: Pool,
  tabla: string,
  donde = '1 = 1',
  params: unknown[] = [],
): Promise<number> {
  if (!/^[a-z_]+$/.test(tabla)) throw new Error('tabla inválida');
  const [filas] = await pool.query<RowDataPacket[]>(
    ['SELECT COUNT(*) AS total FROM', tabla, 'WHERE', donde].join(' '),
    params,
  );
  return Number(filas[0]?.total);
}

export interface SuperAdminDePrueba {
  readonly id: string;
  readonly usuario: string;
  readonly contrasena: string;
}

/** Un super admin (`tenant_id NULL`) con el rol "Super admin" que siembra el catálogo. */
export async function crearSuperAdmin(
  pool: Pool,
  usuario: string,
  opciones: { contrasena?: string; nombre?: string; activo?: boolean; temporal?: boolean } = {},
): Promise<SuperAdminDePrueba> {
  const contrasena = opciones.contrasena ?? 'contrasena-de-prueba-1';
  const id = await insertar(
    pool,
    'INSERT INTO usuarios (tenant_id, etiqueta, username, contrasena_hash, contrasena_temporal, activo) VALUES (NULL, ?, ?, ?, ?, ?)',
    [
      opciones.nombre ?? `Admin ${usuario}`,
      usuario,
      await hashear(contrasena),
      opciones.temporal === true ? 1 : 0,
      opciones.activo === false ? 0 : 1,
    ],
  );
  await pool.query(
    "INSERT INTO usuario_roles (tenant_id, usuario_id, rol_id) SELECT NULL, ?, id FROM roles WHERE tenant_id IS NULL AND nombre = 'Super admin'",
    [id],
  );
  return { id, usuario, contrasena };
}
