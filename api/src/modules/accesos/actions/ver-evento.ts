import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import type { CausaDeEjecucion, Ejecucion, OrigenDeConfirmacion } from '../domain/confirmacion.js';
import { RepositorioDeConfirmaciones, RepositorioDeEventos } from '../repository.js';
import { alcanceDe, presentarEventos, type EventoListado } from './listar-eventos.js';

export interface EventoDetallado extends EventoListado {
  /**
   * Lo que se supo de la apertura, de la más vieja a la más nueva: lo que informó la placa y, si no dijo nada a
   * tiempo, la constancia `sin_respuesta` del servidor. Vacío en un rechazo o mientras no hay informe.
   */
  confirmaciones: {
    origen: OrigenDeConfirmacion;
    resultado: Ejecucion;
    causa: CausaDeEjecucion;
    registrada_at: string;
  }[];
}

/**
 * Un intento de acceso con el detalle de su ejecución (ADR 0031 §18). Solo lo que el usuario puede ver en el
 * listado (su alcance); un evento ajeno, de otra cuenta o inexistente es `evento.no_encontrado` (404).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  id: string,
): Promise<EventoDetallado> {
  const filtro = await alcanceDe(pool, principal, {
    resultado: null,
    puertaId: null,
    desde: null,
    hasta: null,
  });
  const fila = await new RepositorioDeEventos(pool).buscarVisible(filtro, id);
  if (fila === null) throw new ErrorDeDominio('evento.no_encontrado', 404);
  const [[evento], confirmaciones] = await Promise.all([
    presentarEventos(pool, [fila]),
    new RepositorioDeConfirmaciones(pool).deEventos([id]),
  ]);
  if (evento === undefined) throw new ErrorDeDominio('evento.no_encontrado', 404);
  return {
    ...evento,
    confirmaciones: confirmaciones.map((confirmacion) => ({
      origen: confirmacion.origen,
      resultado: confirmacion.resultado,
      causa: confirmacion.causa,
      registrada_at: aIso(confirmacion.registrada_at),
    })),
  };
}
