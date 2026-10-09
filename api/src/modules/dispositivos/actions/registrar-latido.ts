import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import type { PrincipalDispositivo } from '../../../platform/seguridad/principal.js';
import { RepositorioDeDispositivos } from '../repository.js';

export interface DatosDeLatido {
  readonly firmware: string;
  readonly rssi: number;
  readonly puertaAbierta: boolean;
}

/** Anota que el dispositivo sigue vivo y con qué firmware, señal y estado de la puerta (HU-09). */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalDispositivo,
  datos: DatosDeLatido,
  ahora: Date = new Date(),
): Promise<void> {
  await enTransaccion(pool, (tx) =>
    new RepositorioDeDispositivos(pool).registrarLatido(tx, principal.dispositivoId, {
      ...datos,
      en: ahora,
    }),
  );
}
