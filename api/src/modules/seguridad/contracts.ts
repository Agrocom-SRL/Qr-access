import type { Pool } from 'mysql2/promise';
import { RepositorioDeCuentas, RepositorioDeUsuarios } from './repository.js';

export { crearAutenticadorDeUsuario } from './autenticador.js';

export interface ServicioDeUsuarios {
  /** ¿El usuario de la cuenta del contexto existe y está activo? (RF-06: uno desactivado no abre puertas) */
  estaActivo(usuarioId: string): Promise<boolean>;
  /** `usuarioId -> etiqueta` de los usuarios de la cuenta (para decir quién emitió un QR). */
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
