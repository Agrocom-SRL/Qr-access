import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { SENTIDO_POR_OMISION, type Sentido } from '../domain/sentido.js';
import { RepositorioDePlacas } from '../placas-repository.js';
import { RepositorioDeDispositivosDePlataforma } from '../repository.js';
import { VENTANA_DE_CONFIRMACION_MS, conVinculoValido } from '../vinculo.js';

export interface DatosDeVinculo {
  readonly cuentaId: string;
  readonly puertaId: string;
  readonly nombre: string;
  /** Dónde está el lector de la placa (ADR 0035 §4); por omisión `ambos`. */
  readonly sentido?: Sentido;
}

/**
 * Pide vincular una placa a una puerta de una cuenta (ADR 0026 §3). Todavía no crea el
 * dispositivo: deja la solicitud en la placa y abre una ventana de 10 minutos para que alguien
 * pulse su botón (`confirmar-placa`). Valida de una vez lo que se pueda (cuenta, puerta, plan)
 * para que el error le llegue al super admin y no al instalador (incluido que la puerta ya tenga placa en ese
 * lado, ADR 0035 §4); se vuelve a validar al confirmar.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  placaId: string,
  datos: DatosDeVinculo,
  ahora: Date = new Date(),
): Promise<{ porConfirmarHasta: Date }> {
  const placas = new RepositorioDePlacas(pool);
  const sentido = datos.sentido ?? SENTIDO_POR_OMISION;
  const hasta = new Date(ahora.getTime() + VENTANA_DE_CONFIRMACION_MS);

  return conVinculoValido(
    pool,
    {
      cuentaId: datos.cuentaId,
      puertaId: datos.puertaId,
      usuarioId: principal.usuarioId,
      sentido,
    },
    ahora,
    ({ puertaId }) =>
      enTransaccion(pool, async (tx) => {
        const placa = await placas.buscarPorId(placaId, tx);
        if (placa === null) throw new ErrorDeDominio('placa.no_encontrada', 404);
        if (
          (await new RepositorioDeDispositivosDePlataforma(pool).buscarEnServicioDePlaca(
            placa.id,
          )) !== null
        ) {
          throw new ErrorDeDominio('placa.ya_vinculada', 409);
        }
        await placas.solicitarVinculo(tx, placa.id, {
          hasta,
          cuentaId: datos.cuentaId,
          puertaId,
          nombre: datos.nombre,
          sentido,
          solicitadoPor: principal.usuarioId,
        });
        return { porConfirmarHasta: hasta };
      }),
  );
}
