import type { Pool } from 'mysql2/promise';
import {
  RepositorioDeConteoDeUsuarios,
  RepositorioDeCuentas,
  RepositorioDeCuentasDePlataforma,
  RepositorioDeIdentidades,
  RepositorioDeUsuarios,
} from './repository.js';

export { crearAutenticadorDePlataforma, crearAutenticadorDeUsuario } from './autenticador.js';

export interface ServicioDeUsuarios {
  /** ¿El usuario de la cuenta del contexto existe y está activo? (RF-06: uno desactivado no abre puertas) */
  estaActivo(usuarioId: string): Promise<boolean>;
  /** `usuarioId -> etiqueta` de los usuarios de la cuenta (para decir quién generó un QR). */
  etiquetasDe(usuarioIds: readonly string[]): Promise<Map<string, string | null>>;
}

export function crearServicioDeUsuarios(pool: Pool): ServicioDeUsuarios {
  const usuarios = new RepositorioDeUsuarios(pool);
  return {
    async estaActivo(usuarioId) {
      return (await usuarios.buscarActivoPorId(usuarioId)) !== null;
    },
    async etiquetasDe(usuarioIds) {
      const filas = await usuarios.buscarPorIds(usuarioIds);
      return new Map(filas.map((fila) => [fila.id, fila.etiqueta]));
    },
  };
}

export interface ServicioDeCuentas {
  /** ¿La cuenta existe y está activa? Una cuenta dada de baja no autentica ni a sus dispositivos. */
  estaActiva(cuentaId: string): Promise<boolean>;
}

export function crearServicioDeCuentas(pool: Pool): ServicioDeCuentas {
  const cuentas = new RepositorioDeCuentas(pool);
  return {
    async estaActiva(cuentaId) {
      return (await cuentas.buscarActivaPorId(cuentaId)) !== null;
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
  readonly activa: boolean;
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
    activo: number;
    created_at: Date;
  }): CuentaDePlataforma => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    activa: fila.activo === 1,
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
