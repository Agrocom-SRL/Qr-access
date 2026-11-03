import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { crearServicioDeAperturaManualDeCuenta } from '../../seguridad/contracts.js';
import { RepositorioDePuertas } from '../repository.js';

/** A qué alcanza el interruptor: una puerta o todas las de la cuenta (ADR 0035 §5). */
export type AlcanceDeAperturaManual =
  { readonly tipo: 'puerta'; readonly puertaId: string } | { readonly tipo: 'cuenta' };

/**
 * Enciende o apaga la apertura manual desde la app (ADR 0035 §5). Solo el Administrador de la cuenta la cambia
 * (permiso `accesos.apertura_manual.configurar`, que valida la ruta).
 *
 * - `puerta`: cambia esa puerta; si no es de la cuenta (o no existe) es `puerta.no_encontrada` (404). El interruptor
 *   se puede escribir aunque la puerta no tenga placa: que la pantalla muestre «Sin placa» sin interruptor es cosa
 *   de la pantalla, y la lectura (`listar-apertura-manual`) lo informa con `tiene_placa`.
 * - `cuenta`: cambia TODAS las puertas de la cuenta y el valor inicial de las que se registren después
 *   (`cuentas.apertura_manual_por_omision`) en una sola transacción: o queda todo o no queda nada. Nada la
 *   enciende sola después: si se apagó, sigue apagada.
 *
 * Solo se escriben las filas que cambian de valor, para no llenar la bitácora con registros sin cambio.
 */
export async function ejecutar(
  pool: Pool,
  alcance: AlcanceDeAperturaManual,
  habilitada: boolean,
): Promise<void> {
  const puertas = new RepositorioDePuertas(pool);
  const valor = habilitada ? 1 : 0;

  if (alcance.tipo === 'puerta') {
    const [puerta] = await puertas.buscarPorIds([alcance.puertaId]);
    if (puerta === undefined) throw new ErrorDeDominio('puerta.no_encontrada', 404);
    if (puerta.apertura_manual === valor) return;
    await enTransaccion(pool, (tx) => puertas.fijarAperturaManual(tx, puerta.id, habilitada));
    return;
  }

  const cuenta = crearServicioDeAperturaManualDeCuenta(pool);
  const cambiar = (await puertas.listarTodas()).filter(
    (puerta) => puerta.apertura_manual !== valor,
  );
  await enTransaccion(pool, async (tx) => {
    // Primero la cuenta y luego las puertas: es el orden en que una petición de abrir toma sus bloqueos (la cuenta
    // compartida al leer el estado y después la puerta al insertar la orden), así que las dos no se cruzan.
    await cuenta.fijarPorOmision(tx, habilitada);
    for (const puerta of cambiar) await puertas.fijarAperturaManual(tx, puerta.id, habilitada);
  });
}
