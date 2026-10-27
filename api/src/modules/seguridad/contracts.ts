import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import {
  estadoEfectivo,
  nodosDeEstado,
  type Estado,
  type EstadoEfectivo,
} from './domain/estado.js';
import {
  restringirComoSistema,
  type ResultadoDeRestriccionDelSistema,
} from './cambio-de-estado.js';
import { nivelDeRol, type NivelDeUsuario } from './domain/jerarquia.js';
import {
  RepositorioDeConteoDeUsuarios,
  RepositorioDeCuentas,
  RepositorioDeCuentasDePlataforma,
  RepositorioDeIdentidades,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesionesDePlataforma,
  RepositorioDeSuperAdmins,
  RepositorioDeUsuarios,
} from './repository.js';

export { crearAutenticadorDePlataforma, crearAutenticadorDeUsuario } from './autenticador.js';
export type { Estado, EstadoEfectivo, OrigenDeEstado } from './domain/estado.js';
export type { NivelDeUsuario } from './domain/jerarquia.js';
export type { ResultadoDeRestriccionDelSistema } from './cambio-de-estado.js';

export interface ServicioDeUsuarios {
  /**
   * El estado efectivo del usuario de la cuenta del contexto (ADR 0031 §2): el peor entre el suyo, los
   * de sus superiores y el de su cuenta; `eliminado` si él o un superior ya no existen. Lo usa la
   * validación del QR sobre quien lo generó.
   */
  estadoEfectivoDe(usuarioId: string): Promise<EstadoEfectivo>;
  /**
   * El mismo estado efectivo, leído DENTRO de `tx` y con la cuenta (compartido) y la cadena del usuario
   * bloqueadas hasta que `tx` termine. Es para escribir algo que una suspensión concurrente dejaría vivo
   * (un QR nuevo, ADR 0031 §1): si la suspensión ya se confirmó se ve acá; si no, espera a `tx`.
   */
  estadoEfectivoBloqueando(tx: Transaccion, usuarioId: string): Promise<EstadoEfectivo>;
  /**
   * ¿El usuario existe y puede operar, es decir, no está suspendido (ni él, ni un superior, ni su
   * cuenta) ni eliminado? Restringido sí puede (RF-06, ADR 0033 §1).
   */
  estaActivo(usuarioId: string): Promise<boolean>;
  /** `usuarioId -> etiqueta` de los usuarios de la cuenta (para decir quién generó un QR). */
  etiquetasDe(usuarioIds: readonly string[]): Promise<Map<string, string | null>>;
}

export function crearServicioDeUsuarios(pool: Pool): ServicioDeUsuarios {
  const usuarios = new RepositorioDeUsuarios(pool);
  const cuentas = new RepositorioDeCuentas(pool);
  const estadoEfectivoDe: ServicioDeUsuarios['estadoEfectivoDe'] = async (usuarioId) => {
    const [cadena, cuenta] = await Promise.all([
      usuarios.cadenaDeEstados(usuarioId),
      cuentas.buscarPorId(ContextoCuenta.cuentaRequerida()),
    ]);
    // Una cuenta eliminada no existe: nadie de ella opera.
    if (cuenta === null) return { estado: 'eliminado', origen: null };
    return estadoEfectivo(usuarioId, nodosDeEstado(cadena), cuenta.estado);
  };
  return {
    estadoEfectivoDe,
    async estadoEfectivoBloqueando(tx, usuarioId) {
      // Siempre en este orden (cuenta y luego usuarios): la suspensión de la cuenta bloquea la cuenta primero.
      const cuenta = await cuentas.buscarPorIdCompartida(tx, ContextoCuenta.cuentaRequerida());
      if (cuenta === null) return { estado: 'eliminado', origen: null };
      const cadena = await usuarios.cadenaDeEstadosBloqueada(tx, usuarioId);
      return estadoEfectivo(usuarioId, nodosDeEstado(cadena), cuenta.estado);
    },
    async estaActivo(usuarioId) {
      const { estado } = await estadoEfectivoDe(usuarioId);
      return estado === 'activo' || estado === 'restringido';
    },
    async etiquetasDe(usuarioIds) {
      const filas = await usuarios.buscarPorIds(usuarioIds);
      return new Map(filas.map((fila) => [fila.id, fila.etiqueta]));
    },
  };
}

export interface ServicioDeCuentas {
  /** ¿La cuenta existe (no está eliminada)? Es lo que pide un dispositivo para autenticarse. */
  existe(cuentaId: string): Promise<boolean>;
  /**
   * ¿La cuenta existe y puede operar, o sea, no está suspendida? Una restringida sí (solo deja de generar
   * QR: ADR 0031 §0). Es lo que se pide para vincular una placa nueva.
   */
  estaActiva(cuentaId: string): Promise<boolean>;
  /** Cómo se identifica la cuenta en un aviso (id, código y nombre); `null` si no existe. */
  identificar(cuentaId: string): Promise<{ id: string; codigo: string; nombre: string } | null>;
}

export function crearServicioDeCuentas(pool: Pool): ServicioDeCuentas {
  const cuentas = new RepositorioDeCuentas(pool);
  return {
    async existe(cuentaId) {
      return (await cuentas.buscarPorId(cuentaId)) !== null;
    },
    async estaActiva(cuentaId) {
      const cuenta = await cuentas.buscarPorId(cuentaId);
      return cuenta !== null && cuenta.estado !== 'suspendido';
    },
    async identificar(cuentaId) {
      const cuenta = await cuentas.buscarPorId(cuentaId);
      return cuenta === null
        ? null
        : { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre };
    },
  };
}

export interface ServicioDeConteoDeUsuarios {
  /** `cuentaId -> usuarios activos` (PIN vigentes); una cuenta sin usuarios no figura. Solo para plataforma. */
  activosPorCuenta(cuentaIds: readonly string[]): Promise<Map<string, number>>;
}

export function crearServicioDeConteoDeUsuarios(pool: Pool): ServicioDeConteoDeUsuarios {
  const conteo = new RepositorioDeConteoDeUsuarios(pool);
  return { activosPorCuenta: (cuentaIds) => conteo.activosPorCuenta(cuentaIds) };
}

export interface IdentidadDeUsuario {
  readonly nombre: string;
  /** Es del equipo AGROCOM (`tenant_id NULL`). */
  readonly deLaPlataforma: boolean;
}

export interface CuentaDePlataforma {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  /** `true` si puede operar: no está suspendida (restringida sí). */
  readonly activa: boolean;
  readonly estado: Estado;
  /** Cuándo se creó la cuenta (cliente desde). */
  readonly clienteDesde: Date;
}

/** Lo que el panel de plataforma (bitácora, resumen) necesita saber de las cuentas y de quién hizo un cambio. */
export interface ServicioDeIdentidades {
  /** `usuarioId -> quién es` (etiqueta o usuario) y si es de la plataforma, de cualquier cuenta. */
  identidadesDeUsuarios(ids: readonly string[]): Promise<Map<string, IdentidadDeUsuario>>;
  /** `cuentaId -> cuenta`. */
  cuentas(ids: readonly string[]): Promise<Map<string, CuentaDePlataforma>>;
  /** Todas las cuentas vigentes. */
  todasLasCuentas(): Promise<CuentaDePlataforma[]>;
}

export function crearServicioDeIdentidades(pool: Pool): ServicioDeIdentidades {
  const repositorio = new RepositorioDeCuentasDePlataforma(pool);
  const aCuenta = (fila: {
    id: string;
    codigo: string;
    nombre: string;
    estado: Estado;
    created_at: Date;
  }): CuentaDePlataforma => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    activa: fila.estado !== 'suspendido',
    estado: fila.estado,
    clienteDesde: fila.created_at,
  });
  return {
    async identidadesDeUsuarios(ids) {
      const filas = await new RepositorioDeIdentidades(pool).buscarPorIds(ids);
      return new Map(
        filas.map((fila) => [
          fila.id,
          {
            nombre: fila.etiqueta ?? fila.username ?? '—',
            deLaPlataforma: fila.tenant_id === null,
          },
        ]),
      );
    },
    async cuentas(ids) {
      const todas = await repositorio.listarTodas();
      const pedidas = new Set(ids);
      return new Map(todas.filter((c) => pedidas.has(c.id)).map((c) => [c.id, aCuenta(c)]));
    },
    async todasLasCuentas() {
      return (await repositorio.listarTodas()).map(aCuenta);
    },
  };
}

export interface ServicioDeDestinatarios {
  /**
   * Los usuarios de la cuenta del contexto a quienes llega un aviso: los que pueden operar y cuyo rol tiene el
   * permiso. Es lo que hace que el aviso vaya al propietario (el Administrador) y no a un Titular o un Miembro
   * (ADR 0030 §5).
   */
  deLaCuenta(permiso: string): Promise<string[]>;
  /** Los integrantes del equipo AGROCOM a quienes llega un aviso: los que pueden operar y tienen el permiso. */
  deLaPlataforma(permiso: string): Promise<string[]>;
}

export function crearServicioDeDestinatarios(pool: Pool): ServicioDeDestinatarios {
  return {
    deLaCuenta: (permiso) => new RepositorioDeUsuarios(pool).idsConPermiso(permiso),
    deLaPlataforma: (permiso) => new RepositorioDeSuperAdmins(pool).idsConPermiso(permiso),
  };
}

/** A quiénes alcanza un usuario según su nivel en el árbol (ADR 0028 §4, ADR 0033 §3). */
export interface AlcanceDeUsuarios {
  /** Su nivel; `null` si su rol no tiene uno (falla cerrado: alcanza solo a sí mismo). */
  readonly nivel: NivelDeUsuario | null;
  /**
   * Él mismo y toda su RAMA (los que cuelgan de él, a cualquier profundidad). También para el Administrador: cada
   * Administrador llega solo a su rama, nunca a la de otro de la misma cuenta (ADR 0028 §4). No hay un «toda la
   * cuenta»: `ids` es siempre el límite.
   */
  readonly ids: ReadonlySet<string>;
}

export interface ServicioDeArbol {
  /** El alcance de `usuarioId` en la cuenta del contexto. */
  alcanceDe(usuarioId: string): Promise<AlcanceDeUsuarios>;
  /** `usuarioId` y todos los que cuelgan de él, a cualquier profundidad (una «rama» completa). */
  ramaDe(usuarioId: string): Promise<string[]>;
  /** Los superiores de `usuarioId` (todos los de su cadena, sin orden garantizado), sin él. Vacío si no tiene. */
  superioresDe(usuarioId: string): Promise<string[]>;
  /** El nivel del usuario en el árbol de la cuenta del contexto; `null` si no existe o su rol no tiene uno. */
  nivelDe(usuarioId: string): Promise<NivelDeUsuario | null>;
  /** El estado PROPIO del usuario (no el efectivo); `null` si no existe en la cuenta. Con `tx`, dentro de ella. */
  estadoPropioDe(usuarioId: string, tx?: Transaccion): Promise<Estado | null>;
  /**
   * Restringe como sistema (solo el nivel leve, y solo a un Miembro o un Guardia) dentro de `tx`; ver
   * `restringirComoSistema`. Nunca suspende.
   */
  restringirComoSistema(
    tx: Transaccion,
    usuarioId: string,
    motivo: string,
    ahora: Date,
  ): Promise<ResultadoDeRestriccionDelSistema>;
}

export function crearServicioDeArbol(pool: Pool): ServicioDeArbol {
  const usuarios = new RepositorioDeUsuarios(pool);
  return {
    async alcanceDe(usuarioId) {
      const [roles, rama] = await Promise.all([
        new RepositorioDeRolesDeUsuario(pool).rolesDe(usuarioId),
        usuarios.idsDeRama(usuarioId),
      ]);
      const [unico] = roles;
      const nivel = roles.length === 1 && unico !== undefined ? nivelDeRol(unico.nombre) : null;
      return {
        nivel,
        // Sin nivel no hay rama que valga: solo él (falla cerrado).
        ids: new Set([usuarioId, ...(nivel === null ? [] : rama)]),
      };
    },
    async ramaDe(usuarioId) {
      return [usuarioId, ...(await usuarios.idsDeRama(usuarioId))];
    },
    async nivelDe(usuarioId) {
      const roles = await new RepositorioDeRolesDeUsuario(pool).rolesDe(usuarioId);
      const [unico] = roles;
      return roles.length === 1 && unico !== undefined ? nivelDeRol(unico.nombre) : null;
    },
    async superioresDe(usuarioId) {
      const cadena = await usuarios.cadenaDeEstados(usuarioId);
      return cadena.map((fila) => fila.id).filter((id) => id !== usuarioId);
    },
    async estadoPropioDe(usuarioId, tx) {
      const [usuario] = await usuarios.buscarPorIds([usuarioId], tx);
      return usuario?.estado ?? null;
    },
    restringirComoSistema: (tx, usuarioId, motivo, ahora) =>
      restringirComoSistema(pool, tx, usuarioId, motivo, ahora),
  };
}

/** Un usuario tal como se exporta: nada del PIN, de la contraseña ni de las sesiones (invariante 6). */
export interface UsuarioExportable {
  readonly id: string;
  readonly etiqueta: string | null;
  /** Nombre de su rol (uno solo, ADR 0028); `null` si no tiene. */
  readonly rol: string | null;
  readonly superiorId: string | null;
  /** Su estado propio. */
  readonly estado: Estado;
  readonly estadoMotivo: string | null;
  readonly creadoAt: Date;
}

export interface ServicioDeUsuariosExportables {
  /** Cuántos de esos usuarios existen en la cuenta del contexto (`ids` = el alcance de quien exporta). */
  total(ids: readonly string[]): Promise<number>;
  /** Una página de esos usuarios de la cuenta del contexto, por id. */
  pagina(
    ids: readonly string[],
    limite: number,
    desplazamiento: number,
  ): Promise<UsuarioExportable[]>;
}

export function crearServicioDeUsuariosExportables(pool: Pool): ServicioDeUsuariosExportables {
  const usuarios = new RepositorioDeUsuarios(pool);
  return {
    total: (ids) => usuarios.contarDe(ids),
    async pagina(ids, limite, desplazamiento) {
      const filas = await usuarios.listarPaginaDe(ids, limite, desplazamiento);
      const roles = await new RepositorioDeRolesDeUsuario(pool).rolesDeVarios(
        filas.map((fila) => fila.id),
      );
      return filas.map((fila) => ({
        id: fila.id,
        etiqueta: fila.etiqueta,
        rol: roles.get(fila.id)?.[0]?.nombre ?? null,
        superiorId: fila.superior_id,
        estado: fila.estado,
        estadoMotivo: fila.estado_motivo,
        creadoAt: fila.created_at,
      }));
    },
  };
}

/** Un usuario con sesiones activas desde varias IP (solo cantidades: la IP nunca sale de acá). */
export interface UsuarioConVariasIps {
  readonly cuentaId: string;
  readonly usuarioId: string;
  /** IP distintas entre sus sesiones activas. */
  readonly ips: number;
  /** Instalaciones distintas (`sesiones.instalacion_id`, ola W8) entre sus sesiones activas. */
  readonly instalaciones: number;
  /** Sesiones activas. */
  readonly sesiones: number;
}

export interface ServicioDeSesionesParaSenales {
  /**
   * Quiénes, en CUALQUIER cuenta, tienen sesiones activas (vivas y con actividad desde `desde`) desde al menos
   * `minimo` IP distintas o instalaciones distintas (la mayor de las dos medidas). Es para el detector del sistema (salto explícito del aislamiento, solo lectura). Una
   * página de `limite` ordenada por (cuenta, usuario) a continuación de `despuesDe`. Devuelve cantidades, nunca la IP.
   */
  conVariasIps(
    ahora: Date,
    desde: Date,
    minimo: number,
    limite: number,
    despuesDe?: { readonly cuentaId: string; readonly usuarioId: string } | null,
  ): Promise<UsuarioConVariasIps[]>;
}

export function crearServicioDeSesionesParaSenales(pool: Pool): ServicioDeSesionesParaSenales {
  const repositorio = new RepositorioDeSesionesDePlataforma(pool);
  return {
    async conVariasIps(ahora, desde, minimo, limite, despuesDe = null) {
      const filas = await repositorio.usuariosConVariasIps(ahora, desde, minimo, limite, despuesDe);
      return filas.map((fila) => ({
        cuentaId: fila.tenant_id,
        usuarioId: fila.usuario_id,
        ips: Number(fila.ips),
        instalaciones: Number(fila.instalaciones),
        sesiones: Number(fila.sesiones),
      }));
    },
  };
}
