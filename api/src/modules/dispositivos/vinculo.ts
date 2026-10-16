import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import { crearServicioDeOrganizacion } from '../organizacion/contracts.js';
import { crearServicioDeCuentas } from '../seguridad/contracts.js';
import { crearServicioDeSuscripciones } from '../suscripciones/contracts.js';
import { RepositorioDeDispositivos } from './repository.js';

/** Cuánto espera la placa el pulsador desde que el super admin pide vincularla (ADR 0026 §3). */
export const VENTANA_DE_CONFIRMACION_MS = 10 * 60_000;

/**
 * Comprueba que se puede vincular una placa a esa puerta y, solo entonces, corre `trabajo` en el
 * contexto de la cuenta (ADR 0004 §7), a nombre de `usuarioId`: la cuenta existe y está activa, la
 * puerta es suya y no tiene otro lector, y el plan tiene cupo. Se usa dos veces: al solicitar el
 * vínculo y al confirmarlo con el pulsador, porque entre ambos momentos el plan o la puerta
 * pueden haber cambiado.
 */
export async function conVinculoValido<T>(
  pool: Pool,
  datos: { cuentaId: string; puertaId: string; usuarioId: string },
  ahora: Date,
  trabajo: (vinculo: { puertaId: string; dispositivos: RepositorioDeDispositivos }) => Promise<T>,
): Promise<T> {
  if (!(await crearServicioDeCuentas(pool).estaActiva(datos.cuentaId))) {
    throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  }
  return ContextoCuenta.comoPlataformaEn(datos.cuentaId, datos.usuarioId, async () => {
    const [puerta] = await crearServicioDeOrganizacion(pool).buscarPuertas([datos.puertaId]);
    if (puerta === undefined) throw new ErrorDeDominio('puerta.no_encontrada', 404);

    const suscripcion = await crearServicioDeSuscripciones(pool).obtenerVigente(ahora);
    if (suscripcion === null) throw new ErrorDeDominio('suscripcion.vencida', 403);

    const dispositivos = new RepositorioDeDispositivos(pool);
    if (
      suscripcion.maxDispositivos !== null &&
      (await dispositivos.contarEnServicioDeLaCuenta()) >= suscripcion.maxDispositivos
    ) {
      throw new ErrorDeDominio('plan.limite_dispositivos', 422, {
        maximo: suscripcion.maxDispositivos,
      });
    }
    if ((await dispositivos.listarEnServicioPorPuertas([puerta.id])).length > 0) {
      throw new ErrorDeDominio('puerta.con_dispositivo', 409);
    }
    return trabajo({ puertaId: puerta.id, dispositivos });
  });
}

/** `uq_dispositivos_puerta` / `uq_dispositivos_placa`: otra vinculación llegó primero. */
export function esDuplicado(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}
