import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDeFilasDePlataforma } from '../../platform/db/repositorio-de-fila-de-plataforma.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import type { Estado } from './domain/estado.js';
import type { MotivoDeCierre, Plataforma } from './domain/sesion.js';

export interface CuentaFila extends RowDataPacket {
  id: string;
  codigo: string;
  nombre: string;
  estado: Estado;
  /** Tope de Miembros por Titular de la cuenta (ADR 0028 §6). */
  max_miembros_por_titular: number;
}

const COLUMNAS_DE_CUENTA = 't.id, t.codigo, t.nombre, t.estado, t.max_miembros_por_titular';

/** Las columnas del estado que se escriben juntas (la base exige que coincidan, `ck_*_estado_datos`). */
export interface CambioDeEstado {
  readonly estado: Estado;
  /** Quién lo impuso (`null` solo al volver a `activo`). */
  readonly impuestoPor: string | null;
  readonly desde: Date | null;
  readonly motivo: string | null;
}

/** Vuelve a `activo` y limpia los tres campos de apoyo. */
export const SIN_ESTADO: CambioDeEstado = {
  estado: 'activo',
  impuestoPor: null,
  desde: null,
  motivo: null,
};

function columnasDeEstado(cambio: CambioDeEstado): Record<string, unknown> {
  return {
    estado: cambio.estado,
    estado_impuesto_por: cambio.impuestoPor,
    estado_desde: cambio.desde,
    estado_motivo: cambio.motivo,
  };
}

/**
 * Condición de «compare-and-set» sobre el estado leído: si otro lo cambió entre la lectura y el UPDATE
 * no se pisa. `<=>` compara también NULL.
 */
function siSigueEnEstado(estado: Estado, impuestoPor: string | null) {
  return { sql: 'estado = ? AND estado_impuesto_por <=> ?', params: [estado, impuestoPor] };
}

const COLUMNAS_DE_ESTADO_ESCRIBIBLES = [
  'estado',
  'estado_impuesto_por',
  'estado_desde',
  'estado_motivo',
] as const;

/** Dueño de `cuentas` (tabla de plataforma). */
export class RepositorioDeCuentas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'cuentas',
      columnas: ['nombre', 'codigo', ...COLUMNAS_DE_ESTADO_ESCRIBIBLES],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  /**
   * Salto del aislamiento: el login busca la cuenta por su código antes de saber cuál es. Trae la
   * cuenta en cualquier estado (el login distingue «suspendida» solo después de verificar el PIN, para
   * no revelar qué códigos existen); una cuenta eliminada no existe.
   */
  buscarPorCodigo(codigo: string): Promise<CuentaFila | null> {
    return this.seleccionarUna<CuentaFila>({
      columnas: COLUMNAS_DE_CUENTA,
      donde: 't.codigo = ?',
      params: [codigo],
    });
  }

  /** La cuenta en cualquier estado (no eliminada). */
  buscarPorId(id: string): Promise<CuentaFila | null> {
    return this.seleccionarUna<CuentaFila>({
      columnas: COLUMNAS_DE_CUENTA,
      donde: 't.id = ?',
      params: [id],
    });
  }

  /**
   * La cuenta con un bloqueo compartido hasta el fin de la transacción: nadie puede cambiarle el estado
   * (restringirla o suspenderla escribe esta fila) mientras `tx` siga abierta, y varias transacciones a la
   * vez no se esperan entre sí. Lo usa `generar-qr` para que una suspensión concurrente no deje un QR vivo.
   */
  buscarPorIdCompartida(tx: Transaccion, id: string): Promise<CuentaFila | null> {
    return this.seleccionarUna<CuentaFila>(
      { columnas: COLUMNAS_DE_CUENTA, donde: 't.id = ?', params: [id], bloquear: 'compartido' },
      tx,
    );
  }
}

export interface UsuarioFila extends RowDataPacket {
  id: string;
  etiqueta: string | null;
  pin_hash: string | null;
  /** El nivel de arriba en el árbol (ADR 0028); `null` en el Administrador. */
  superior_id: string | null;
  /** Estado propio; el efectivo (con superiores y cuenta) se deriva en `domain/estado.ts`. */
  estado: Estado;
  estado_impuesto_por: string | null;
  estado_desde: Date | null;
  estado_motivo: string | null;
  pin_generado_at: Date | null;
  created_at: Date;
}

const COLUMNAS_DE_USUARIO =
  't.id, t.etiqueta, t.pin_hash, t.superior_id, t.estado, t.estado_impuesto_por, t.estado_desde, t.estado_motivo, t.pin_generado_at, t.created_at';

/** Lo mínimo de un usuario para derivar el estado efectivo. */
export interface UsuarioDeEstadoFila extends RowDataPacket {
  id: string;
  superior_id: string | null;
  estado: Estado;
}

/**
 * Filtro «es X o uno de sus superiores»: X y todos sus ascendientes por `superior_id`. Se recorre sin
 * mirar `deleted_at` (un superior borrado debe notarse), pero la consulta que lo usa ya filtra por la
 * cuenta del contexto y excluye lo borrado: quien falta en el resultado es un superior eliminado, y
 * `estadoEfectivo` lo trata como tal. `UNION` (no `ALL`) corta un ciclo si algún dato lo trajera.
 * Lleva un `?`: el id de X.
 */
const X_Y_SUS_SUPERIORES = `t.id IN (
  WITH RECURSIVE cadena (id, superior_id) AS (
    SELECT s.id, s.superior_id FROM usuarios AS s WHERE s.id = ?
    UNION
    SELECT p.id, p.superior_id FROM usuarios AS p JOIN cadena ON p.id = cadena.superior_id
  )
  SELECT id FROM cadena
)`;

/**
 * Filtro "está en la rama de X": todos los descendientes de X por `superior_id`, sin X. Es la segunda
 * capa sobre el aislamiento por cuenta (ADR 0028 §4): se agrega SIEMPRE al `donde` de una consulta de
 * `RepositorioDeUsuarios`, que ya filtra por la cuenta del contexto, así que un vínculo que cruzara
 * cuentas nunca devolvería filas de otra. Lleva un `?`: el id de X.
 */
const EN_LA_RAMA_DE = `t.id IN (
  WITH RECURSIVE rama (id) AS (
    SELECT h.id FROM usuarios AS h WHERE h.superior_id = ? AND h.deleted_at IS NULL
    UNION
    SELECT n.id FROM usuarios AS n JOIN rama ON n.superior_id = rama.id AND n.deleted_at IS NULL
  )
  SELECT id FROM rama
)`;

export interface NuevoUsuario {
  readonly etiqueta: string;
  /** Quien lo crea y queda arriba de él en el árbol; `null` para el Administrador de una cuenta nueva. */
  readonly superiorId: string | null;
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
        'pin_compartido_at',
        'username',
        'contrasena_hash',
        'superior_id',
        ...COLUMNAS_DE_ESTADO_ESCRIBIBLES,
      ],
      sensibles: ['pin_indice', 'pin_hash', 'contrasena_hash'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  /** El usuario del PIN en cualquier estado: el login decide después qué hacer con uno suspendido. */
  buscarPorIndiceDePin(indice: string): Promise<UsuarioFila | null> {
    return this.seleccionarUna<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: 't.pin_indice = ?',
      params: [indice],
    });
  }

  /**
   * El usuario y todos sus superiores, con lo mínimo para derivar el estado efectivo. Solo de la cuenta
   * del contexto y sin los borrados.
   */
  cadenaDeEstados(id: string, tx?: Transaccion): Promise<UsuarioDeEstadoFila[]> {
    return this.seleccionar<UsuarioDeEstadoFila>(
      { columnas: 't.id, t.superior_id, t.estado', donde: X_Y_SUS_SUPERIORES, params: [id] },
      tx,
    );
  }

  /**
   * Como `cadenaDeEstados`, pero BLOQUEA las filas del usuario y de todos sus superiores (`FOR UPDATE`) hasta
   * el fin de la transacción y devuelve lo que hay AHORA. Suspender o restringir a alguien de la cadena escribe
   * su fila, así que o bien ya está confirmado y se ve acá, o bien espera a que termine `tx`.
   *
   * Sube de un usuario a su superior con una lectura bloqueante cada vez, sin ninguna lectura común antes: la
   * primera lectura común de una transacción fija la foto que verá el resto, y esa foto tiene que ser POSTERIOR
   * al bloqueo para que los conteos que siguen vean lo que otra generación confirmó mientras se esperaba. Un
   * usuario borrado (o un ciclo) corta la cadena: `estadoEfectivo` lo trata como eliminado (falla cerrado).
   */
  async cadenaDeEstadosBloqueada(tx: Transaccion, id: string): Promise<UsuarioDeEstadoFila[]> {
    const cadena: UsuarioDeEstadoFila[] = [];
    const vistos = new Set<string>();
    let actual: string | null = id;
    while (actual !== null && !vistos.has(actual)) {
      vistos.add(actual);
      const fila: UsuarioDeEstadoFila | null = await this.seleccionarUna<UsuarioDeEstadoFila>(
        {
          columnas: 't.id, t.superior_id, t.estado',
          donde: 't.id = ?',
          params: [actual],
          bloquear: true,
        },
        tx,
      );
      if (fila === null) break;
      cadena.push(fila);
      actual = fila.superior_id;
    }
    return cadena;
  }

  /** Todos los usuarios de la cuenta con lo mínimo para derivar su estado efectivo (listados). */
  estadosDeTodos(): Promise<UsuarioDeEstadoFila[]> {
    return this.seleccionar<UsuarioDeEstadoFila>({ columnas: 't.id, t.superior_id, t.estado' });
  }

  /** Un usuario de la cuenta, en el estado que sea (para administrarlo). Borrado = no existe. */
  buscarPorId(id: string): Promise<UsuarioFila | null> {
    return this.seleccionarUna<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: 't.id = ?',
      params: [id],
    });
  }

  buscarPorIds(ids: readonly string[], tx?: Transaccion): Promise<UsuarioFila[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.seleccionar<UsuarioFila>(
      {
        columnas: COLUMNAS_DE_USUARIO,
        donde: 't.id IN (?)',
        params: [ids],
      },
      tx,
    );
  }

  /**
   * Bloquea la fila del usuario hasta el fin de la transacción: serializa sus ingresos simultáneos para que cada
   * uno vea las sesiones del anterior al aplicar el tope (ADR 0030 §4.1) y no choquen por bloqueos de rango.
   */
  async bloquear(tx: Transaccion, id: string): Promise<void> {
    await this.seleccionarUna<RowDataPacket>(
      { columnas: 't.id', donde: 't.id = ?', params: [id], bloquear: true },
      tx,
    );
  }

  /** Un usuario de la rama de `superiorId` (ADR 0028 §4); uno de otra rama o el propio `superiorId` no existe. */
  buscarEnRama(superiorId: string, id: string): Promise<UsuarioFila | null> {
    return this.seleccionarUna<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: `t.id = ? AND ${EN_LA_RAMA_DE}`,
      params: [id, superiorId],
    });
  }

  /** La rama de `superiorId` (cada PIN es un usuario, ADR 0018 §2), los más nuevos primero. */
  listarDeRama(superiorId: string, limite: number, desplazamiento: number): Promise<UsuarioFila[]> {
    return this.seleccionar<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: EN_LA_RAMA_DE,
      params: [superiorId],
      orden: 't.created_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contarDeRama(superiorId: string): Promise<number> {
    return this.contar({ donde: EN_LA_RAMA_DE, params: [superiorId] });
  }

  /** Los ids de toda la rama de `id` (sus descendientes, sin él): lo que cae con su baja en cascada. */
  async idsDeRama(id: string, tx?: Transaccion): Promise<string[]> {
    const filas = await this.seleccionar<RowDataPacket & { id: string }>(
      {
        columnas: 't.id',
        donde: EN_LA_RAMA_DE,
        params: [id],
        orden: 't.id',
      },
      tx,
    );
    return filas.map((fila) => fila.id);
  }

  /** Cuántos usuarios cuelgan directamente de `id` (para no dejar huérfanos al darlo de baja). */
  contarDirectos(id: string): Promise<number> {
    return this.contar({ donde: 't.superior_id = ?', params: [id] });
  }

  /** Toda la rama de `superiorId`, sin paginar: para las estadísticas de uso de quien la administra. */
  todosDeRama(superiorId: string): Promise<UsuarioFila[]> {
    return this.seleccionar<UsuarioFila>({
      columnas: COLUMNAS_DE_USUARIO,
      donde: EN_LA_RAMA_DE,
      params: [superiorId],
      orden: 't.etiqueta, t.id',
    });
  }

  /** Todos los usuarios de la cuenta, sin filtro de rama: solo para la ficha que ve AGROCOM. */
  listarTodos(tx?: Transaccion): Promise<UsuarioFila[]> {
    return this.seleccionar<UsuarioFila>(
      {
        columnas: COLUMNAS_DE_USUARIO,
        orden: 't.etiqueta, t.id',
      },
      tx,
    );
  }

  /** Cuelga a `id` de otro Administrador; sus Miembros y su unidad lo siguen por el árbol (ADR 0028 §7). */
  cambiarSuperior(tx: Transaccion, id: string, superiorId: string): Promise<boolean> {
    return this.actualizar(tx, id, { superior_id: superiorId });
  }

  /** Cuántos usuarios tiene la cuenta: es lo que limita `max_usuarios` del plan (ADR 0017). */
  contarTodos(): Promise<number> {
    return this.contar({});
  }

  crear(tx: Transaccion, usuario: NuevoUsuario): Promise<string> {
    return this.insertar(tx, {
      etiqueta: usuario.etiqueta,
      superior_id: usuario.superiorId,
      pin_indice: usuario.pinIndice,
      pin_hash: usuario.pinHash,
      pin_generado_at: usuario.ahora,
    });
  }

  /**
   * Cambia el estado propio de `id` solo si sigue como lo leyó quien decide (`antes`): dos personas que
   * cambian el mismo estado a la vez no se pisan, la segunda recibe `false`. La bitácora lo registra.
   */
  cambiarEstado(
    tx: Transaccion,
    id: string,
    antes: { readonly estado: Estado; readonly impuestoPor: string | null },
    cambio: CambioDeEstado,
  ): Promise<boolean> {
    return this.actualizar(tx, id, columnasDeEstado(cambio), {
      cuando: siSigueEnEstado(antes.estado, antes.impuestoPor),
    });
  }

  /**
   * Cambia solo QUIÉN impuso el estado propio de `id` (el estado, el motivo y el desde no se tocan). Lo usa
   * la reasignación de AGROCOM: quien impuso el estado ya no está sobre el usuario movido. La bitácora lo
   * registra.
   */
  cambiarQuienImpusoElEstado(tx: Transaccion, id: string, impuestoPor: string): Promise<boolean> {
    return this.actualizar(tx, id, { estado_impuesto_por: impuestoPor });
  }

  /** El PIN anterior deja de servir en el mismo UPDATE (ADR 0018 §2). */
  cambiarPin(tx: Transaccion, id: string, pin: PinRegenerado): Promise<boolean> {
    return this.actualizar(tx, id, {
      pin_indice: pin.pinIndice,
      pin_hash: pin.pinHash,
      pin_generado_at: pin.ahora,
    });
  }

  /**
   * Anota que el PIN de `id` se compartió por un canal de terceros (ADR 0028 §7). Es un cambio más de
   * `usuarios`: la bitácora lo registra con quién lo hizo, cuándo y la fecha anterior; el PIN no.
   */
  marcarPinCompartido(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.actualizar(tx, id, { pin_compartido_at: ahora });
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

  /** El rol activo de la cuenta con ese nombre (los roles base son únicos por nombre). */
  buscarActivoPorNombre(nombre: string): Promise<RolFila | null> {
    return this.seleccionarUna<RolFila>({
      columnas: 't.id, t.nombre',
      donde: 't.nombre = ? AND t.activo = 1',
      params: [nombre],
    });
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

  asignar(tx: Transaccion, usuarioId: string, rolId: string): Promise<string> {
    return this.insertar(tx, { usuario_id: usuarioId, rol_id: rolId });
  }

  /** Ids de los usuarios no suspendidos de la cuenta con el rol protegido "Administrador". */
  async idsDeAdministradores(): Promise<string[]> {
    const filas = await this.seleccionar<RowDataPacket & { usuario_id: string }>({
      columnas: 'DISTINCT t.usuario_id',
      uniones: [
        "JOIN roles AS r ON r.id = t.rol_id AND r.tenant_id = t.tenant_id AND r.deleted_at IS NULL AND r.protegido = 1 AND r.nombre = 'Administrador'",
        "JOIN usuarios AS u ON u.id = t.usuario_id AND u.tenant_id = t.tenant_id AND u.deleted_at IS NULL AND u.estado <> 'suspendido'",
      ].join(' '),
      orden: 't.usuario_id',
    });
    return filas.map((fila) => fila.usuario_id);
  }

  /** Usuarios no suspendidos de la cuenta que tienen el rol protegido "Administrador". */
  contarAdministradores(): Promise<number> {
    return this.contar({
      uniones: [
        "JOIN roles AS r ON r.id = t.rol_id AND r.tenant_id = t.tenant_id AND r.deleted_at IS NULL AND r.protegido = 1 AND r.nombre = 'Administrador'",
        "JOIN usuarios AS u ON u.id = t.usuario_id AND u.tenant_id = t.tenant_id AND u.deleted_at IS NULL AND u.estado <> 'suspendido'",
      ].join(' '),
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
  /** `null` en la sesión de un super admin. */
  tenant_id: string | null;
  usuario_id: string;
  rol_activo_id: string | null;
  expira_at: Date;
  revocada_at: Date | null;
  ultima_actividad_at: Date | null;
}

/** Una sesión viva tal como se lista (ADR 0030 §4.1). Nunca lleva el refresh. */
export interface SesionDetalleFila extends RowDataPacket {
  id: string;
  usuario_id: string;
  instalacion_id: string | null;
  plataforma: Plataforma | null;
  nombre_dispositivo: string | null;
  ip: string | null;
  ultima_actividad_at: Date | null;
  created_at: Date;
  expira_at: Date;
}

const COLUMNAS_DE_SESION =
  't.id, t.tenant_id, t.usuario_id, t.rol_activo_id, t.expira_at, t.revocada_at, t.ultima_actividad_at';
const COLUMNAS_DE_DETALLE =
  't.id, t.usuario_id, t.instalacion_id, t.plataforma, t.nombre_dispositivo, t.ip, t.ultima_actividad_at, t.created_at, t.expira_at';
/** Viva = sin revocar y sin vencer; el `?` es el instante de la consulta. */
const SESION_VIVA = 't.revocada_at IS NULL AND t.expira_at > ?';
const MAS_RECIENTE_PRIMERO = 't.ultima_actividad_at DESC, t.id DESC';

/** Quién y por qué cierra una sesión: queda en la sesión y en la bitácora. */
export interface CierreSolicitado {
  readonly motivo: MotivoDeCierre;
  readonly porUsuarioId: string | null;
}
const DESCRIPCION_DE_SESIONES = {
  nombre: 'sesiones',
  columnas: [
    'usuario_id',
    'rol_activo_id',
    'refresh_hash',
    'agente',
    'ip',
    'instalacion_id',
    'plataforma',
    'nombre_dispositivo',
    'ultima_actividad_at',
    'expira_at',
    'revocada_at',
    'motivo_cierre',
    'revocada_por',
  ],
  // El identificador de instalación y la IP no se copian a la bitácora (ADR 0030 §4.1).
  sensibles: ['refresh_hash', 'instalacion_id', 'ip'],
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
  /** Identificador aleatorio de la instalación (la app lo genera); `null` en clientes que no lo mandan. */
  readonly instalacionId: string | null;
  readonly plataforma: Plataforma | null;
  readonly nombreDeDispositivo: string | null;
  readonly ahora: Date;
}

/** Los valores que se escriben al abrir una sesión, comunes a las de cuenta y a las de plataforma. */
function valoresDeSesionNueva(sesion: NuevaSesion): Record<string, unknown> {
  return {
    usuario_id: sesion.usuarioId,
    refresh_hash: sesion.refreshHash,
    agente: sesion.agente,
    ip: sesion.ip,
    instalacion_id: sesion.instalacionId,
    plataforma: sesion.plataforma,
    nombre_dispositivo: sesion.nombreDeDispositivo,
    ultima_actividad_at: sesion.ahora,
    expira_at: sesion.expiraAt,
  };
}

/** Dueño de `sesiones`. Con tenant: solo las de la cuenta del contexto. */
export class RepositorioDeSesiones extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_SESIONES);
  }

  crear(tx: Transaccion, sesion: NuevaSesion): Promise<string> {
    return this.insertar(tx, {
      ...valoresDeSesionNueva(sesion),
      rol_activo_id: sesion.rolActivoId,
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
    ip: string | null = null,
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      {
        refresh_hash: refreshNuevo,
        expira_at: expiraAt,
        ultima_actividad_at: ahora,
        ...(ip === null ? {} : { ip }),
      },
      {
        cuando: {
          sql: 'refresh_hash = ? AND revocada_at IS NULL AND expira_at > ?',
          params: [refreshActual, ahora],
        },
      },
    );
  }

  /**
   * Revoca una sesión sin bitácora, como todo cambio rutinario de `sesiones`: salir (`motivo` 'salida') o
   * cortar las del usuario por un PIN nuevo, una baja o una suspensión (sin motivo).
   */
  revocar(
    tx: Transaccion,
    id: string,
    ahora: Date,
    motivo: MotivoDeCierre | null = null,
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { revocada_at: ahora, ...(motivo === null ? {} : { motivo_cierre: motivo }) },
      { cuando: { sql: 'revocada_at IS NULL' } },
    );
  }

  /** Las sesiones vivas de un usuario de la cuenta, la de actividad más reciente primero. Con `tx`, las bloquea. */
  vivasDe(usuarioId: string, ahora: Date, tx?: Transaccion): Promise<SesionDetalleFila[]> {
    return this.seleccionar<SesionDetalleFila>(
      {
        columnas: COLUMNAS_DE_DETALLE,
        donde: `t.usuario_id = ? AND ${SESION_VIVA}`,
        params: [usuarioId, ahora],
        orden: MAS_RECIENTE_PRIMERO,
        ...(tx === undefined ? {} : { bloquear: true }),
      },
      tx,
    );
  }

  /** Las sesiones vivas de una instalación (de cualquier usuario de la cuenta), para el tope por instalación. */
  vivasDeInstalacion(
    instalacionId: string,
    ahora: Date,
    tx: Transaccion,
  ): Promise<SesionDetalleFila[]> {
    return this.seleccionar<SesionDetalleFila>(
      {
        columnas: COLUMNAS_DE_DETALLE,
        donde: `t.instalacion_id = ? AND ${SESION_VIVA}`,
        params: [instalacionId, ahora],
        orden: MAS_RECIENTE_PRIMERO,
        bloquear: true,
      },
      tx,
    );
  }

  /** Una sesión viva de ese usuario; de otro usuario, de otra cuenta, cerrada o vencida no existe. */
  buscarVivaDe(usuarioId: string, id: string, ahora: Date): Promise<SesionDetalleFila | null> {
    return this.seleccionarUna<SesionDetalleFila>({
      columnas: COLUMNAS_DE_DETALLE,
      donde: `t.id = ? AND t.usuario_id = ? AND ${SESION_VIVA}`,
      params: [id, usuarioId, ahora],
    });
  }

  /** Cierra una sesión dejando quién y por qué, y una fila en la bitácora (ADR 0007). */
  cerrar(tx: Transaccion, id: string, ahora: Date, cierre: CierreSolicitado): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { revocada_at: ahora, motivo_cierre: cierre.motivo, revocada_por: cierre.porUsuarioId },
      { cuando: { sql: 'revocada_at IS NULL' }, auditar: true },
    );
  }

  /** Cierra las sesiones vivas de un usuario, salvo `exceptoId`; devuelve cuántas cerró. */
  async cerrarVivasDe(
    tx: Transaccion,
    usuarioId: string,
    ahora: Date,
    cierre: CierreSolicitado,
    exceptoId: string | null = null,
  ): Promise<number> {
    let cerradas = 0;
    for (const sesion of await this.vivasDe(usuarioId, ahora, tx)) {
      if (sesion.id === exceptoId) continue;
      if (await this.cerrar(tx, sesion.id, ahora, cierre)) cerradas += 1;
    }
    return cerradas;
  }

  /**
   * Bloquea la fila del dueño de las sesiones, igual que el ingreso: cerrar todas y abrir una nueva se
   * ordenan en vez de cruzar sus bloqueos de filas (deadlock).
   */
  async bloquearDueno(tx: Transaccion, usuarioId: string): Promise<void> {
    await new RepositorioDeUsuarios(this.pool).bloquear(tx, usuarioId);
  }

  /** Anota la última actividad de una sesión viva. Es telemetría: sin bitácora. */
  registrarActividad(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { ultima_actividad_at: ahora },
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
  /** El equipo AGROCOM solo está `activo` o `suspendido` (desactivado). */
  estado: Estado;
  created_at: Date;
}

const COLUMNAS_DE_SUPER_ADMIN =
  't.id, t.etiqueta, t.username, t.contrasena_hash, t.contrasena_temporal, t.estado, t.created_at';

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
      columnas: [
        'etiqueta',
        'username',
        'contrasena_hash',
        'contrasena_temporal',
        ...COLUMNAS_DE_ESTADO_ESCRIBIBLES,
      ],
      sensibles: ['contrasena_hash'],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  /**
   * Bloquea la fila del super admin (los ingresos simultáneos suyos se esperan) y dice si SIGUE activo: leída
   * con `FOR UPDATE`, ve lo que una desactivación concurrente ya confirmó.
   */
  async bloquearSiActivo(tx: Transaccion, id: string): Promise<boolean> {
    const fila = await this.seleccionarUna<RowDataPacket>(
      { columnas: 't.id', donde: "t.id = ? AND t.estado = 'activo'", params: [id], bloquear: true },
      tx,
    );
    return fila !== null;
  }

  buscarActivoPorUsername(username: string): Promise<SuperAdminFila | null> {
    return this.seleccionarUna<SuperAdminFila>({
      columnas: COLUMNAS_DE_SUPER_ADMIN,
      donde: "t.username = ? AND t.estado = 'activo'",
      params: [username],
    });
  }

  buscarActivoPorId(id: string): Promise<SuperAdminFila | null> {
    return this.seleccionarUna<SuperAdminFila>({
      columnas: COLUMNAS_DE_SUPER_ADMIN,
      donde: "t.id = ? AND t.estado = 'activo'",
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
      orden: "(t.estado = 'activo') DESC, t.etiqueta, t.id",
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
    return this.contar({ donde: "t.estado = 'activo'" });
  }

  /** Bloquea las filas de los super admin activos hasta el fin de la transacción (nunca queda un equipo sin activos). */
  async idsActivosBloqueados(tx: Transaccion): Promise<string[]> {
    const filas = await this.seleccionar<RowDataPacket & { id: string }>(
      { columnas: 't.id', donde: "t.estado = 'activo'", orden: 't.id', bloquear: true },
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
    });
  }

  cambiarContrasena(tx: Transaccion, id: string, contrasenaHash: string): Promise<boolean> {
    return this.actualizar(tx, id, { contrasena_hash: contrasenaHash, contrasena_temporal: 0 });
  }

  /** Desactivar a alguien del equipo es dejarlo `suspendido`, con quién lo hizo, desde cuándo y por qué. */
  desactivar(tx: Transaccion, id: string, cambio: CambioDeEstado): Promise<boolean> {
    return this.actualizar(tx, id, columnasDeEstado(cambio));
  }

  reactivar(tx: Transaccion, id: string): Promise<boolean> {
    return this.actualizar(tx, id, columnasDeEstado(SIN_ESTADO));
  }

  renombrar(tx: Transaccion, id: string, nombre: string): Promise<boolean> {
    return this.actualizar(tx, id, { etiqueta: nombre });
  }
}

/** Dueño de las filas de `sesiones` con `tenant_id NULL`: las de los super admin. */
export class RepositorioDeSesionesDeSuperAdmins extends RepositorioDeFilasDePlataforma {
  constructor(pool: Pool) {
    super(pool, { ...DESCRIPCION_DE_SESIONES, deCuenta: false });
  }

  crear(tx: Transaccion, sesion: Omit<NuevaSesion, 'rolActivoId'>): Promise<string> {
    return this.insertar(tx, {
      ...valoresDeSesionNueva({ ...sesion, rolActivoId: null }),
      rol_activo_id: null,
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
    ip: string | null = null,
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      {
        refresh_hash: refreshNuevo,
        expira_at: expiraAt,
        ultima_actividad_at: ahora,
        ...(ip === null ? {} : { ip }),
      },
      {
        cuando: {
          sql: 'refresh_hash = ? AND revocada_at IS NULL AND expira_at > ?',
          params: [refreshActual, ahora],
        },
      },
    );
  }

  /** Revoca sin bitácora: salir (`motivo` 'salida') o cortar las del super admin al desactivarlo (sin motivo). */
  revocar(
    tx: Transaccion,
    id: string,
    ahora: Date,
    motivo: MotivoDeCierre | null = null,
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { revocada_at: ahora, ...(motivo === null ? {} : { motivo_cierre: motivo }) },
      { cuando: { sql: 'revocada_at IS NULL' } },
    );
  }

  /** Las sesiones vivas de un super admin, la de actividad más reciente primero. Con `tx`, las bloquea. */
  vivasDe(usuarioId: string, ahora: Date, tx?: Transaccion): Promise<SesionDetalleFila[]> {
    return this.seleccionar<SesionDetalleFila>(
      {
        columnas: COLUMNAS_DE_DETALLE,
        donde: `t.usuario_id = ? AND ${SESION_VIVA}`,
        params: [usuarioId, ahora],
        orden: MAS_RECIENTE_PRIMERO,
        ...(tx === undefined ? {} : { bloquear: true }),
      },
      tx,
    );
  }

  /** Las sesiones vivas de una instalación entre los super admin, para el tope por instalación. */
  vivasDeInstalacion(
    instalacionId: string,
    ahora: Date,
    tx: Transaccion,
  ): Promise<SesionDetalleFila[]> {
    return this.seleccionar<SesionDetalleFila>(
      {
        columnas: COLUMNAS_DE_DETALLE,
        donde: `t.instalacion_id = ? AND ${SESION_VIVA}`,
        params: [instalacionId, ahora],
        orden: MAS_RECIENTE_PRIMERO,
        bloquear: true,
      },
      tx,
    );
  }

  /**
   * Bloquea la fila del dueño de las sesiones, igual que el ingreso: cerrar todas y abrir una nueva se
   * ordenan en vez de cruzar sus bloqueos de filas (deadlock).
   */
  async bloquearDueno(tx: Transaccion, usuarioId: string): Promise<void> {
    await new RepositorioDeSuperAdmins(this.pool).bloquearSiActivo(tx, usuarioId);
  }

  buscarVivaDe(usuarioId: string, id: string, ahora: Date): Promise<SesionDetalleFila | null> {
    return this.seleccionarUna<SesionDetalleFila>({
      columnas: COLUMNAS_DE_DETALLE,
      donde: `t.id = ? AND t.usuario_id = ? AND ${SESION_VIVA}`,
      params: [id, usuarioId, ahora],
    });
  }

  cerrar(tx: Transaccion, id: string, ahora: Date, cierre: CierreSolicitado): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { revocada_at: ahora, motivo_cierre: cierre.motivo, revocada_por: cierre.porUsuarioId },
      { cuando: { sql: 'revocada_at IS NULL' }, auditar: true },
    );
  }

  async cerrarVivasDe(
    tx: Transaccion,
    usuarioId: string,
    ahora: Date,
    cierre: CierreSolicitado,
    exceptoId: string | null = null,
  ): Promise<number> {
    let cerradas = 0;
    for (const sesion of await this.vivasDe(usuarioId, ahora, tx)) {
      if (sesion.id === exceptoId) continue;
      if (await this.cerrar(tx, sesion.id, ahora, cierre)) cerradas += 1;
    }
    return cerradas;
  }

  registrarActividad(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { ultima_actividad_at: ahora },
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
 * Cuántos usuarios no suspendidos tiene cada cuenta, para el panel de plataforma. Es un SALTO
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
      donde: "t.tenant_id IN (?) AND t.estado <> 'suspendido'",
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
  estado: Estado;
  estado_impuesto_por: string | null;
  estado_desde: Date | null;
  estado_motivo: string | null;
  /** Tope de Miembros por Titular de la cuenta (ADR 0028 §6). */
  max_miembros_por_titular: number;
  created_at: Date;
}

const COLUMNAS_DE_CUENTA_DE_PLATAFORMA =
  't.id, t.codigo, t.nombre, t.estado, t.estado_impuesto_por, t.estado_desde, t.estado_motivo, t.max_miembros_por_titular, t.created_at';

export interface NuevaCuenta {
  readonly nombre: string;
  readonly codigo: string;
}

/** Administración de `cuentas` por AGROCOM: listar, buscar y dar de alta (tabla de plataforma, sin cuenta). */
export class RepositorioDeCuentasDePlataforma extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'cuentas',
      columnas: ['nombre', 'codigo', ...COLUMNAS_DE_ESTADO_ESCRIBIBLES, 'max_miembros_por_titular'],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  /** Todas las cuentas vigentes (la plataforma maneja cientos, no millones: se pagina en memoria). */
  listarTodas(): Promise<CuentaDePlataformaFila[]> {
    return this.seleccionar<CuentaDePlataformaFila>({
      columnas: COLUMNAS_DE_CUENTA_DE_PLATAFORMA,
      orden: 't.nombre, t.id',
    });
  }

  buscarPorId(id: string): Promise<CuentaDePlataformaFila | null> {
    return this.seleccionarUna<CuentaDePlataformaFila>({
      columnas: COLUMNAS_DE_CUENTA_DE_PLATAFORMA,
      donde: 't.id = ?',
      params: [id],
    });
  }

  buscarPorCodigo(codigo: string): Promise<CuentaDePlataformaFila | null> {
    return this.seleccionarUna<CuentaDePlataformaFila>({
      columnas: COLUMNAS_DE_CUENTA_DE_PLATAFORMA,
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
    return this.insertar(tx, { nombre: cuenta.nombre, codigo: cuenta.codigo });
  }

  /**
   * Cambia el código de la cuenta (las 3 primeras letras de todos sus PIN). Los PIN no se tocan:
   * su verificación no depende del código (ADR 0023).
   */
  cambiarCodigo(tx: Transaccion, id: string, codigo: string): Promise<boolean> {
    return this.actualizar(tx, id, { codigo });
  }

  /** Corrige la razón social. */
  renombrar(tx: Transaccion, id: string, nombre: string): Promise<boolean> {
    return this.actualizar(tx, id, { nombre });
  }

  /** Cambia cuántos Miembros puede tener cada Titular de la cuenta (ADR 0028 §6). */
  cambiarMaxMiembros(tx: Transaccion, id: string, maximo: number): Promise<boolean> {
    return this.actualizar(tx, id, { max_miembros_por_titular: maximo });
  }

  /**
   * Cambia el estado de la cuenta solo si sigue como lo leyó quien decide (`antes`), con quién lo
   * impuso, desde cuándo y por qué. La bitácora lo registra.
   */
  cambiarEstado(
    tx: Transaccion,
    id: string,
    antes: { readonly estado: Estado; readonly impuestoPor: string | null },
    cambio: CambioDeEstado,
  ): Promise<boolean> {
    return this.actualizar(tx, id, columnasDeEstado(cambio), {
      cuando: siSigueEnEstado(antes.estado, antes.impuestoPor),
    });
  }

  /** Baja lógica de la cuenta: nadie de ella vuelve a ingresar y su código queda libre. */
  eliminar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
}

export interface DatosDeEmpresa {
  readonly nit: string | null;
  readonly ciudad: string;
  readonly contactoNombre: string;
  readonly contactoApellido: string;
  readonly contactoTelefono: string | null;
  readonly contactoCorreo: string | null;
}

export interface DatosDeEmpresaFila extends RowDataPacket {
  id: string;
  nit: string | null;
  ciudad: string;
  contacto_nombre: string;
  contacto_apellido: string;
  contacto_telefono: string | null;
  contacto_correo: string | null;
}

/** Dueño de `cuenta_datos_empresa`: la ve y la escribe solo con el contexto de la cuenta. */
export class RepositorioDeDatosDeEmpresa extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'cuenta_datos_empresa',
      columnas: [
        'nit',
        'ciudad',
        'contacto_nombre',
        'contacto_apellido',
        'contacto_telefono',
        'contacto_correo',
      ],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  buscar(): Promise<DatosDeEmpresaFila | null> {
    return this.seleccionarUna<DatosDeEmpresaFila>({
      columnas:
        't.id, t.nit, t.ciudad, t.contacto_nombre, t.contacto_apellido, t.contacto_telefono, t.contacto_correo',
    });
  }

  /** Corrige los datos de la empresa de la cuenta del contexto. */
  corregir(tx: Transaccion, id: string, datos: DatosDeEmpresa): Promise<boolean> {
    return this.actualizar(tx, id, {
      nit: datos.nit,
      ciudad: datos.ciudad,
      contacto_nombre: datos.contactoNombre,
      contacto_apellido: datos.contactoApellido,
      contacto_telefono: datos.contactoTelefono,
      contacto_correo: datos.contactoCorreo,
    });
  }

  crear(tx: Transaccion, datos: DatosDeEmpresa): Promise<string> {
    return this.insertar(tx, {
      nit: datos.nit,
      ciudad: datos.ciudad,
      contacto_nombre: datos.contactoNombre,
      contacto_apellido: datos.contactoApellido,
      contacto_telefono: datos.contactoTelefono,
      contacto_correo: datos.contactoCorreo,
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
