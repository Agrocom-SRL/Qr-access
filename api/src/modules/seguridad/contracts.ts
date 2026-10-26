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
  RepositorioDeConteoDeUsuarios,
  RepositorioDeCuentas,
  RepositorioDeCuentasDePlataforma,
  RepositorioDeIdentidades,
  RepositorioDeUsuarios,
} from './repository.js';

export { crearAutenticadorDePlataforma, crearAutenticadorDeUsuario } from './autenticador.js';
export type { Estado, EstadoEfectivo, OrigenDeEstado } from './domain/estado.js';

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
