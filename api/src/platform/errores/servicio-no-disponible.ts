/**
 * El servidor está saturado o lo que necesita no responde a tiempo: la petición se rechaza
 * rápido con 503 y `Retry-After` en vez de acumularse (ADR 0030 §3, ADR 0032 §1). El firmware
 * lo trata como "sin respuesta" y no abre (invariante 2).
 */

/** El pool de la base no entregó una conexión: cola llena o espera agotada. */
export class PoolSaturado extends Error {
  constructor(readonly motivo: 'cola_llena' | 'espera_agotada') {
    super(`Pool saturado: ${motivo}`);
    this.name = 'PoolSaturado';
  }
}

/**
 * La petición agotó su tiempo máximo antes de confirmar la transacción: se deshizo en vez de
 * confirmarla (ADR 0032 §2). Si el cliente aún escucha, recibe 503.
 */
export class PresupuestoAgotado extends Error {
  constructor() {
    super('Presupuesto de la petición agotado');
    this.name = 'PresupuestoAgotado';
  }
}

/** Códigos de mysql2/MariaDB que indican un bloqueo entre transacciones. */
const CODIGOS_DE_BLOQUEO = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

function codigoDe(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * `ER_LOCK_DEADLOCK` o `ER_LOCK_WAIT_TIMEOUT`: repetir puede salir bien. Un deadlock deshace toda
 * la transacción; un timeout de bloqueo, por omisión, solo la sentencia (`innodb_rollback_on_timeout`
 * apagado). Da igual: el reintento siempre parte de un ROLLBACK explícito. Solo se reintenta lo
 * idempotente (ADR 0032 §2).
 */
export function esErrorDeBloqueo(error: unknown): boolean {
  const codigo = codigoDe(error);
  return codigo !== undefined && CODIGOS_DE_BLOQUEO.has(codigo);
}

/** `ER_STATEMENT_TIMEOUT` de MariaDB (`max_statement_time`); mysql2 no le pone nombre. */
const ERRNO_CONSULTA_EXCEDIDA = 1969;

function errnoDe(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('errno' in error)) return undefined;
  return typeof error.errno === 'number' ? error.errno : undefined;
}

/**
 * ¿Es un fallo transitorio de capacidad, que se responde 503 con `Retry-After`? Pool saturado,
 * consulta que pasó `max_statement_time`, transacción sin confirmar por falta de tiempo, bloqueo que sobrevivió al reintento o petición que
 * pasó el tiempo máximo de Fastify.
 */
export function esServicioNoDisponible(error: unknown): boolean {
  if (error instanceof PoolSaturado || error instanceof PresupuestoAgotado) return true;
  if (esErrorDeBloqueo(error)) return true;
  return (
    errnoDe(error) === ERRNO_CONSULTA_EXCEDIDA || codigoDe(error) === 'FST_ERR_HANDLER_TIMEOUT'
  );
}
