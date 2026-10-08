import { AsyncLocalStorage } from 'node:async_hooks';

export type Origen = 'api' | 'dispositivo' | 'sistema';

/**
 * Quién opera y sobre qué cuenta (ADR 0004). `cuentaId: null` es la plataforma
 * (super admin sin una cuenta elegida). Los ids son string: BIGINT llega así de mysql2.
 */
export interface DatosContexto {
  readonly cuentaId: string | null;
  readonly usuarioId: string | null;
  readonly rolActivoId: string | null;
  readonly dispositivoId: string | null;
  readonly origen: Origen;
}

/** Se lanzó una operación sobre datos de una cuenta sin contexto: falla cerrado. */
export class SinContextoDeCuenta extends Error {
  constructor() {
    super('Operación sobre datos de una cuenta sin ContextoCuenta');
    this.name = 'SinContextoDeCuenta';
  }
}

const almacen = new AsyncLocalStorage<DatosContexto>();

export const ContextoCuenta = {
  /** Corre `fn` con este contexto; lo abre el plugin de autenticación en cada request. */
  ejecutar<T>(datos: DatosContexto, fn: () => T): T {
    return almacen.run(Object.freeze({ ...datos }), fn);
  },

  /** Para procesos del sistema (p. ej. el cierre diario de QR) sobre una cuenta concreta. */
  ejecutarEn<T>(cuentaId: string, fn: () => T): T {
    return ContextoCuenta.ejecutar(
      { cuentaId, usuarioId: null, rolActivoId: null, dispositivoId: null, origen: 'sistema' },
      fn,
    );
  },

  actual(): DatosContexto | undefined {
    return almacen.getStore();
  },

  requerido(): DatosContexto {
    const contexto = almacen.getStore();
    if (contexto === undefined) throw new SinContextoDeCuenta();
    return contexto;
  },

  /** La cuenta del contexto; sin contexto o en contexto de plataforma, falla cerrado. */
  cuentaRequerida(): string {
    const { cuentaId } = ContextoCuenta.requerido();
    if (cuentaId === null) throw new SinContextoDeCuenta();
    return cuentaId;
  },
};
