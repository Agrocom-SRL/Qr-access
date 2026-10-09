import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
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
}

const COLUMNAS_DE_USUARIO = 't.id, t.etiqueta, t.pin_hash, t.rol_preferido_id, t.activo';

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
}

export interface RolFila extends RowDataPacket {
  id: string;
  nombre: string;
}

interface PermisoFila extends RowDataPacket {
  codigo: string;
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
  tenant_id: string;
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
