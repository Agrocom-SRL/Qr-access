import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDeFilasDePlataforma } from '../../platform/db/repositorio-de-fila-de-plataforma.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

export interface CuentaFila extends RowDataPacket {
  id: string;
  codigo: string;
  nombre: string;
  activo: number;
}

/** Dueño de `cuentas` (tabla de plataforma). */
export class RepositorioDeCuentas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'cuentas',
      columnas: ['nombre', 'codigo', 'activo'],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  /** Salto del aislamiento: el login busca la cuenta por su código antes de saber cuál es. */
  buscarActivaPorCodigo(codigo: string): Promise<CuentaFila | null> {
    return this.seleccionarUna<CuentaFila>({
      columnas: 't.id, t.codigo, t.nombre, t.activo',
      donde: 't.codigo = ? AND t.activo = 1',
      params: [codigo],
    });
  }

  buscarActivaPorId(id: string): Promise<CuentaFila | null> {
    return this.seleccionarUna<CuentaFila>({
      columnas: 't.id, t.codigo, t.nombre, t.activo',
      donde: 't.id = ? AND t.activo = 1',
      params: [id],
    });
  }
}

export interface UsuarioFila extends RowDataPacket {
  id: string;
  etiqueta: string | null;
  pin_hash: string | null;
  rol_preferido_id: string | null;
  activo: number;
  pin_generado_at: Date | null;
  created_at: Date;
}

const COLUMNAS_DE_USUARIO =
  't.id, t.etiqueta, t.pin_hash, t.rol_preferido_id, t.activo, t.pin_generado_at, t.created_at';

export interface NuevoUsuario {
  readonly etiqueta: string;
  readonly pinIndice: string;
  readonly pinHash: string;
  readonly ahora: Date;
}

export interface PinRegenerado {
  readonly pinIndice: string;
  readonly pinHash: string;
  readonly ahora: Date;
}

/** Dueño de `usuarios`. Con tenant: solo ve los de la cuenta del contexto. */
export class RepositorioDeUsuarios extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'usuarios',
      columnas: [
        'etiqueta',
        'pin_indice',
        'pin_hash',
        'pin_generado_at',
        'username',
        'contrasena_hash',
        'rol_preferido_id',
        'activo',
      ],
      sensibles: ['pin_indice', 'pin_hash', 'contrasena_hash'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  buscarActivoPorIndiceDePin(indice: string): Promise<UsuarioFila | null> {
    return this.seleccionarUna<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: 't.pin_indice = ? AND t.activo = 1',
      params: [indice],
    });
  }

  buscarActivoPorId(id: string): Promise<UsuarioFila | null> {
    return this.seleccionarUna<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: 't.id = ? AND t.activo = 1',
      params: [id],
    });
  }

  async recordarRolPreferido(tx: Transaccion, usuarioId: string, rolId: string): Promise<void> {
    await this.actualizar(tx, usuarioId, { rol_preferido_id: rolId });
  }

  /** Un usuario de la cuenta, esté activo o no (para administrarlo). Borrado = no existe. */
  buscarPorId(id: string): Promise<UsuarioFila | null> {
    return this.seleccionarUna<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: 't.id = ?',
      params: [id],
    });
  }

  buscarPorIds(ids: readonly string[]): Promise<UsuarioFila[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.seleccionar<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: 't.id IN (?)',
      params: [ids],
    });
  }

  /** Los usuarios de la cuenta (cada PIN es uno, ADR 0018 §2), los más nuevos primero. */
  listar(limite: number, desplazamiento: number): Promise<UsuarioFila[]> {
    return this.seleccionar<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      orden: 't.created_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  /** Cuántos usuarios tiene la cuenta: es lo que limita `max_usuarios` del plan (ADR 0017). */
  contarTodos(): Promise<number> {
    return this.contar({});
  }

  crear(tx: Transaccion, usuario: NuevoUsuario): Promise<string> {
    return this.insertar(tx, {
      etiqueta: usuario.etiqueta,
      pin_indice: usuario.pinIndice,
      pin_hash: usuario.pinHash,
      pin_generado_at: usuario.ahora,
      activo: 1,
    });
  }

  /** El PIN anterior deja de servir en el mismo UPDATE (ADR 0018 §2). */
  cambiarPin(tx: Transaccion, id: string, pin: PinRegenerado): Promise<boolean> {
    return this.actualizar(tx, id, {
      pin_indice: pin.pinIndice,
      pin_hash: pin.pinHash,
      pin_generado_at: pin.ahora,
    });
  }

  cambiarEtiqueta(tx: Transaccion, id: string, etiqueta: string): Promise<boolean> {
    return this.actualizar(tx, id, { etiqueta });
  }

  /** Baja lógica (invariante 8): el usuario deja de entrar y su PIN queda libre. */
  darDeBaja(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
}

/** Dueño de `roles` de la cuenta (los de plataforma, con `tenant_id NULL`, no entran acá). */
export class RepositorioDeRoles extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'roles',
      columnas: ['nombre', 'protegido', 'activo'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  /** Alta de un rol de la cuenta del contexto (los tres roles base de una cuenta nueva). */
  crear(tx: Transaccion, rol: { nombre: string; protegido: boolean }): Promise<string> {
    return this.insertar(tx, { nombre: rol.nombre, protegido: rol.protegido ? 1 : 0, activo: 1 });
  }

  listarActivos(): Promise<RolFila[]> {
    return this.seleccionar<RolFila>({
      columnas: 't.id, t.nombre',
      donde: 't.activo = 1',
      orden: 't.nombre, t.id',
    });
  }

  /** Los roles activos de la cuenta con esos ids; uno ajeno o inactivo no vuelve. */
  buscarActivosPorIds(ids: readonly string[]): Promise<RolFila[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.seleccionar<RolFila>({
      columnas: 't.id, t.nombre',
      donde: 't.id IN (?) AND t.activo = 1',
      params: [ids],
    });
  }

  /** Permisos de ámbito cuenta de un rol, tenga o no usuarios asignados (D-19). */
  async permisosDeRol(rolId: string): Promise<string[]> {
    const filas = await this.seleccionar<PermisoFila>({
      columnas: 'DISTINCT p.codigo',
      uniones: [
        'JOIN rol_permisos AS rp ON rp.rol_id = t.id',
        "JOIN permisos AS p ON p.id = rp.permiso_id AND p.ambito = 'cuenta'",
      ].join(' '),
      donde: 't.id = ?',
      params: [rolId],
      orden: 'p.codigo',
    });
    return filas.map((fila) => fila.codigo);
  }
}

export interface RolFila extends RowDataPacket {
  id: string;
  nombre: string;
}

interface PermisoFila extends RowDataPacket {
  codigo: string;
}

interface RolDeUsuarioFila extends RowDataPacket {
  usuario_id: string;
  id: string;
  nombre: string;
}

export interface AsignacionFila extends RowDataPacket {
  id: string;
  rol_id: string;
}

/** Dueño de `usuario_roles` y quien lee `roles`, `rol_permisos` y `permisos` para los permisos efectivos. */
export class RepositorioDeRolesDeUsuario extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'usuario_roles',
      columnas: ['usuario_id', 'rol_id'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  /** Roles de la cuenta, vigentes y activos, que tiene el usuario. */
  rolesDe(usuarioId: string): Promise<RolFila[]> {
    return this.seleccionar<RolFila>({
      columnas: 'r.id, r.nombre',
      uniones:
        'JOIN roles AS r ON r.id = t.rol_id AND r.tenant_id = t.tenant_id AND r.deleted_at IS NULL AND r.activo = 1',
      donde: 't.usuario_id = ?',
      params: [usuarioId],
      orden: 'r.nombre, r.id',
    });
  }

  /** `usuarioId -> roles` de varios usuarios de una vez (listado de usuarios). */
  async rolesDeVarios(usuarioIds: readonly string[]): Promise<Map<string, RolFila[]>> {
    const mapa = new Map<string, RolFila[]>();
    if (usuarioIds.length === 0) return mapa;
    const filas = await this.seleccionar<RolDeUsuarioFila>({
      columnas: 't.usuario_id, r.id, r.nombre',
      uniones:
        'JOIN roles AS r ON r.id = t.rol_id AND r.tenant_id = t.tenant_id AND r.deleted_at IS NULL AND r.activo = 1',
      donde: 't.usuario_id IN (?)',
      params: [usuarioIds],
      orden: 'r.nombre, r.id',
    });
    for (const fila of filas) {
      mapa.set(fila.usuario_id, [
        ...(mapa.get(fila.usuario_id) ?? []),
        { id: fila.id, nombre: fila.nombre } as RolFila,
      ]);
    }
    return mapa;
  }

  /** Las filas de asignación vigentes de un usuario, para agregar o quitar roles. */
  asignacionesDe(usuarioId: string): Promise<AsignacionFila[]> {
    return this.seleccionar<AsignacionFila>({
      columnas: 't.id, t.rol_id',
      donde: 't.usuario_id = ?',
      params: [usuarioId],
    });
  }

  asignar(tx: Transaccion, usuarioId: string, rolId: string): Promise<string> {
    return this.insertar(tx, { usuario_id: usuarioId, rol_id: rolId });
  }

  /** Usuarios activos de la cuenta que tienen el rol protegido "Administrador". */
  contarAdministradores(): Promise<number> {
    return this.contar({
      uniones: [
        "JOIN roles AS r ON r.id = t.rol_id AND r.tenant_id = t.tenant_id AND r.deleted_at IS NULL AND r.protegido = 1 AND r.nombre = 'Administrador'",
        'JOIN usuarios AS u ON u.id = t.usuario_id AND u.tenant_id = t.tenant_id AND u.deleted_at IS NULL AND u.activo = 1',
      ].join(' '),
    });
  }

  quitar(tx: Transaccion, asignacionId: string): Promise<boolean> {
    return this.borrar(tx, asignacionId);
  }

  /** Permisos de ámbito cuenta de UN rol (el activo), nunca la unión de los roles del usuario. */
  async permisosDe(rolId: string): Promise<string[]> {
    const filas = await this.seleccionar<PermisoFila>({
      columnas: 'DISTINCT p.codigo',
      uniones: [
        'JOIN roles AS r ON r.id = t.rol_id AND r.tenant_id = t.tenant_id AND r.deleted_at IS NULL AND r.activo = 1',
        'JOIN rol_permisos AS rp ON rp.rol_id = r.id',
        "JOIN permisos AS p ON p.id = rp.permiso_id AND p.ambito = 'cuenta'",
      ].join(' '),
      donde: 't.rol_id = ?',
      params: [rolId],
      orden: 'p.codigo',
    });
    return filas.map((fila) => fila.codigo);
  }
}

export interface SesionFila extends RowDataPacket {
  id: string;
  /** `null` en la sesión de un super admin. */
  tenant_id: string | null;
  usuario_id: string;
  rol_activo_id: string | null;
  expira_at: Date;
  revocada_at: Date | null;
}

const COLUMNAS_DE_SESION =
  't.id, t.tenant_id, t.usuario_id, t.rol_activo_id, t.expira_at, t.revocada_at';
const DESCRIPCION_DE_SESIONES = {
  nombre: 'sesiones',
  columnas: [
    'usuario_id',
    'rol_activo_id',
    'refresh_hash',
    'agente',
    'ip',
    'expira_at',
    'revocada_at',
  ],
  sensibles: ['refresh_hash'],
  perfil: 'transitoria',
  deCuenta: true,
} as const;

export interface NuevaSesion {
  readonly usuarioId: string;
  readonly rolActivoId: string | null;
  readonly refreshHash: string;
  readonly agente: string | null;
  readonly ip: string | null;
  readonly expiraAt: Date;
}

/** Dueño de `sesiones`. Con tenant: solo las de la cuenta del contexto. */
export class RepositorioDeSesiones extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_SESIONES);
  }

  crear(tx: Transaccion, sesion: NuevaSesion): Promise<string> {
    return this.insertar(tx, {
      usuario_id: sesion.usuarioId,
      rol_activo_id: sesion.rolActivoId,
      refresh_hash: sesion.refreshHash,
      agente: sesion.agente,
      ip: sesion.ip,
      expira_at: sesion.expiraAt,
    });
  }

  buscarPorId(id: string): Promise<SesionFila | null> {
    return this.seleccionarUna<SesionFila>({
      columnas: COLUMNAS_DE_SESION,
      donde: 't.id = ?',
      params: [id],
    });
  }

  /** Cambia el refresh solo si todavía es `refreshActual` y la sesión sigue viva: rotación atómica. */
  rotar(
    tx: Transaccion,
    id: string,
    refreshActual: string,
    refreshNuevo: string,
    expiraAt: Date,
    ahora: Date,
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { refresh_hash: refreshNuevo, expira_at: expiraAt },
      {
        cuando: {
          sql: 'refresh_hash = ? AND revocada_at IS NULL AND expira_at > ?',
          params: [refreshActual, ahora],
        },
      },
    );
  }

  cambiarRolActivo(tx: Transaccion, id: string, rolId: string): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { rol_activo_id: rolId },
      { cuando: { sql: 'revocada_at IS NULL' } },
    );
  }

  revocar(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { revocada_at: ahora },
      { cuando: { sql: 'revocada_at IS NULL' } },
    );
  }

  /** Corta todas las sesiones vivas de un usuario (PIN regenerado o usuario dado de baja, ADR 0018 §2). */
  async revocarTodasDe(tx: Transaccion, usuarioId: string, ahora: Date): Promise<number> {
    const vivas = await this.seleccionar<SesionFila>(
      {
        columnas: COLUMNAS_DE_SESION,
        donde: 't.usuario_id = ? AND t.revocada_at IS NULL',
        params: [usuarioId],
      },
      tx,
    );
    let revocadas = 0;
    for (const sesion of vivas) {
      if (await this.revocar(tx, sesion.id, ahora)) revocadas += 1;
    }
    return revocadas;
  }

  /** `usuarioId -> fecha del último inicio de sesión`; quien nunca entró no figura. */
  async ultimoIngresoDe(usuarioIds: readonly string[]): Promise<Map<string, Date>> {
    const mapa = new Map<string, Date>();
    if (usuarioIds.length === 0) return mapa;
    const filas = await this.seleccionar<UltimoIngresoFila>({
      columnas: 't.usuario_id, MAX(t.created_at) AS ultimo_ingreso_at',
      donde: 't.usuario_id IN (?)',
      params: [usuarioIds],
      agrupar: 't.usuario_id',
    });
    for (const fila of filas) mapa.set(fila.usuario_id, fila.ultimo_ingreso_at);
    return mapa;
  }
}

interface UltimoIngresoFila extends RowDataPacket {
  usuario_id: string;
  ultimo_ingreso_at: Date;
}

/**
 * Lectura de `sesiones` SIN cuenta: el refresh token llega sin JWT, así que la sesión se
 * encuentra por el hash del token (secreto de 256 bits) y de ahí sale la cuenta.
 */
export class RepositorioDeSesionesDePlataforma extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_SESIONES);
  }

  buscarPorRefreshHash(refreshHash: string): Promise<SesionFila | null> {
    return this.seleccionarUna<SesionFila>({
      columnas: COLUMNAS_DE_SESION,
      donde: 't.refresh_hash = ?',
      params: [refreshHash],
    });
  }
}

export interface SuperAdminFila extends RowDataPacket {
  id: string;
  etiqueta: string | null;
  username: string;
  contrasena_hash: string;
  contrasena_temporal: number;
  activo: number;
  created_at: Date;
}

const COLUMNAS_DE_SUPER_ADMIN =
  't.id, t.etiqueta, t.username, t.contrasena_hash, t.contrasena_temporal, t.activo, t.created_at';

export interface NuevoSuperAdmin {
  readonly nombre: string;
  readonly username: string;
  readonly contrasenaHash: string;
}

/**
 * Dueño de las filas de `usuarios` con `tenant_id NULL`: el equipo de AGROCOM. Solo ve y toca
 * esas filas (por construcción), nunca a un usuario de una cuenta.
 */
export class RepositorioDeSuperAdmins extends RepositorioDeFilasDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'usuarios',
      columnas: ['etiqueta', 'username', 'contrasena_hash', 'contrasena_temporal', 'activo'],
      sensibles: ['contrasena_hash'],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  buscarActivoPorUsername(username: string): Promise<SuperAdminFila | null> {
    return this.seleccionarUna<SuperAdminFila>({
      columnas: COLUMNAS_DE_SUPER_ADMIN,
      donde: 't.username = ? AND t.activo = 1',
      params: [username],
    });
  }

  buscarActivoPorId(id: string): Promise<SuperAdminFila | null> {
    return this.seleccionarUna<SuperAdminFila>({
      columnas: COLUMNAS_DE_SUPER_ADMIN,
      donde: 't.id = ? AND t.activo = 1',
      params: [id],
    });
  }

  buscarPorId(id: string): Promise<SuperAdminFila | null> {
    return this.seleccionarUna<SuperAdminFila>({
      columnas: COLUMNAS_DE_SUPER_ADMIN,
      donde: 't.id = ?',
      params: [id],
    });
  }

  /** ¿Hay un super admin vigente (activo o no) con ese usuario? El usuario es único entre los vigentes. */
  async existeUsername(username: string): Promise<boolean> {
    return (await this.contar({ donde: 't.username = ?', params: [username] })) > 0;
  }

  listar(limite: number, desplazamiento: number): Promise<SuperAdminFila[]> {
    return this.seleccionar<SuperAdminFila>({
      columnas: COLUMNAS_DE_SUPER_ADMIN,
      orden: 't.activo DESC, t.etiqueta, t.id',
      limite,
      desplazamiento,
    });
  }

  /** Los super admin con esos ids (activos o no), para mostrar quién registró algo. */
  buscarPorIds(ids: readonly string[]): Promise<SuperAdminFila[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.seleccionar<SuperAdminFila>({
      columnas: COLUMNAS_DE_SUPER_ADMIN,
      donde: 't.id IN (?)',
      params: [ids],
    });
  }

  contarTodos(): Promise<number> {
    return this.contar({});
  }

  contarActivos(): Promise<number> {
    return this.contar({ donde: 't.activo = 1' });
  }

  /** Bloquea las filas de los super admin activos hasta el fin de la transacción (nunca queda un equipo sin activos). */
  async idsActivosBloqueados(tx: Transaccion): Promise<string[]> {
    const filas = await this.seleccionar<RowDataPacket & { id: string }>(
      { columnas: 't.id', donde: 't.activo = 1', orden: 't.id', bloquear: true },
      tx,
    );
    return filas.map((fila) => fila.id);
  }

  crear(tx: Transaccion, nuevo: NuevoSuperAdmin): Promise<string> {
    return this.insertar(tx, {
      etiqueta: nuevo.nombre,
      username: nuevo.username,
      contrasena_hash: nuevo.contrasenaHash,
      contrasena_temporal: 1,
      activo: 1,
    });
  }

  cambiarContrasena(tx: Transaccion, id: string, contrasenaHash: string): Promise<boolean> {
    return this.actualizar(tx, id, { contrasena_hash: contrasenaHash, contrasena_temporal: 0 });
  }

  desactivar(tx: Transaccion, id: string): Promise<boolean> {
    return this.actualizar(tx, id, { activo: 0 });
  }
}

/** Dueño de las filas de `sesiones` con `tenant_id NULL`: las de los super admin. */
export class RepositorioDeSesionesDeSuperAdmins extends RepositorioDeFilasDePlataforma {
  constructor(pool: Pool) {
    super(pool, { ...DESCRIPCION_DE_SESIONES, deCuenta: false });
  }

  crear(tx: Transaccion, sesion: Omit<NuevaSesion, 'rolActivoId'>): Promise<string> {
    return this.insertar(tx, {
      usuario_id: sesion.usuarioId,
      rol_activo_id: null,
      refresh_hash: sesion.refreshHash,
      agente: sesion.agente,
      ip: sesion.ip,
      expira_at: sesion.expiraAt,
    });
  }

  buscarPorId(id: string): Promise<SesionFila | null> {
    return this.seleccionarUna<SesionFila>({
      columnas: COLUMNAS_DE_SESION,
      donde: 't.id = ?',
      params: [id],
    });
  }

  rotar(
    tx: Transaccion,
    id: string,
    refreshActual: string,
    refreshNuevo: string,
    expiraAt: Date,
    ahora: Date,
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { refresh_hash: refreshNuevo, expira_at: expiraAt },
      {
        cuando: {
          sql: 'refresh_hash = ? AND revocada_at IS NULL AND expira_at > ?',
          params: [refreshActual, ahora],
        },
      },
    );
  }

  revocar(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { revocada_at: ahora },
      { cuando: { sql: 'revocada_at IS NULL' } },
    );
  }

  /** Corta todas las sesiones vivas de un super admin (al desactivarlo). */
  async revocarTodasDe(tx: Transaccion, usuarioId: string, ahora: Date): Promise<number> {
    const vivas = await this.seleccionar<SesionFila>(
      {
        columnas: COLUMNAS_DE_SESION,
        donde: 't.usuario_id = ? AND t.revocada_at IS NULL',
        params: [usuarioId],
      },
      tx,
    );
    let revocadas = 0;
    for (const sesion of vivas) {
      if (await this.revocar(tx, sesion.id, ahora)) revocadas += 1;
    }
    return revocadas;
  }

  /** `usuarioId -> fecha del último inicio de sesión`; quien nunca entró no figura. */
  async ultimoIngresoDe(usuarioIds: readonly string[]): Promise<Map<string, Date>> {
    const mapa = new Map<string, Date>();
    if (usuarioIds.length === 0) return mapa;
    const filas = await this.seleccionar<UltimoIngresoFila>({
      columnas: 't.usuario_id, MAX(t.created_at) AS ultimo_ingreso_at',
      donde: 't.usuario_id IN (?)',
      params: [usuarioIds],
      agrupar: 't.usuario_id',
    });
    for (const fila of filas) mapa.set(fila.usuario_id, fila.ultimo_ingreso_at);
    return mapa;
  }
}

/** Dueño de los roles de plataforma (`roles` con `tenant_id NULL`): hoy solo "Super admin". */
export class RepositorioDeRolesDePlataforma extends RepositorioDeFilasDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'roles',
      columnas: ['nombre', 'protegido', 'activo'],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  buscarSuperAdmin(): Promise<RolFila | null> {
    return this.seleccionarUna<RolFila>({
      columnas: 't.id, t.nombre',
      donde: "t.nombre = 'Super admin' AND t.activo = 1",
    });
  }
}

/** Asignaciones y permisos del rol de plataforma de un super admin (`usuario_roles` con `tenant_id NULL`). */
export class RepositorioDeRolesDeSuperAdmin extends RepositorioDeFilasDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'usuario_roles',
      columnas: ['usuario_id', 'rol_id'],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  asignar(tx: Transaccion, usuarioId: string, rolId: string): Promise<string> {
    return this.insertar(tx, { usuario_id: usuarioId, rol_id: rolId });
  }

  /** Permisos de ámbito plataforma de TODOS sus roles de plataforma (hoy solo uno). */
  async permisosDe(usuarioId: string): Promise<string[]> {
    const filas = await this.seleccionar<PermisoFila>({
      columnas: 'DISTINCT p.codigo',
      uniones: [
        'JOIN roles AS r ON r.id = t.rol_id AND r.tenant_id IS NULL AND r.deleted_at IS NULL AND r.activo = 1',
        'JOIN rol_permisos AS rp ON rp.rol_id = r.id',
        "JOIN permisos AS p ON p.id = rp.permiso_id AND p.ambito = 'plataforma'",
      ].join(' '),
      donde: 't.usuario_id = ?',
      params: [usuarioId],
      orden: 'p.codigo',
    });
    return filas.map((fila) => fila.codigo);
  }
}

interface ConteoDeUsuariosFila extends RowDataPacket {
  tenant_id: string;
  /** mysql2 devuelve los conteos como texto cuando son BIGINT. */
  total: string | number;
}

/**
 * Cuántos usuarios activos tiene cada cuenta, para el panel de plataforma. Es un SALTO
 * EXPLÍCITO del aislamiento (RepositorioDePlataforma sobre `usuarios`): solo lee conteos
 * agrupados por cuenta, nunca filas de usuarios, y nunca escribe.
 */
export class RepositorioDeConteoDeUsuarios extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'usuarios',
      columnas: [],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  async activosPorCuenta(cuentaIds: readonly string[]): Promise<Map<string, number>> {
    const mapa = new Map<string, number>();
    if (cuentaIds.length === 0) return mapa;
    const filas = await this.seleccionar<ConteoDeUsuariosFila>({
      columnas: 't.tenant_id, COUNT(*) AS total',
      donde: 't.tenant_id IN (?) AND t.activo = 1',
      params: [cuentaIds],
      agrupar: 't.tenant_id',
    });
    for (const fila of filas) mapa.set(fila.tenant_id, Number(fila.total));
    return mapa;
  }
}

/** Las filas de `cuentas` que el panel de plataforma lista y muestra. */
export interface CuentaDePlataformaFila extends RowDataPacket {
  id: string;
  codigo: string;
  nombre: string;
  activo: number;
  created_at: Date;
}

export interface NuevaCuenta {
  readonly nombre: string;
  readonly codigo: string;
}

/** Administración de `cuentas` por AGROCOM: listar, buscar y dar de alta (tabla de plataforma, sin cuenta). */
export class RepositorioDeCuentasDePlataforma extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'cuentas',
      columnas: ['nombre', 'codigo', 'activo'],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  /** Todas las cuentas vigentes (la plataforma maneja cientos, no millones: se pagina en memoria). */
  listarTodas(): Promise<CuentaDePlataformaFila[]> {
    return this.seleccionar<CuentaDePlataformaFila>({
      columnas: 't.id, t.codigo, t.nombre, t.activo, t.created_at',
      orden: 't.nombre, t.id',
    });
  }

  buscarPorId(id: string): Promise<CuentaDePlataformaFila | null> {
    return this.seleccionarUna<CuentaDePlataformaFila>({
      columnas: 't.id, t.codigo, t.nombre, t.activo, t.created_at',
      donde: 't.id = ?',
      params: [id],
    });
  }

  buscarPorCodigo(codigo: string): Promise<CuentaDePlataformaFila | null> {
    return this.seleccionarUna<CuentaDePlataformaFila>({
      columnas: 't.id, t.codigo, t.nombre, t.activo, t.created_at',
      donde: 't.codigo = ?',
      params: [codigo],
    });
  }

  /** Los códigos que ya tiene alguna cuenta vigente (para sugerir los que quedan libres). */
  async codigosEnUso(): Promise<Set<string>> {
    const filas = await this.seleccionar<RowDataPacket & { codigo: string }>({
      columnas: 't.codigo',
    });
    return new Set(filas.map((fila) => fila.codigo));
  }

  crear(tx: Transaccion, cuenta: NuevaCuenta): Promise<string> {
    return this.insertar(tx, { nombre: cuenta.nombre, codigo: cuenta.codigo, activo: 1 });
  }
}

export interface DatosDeEmpresa {
  readonly nit: string;
  readonly ciudad: string;
  readonly contactoNombre: string;
  readonly contactoTelefono: string;
}

export interface DatosDeEmpresaFila extends RowDataPacket {
  nit: string;
  ciudad: string;
  contacto_nombre: string;
  contacto_telefono: string;
}

/** Dueño de `cuenta_datos_empresa`: la ve y la escribe solo con el contexto de la cuenta. */
export class RepositorioDeDatosDeEmpresa extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'cuenta_datos_empresa',
      columnas: ['nit', 'ciudad', 'contacto_nombre', 'contacto_telefono'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  buscar(): Promise<DatosDeEmpresaFila | null> {
    return this.seleccionarUna<DatosDeEmpresaFila>({
      columnas: 't.nit, t.ciudad, t.contacto_nombre, t.contacto_telefono',
    });
  }

  crear(tx: Transaccion, datos: DatosDeEmpresa): Promise<string> {
    return this.insertar(tx, {
      nit: datos.nit,
      ciudad: datos.ciudad,
      contacto_nombre: datos.contactoNombre,
      contacto_telefono: datos.contactoTelefono,
    });
  }
}

interface PermisoConIdFila extends RowDataPacket {
  id: string;
  codigo: string;
}

/** Catálogo de permisos (tabla de plataforma, solo lectura): para dar a los roles base de una cuenta nueva. */
export class RepositorioDePermisos extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, { nombre: 'permisos', columnas: [], perfil: 'transitoria', deCuenta: false });
  }

  /** `codigo -> id` de los permisos de ámbito cuenta. */
  async deAmbitoCuenta(): Promise<Map<string, string>> {
    const filas = await this.seleccionar<PermisoConIdFila>({
      columnas: 't.id, t.codigo',
      donde: "t.ambito = 'cuenta'",
    });
    return new Map(filas.map((fila) => [fila.codigo, fila.id]));
  }
}

/** `rol_permisos` no tiene cuenta ni autoría propia: la cuenta la da el rol al que se asigna. */
export class RepositorioDeRolPermisos extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'rol_permisos',
      columnas: ['rol_id', 'permiso_id'],
      perfil: 'transitoria',
      deCuenta: false,
    });
  }

  asignar(tx: Transaccion, rolId: string, permisoId: string): Promise<string> {
    return this.insertar(tx, { rol_id: rolId, permiso_id: permisoId });
  }
}

export interface IdentidadFila extends RowDataPacket {
  id: string;
  etiqueta: string | null;
  username: string | null;
  /** `null` = usuario de la plataforma (super admin). */
  tenant_id: string | null;
}

/**
 * Nombres de usuarios de CUALQUIER cuenta y de la plataforma, solo para rotular la bitácora y las
 * listas del panel. Salto EXPLÍCITO del aislamiento: lee id, etiqueta y username; nunca escribe.
 */
export class RepositorioDeIdentidades extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, { nombre: 'usuarios', columnas: [], perfil: 'dominio', deCuenta: true });
  }

  buscarPorIds(ids: readonly string[]): Promise<IdentidadFila[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.seleccionar<IdentidadFila>({
      columnas: 't.id, t.etiqueta, t.username, t.tenant_id',
      donde: 't.id IN (?)',
      params: [ids],
    });
  }
}
