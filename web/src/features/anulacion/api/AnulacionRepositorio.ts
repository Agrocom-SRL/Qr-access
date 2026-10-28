import type { ResultadoDeAnulacion } from '../domain/anulacion';

/** Lo que `application` necesita para anular los QR de una cuenta (solo super admin). */
export interface AnulacionRepositorio {
  /** Anula todos los QR vigentes de la cuenta; el motivo queda en la bitácora. */
  anularCuenta: (cuentaId: string, motivo: string) => Promise<ResultadoDeAnulacion>;
}
