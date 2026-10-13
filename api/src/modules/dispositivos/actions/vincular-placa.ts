import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeCuentas } from '../../seguridad/contracts.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import { RepositorioDePlacas } from '../placas-repository.js';
import { RepositorioDeDispositivos, RepositorioDeDispositivosDePlataforma } from '../repository.js';

export interface DatosDeVinculo {
  readonly cuentaId: string;
  readonly puertaId: string;
  readonly nombre: string;
}

/**
 * Asigna una placa a una puerta de una cuenta (ADR 0025 §6): crea el dispositivo con la clave
 * que la placa ya propuso al reclamar. Exige que la placa haya reclamado, que no esté ya
 * vinculada, que la puerta sea de la cuenta y no tenga otro lector y que el plan tenga cupo.
 * Corre en el contexto de la cuenta elegida (ADR 0004 §7), firmado por el super admin.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  placaId: string,
  datos: DatosDeVinculo,
  ahora: Date = new Date(),
): Promise<{ dispositivoId: string }> {
  const placas = new RepositorioDePlacas(pool);
  if (!(await crearServicioDeCuentas(pool).estaActiva(datos.cuentaId))) {
    throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  }

  return ContextoCuenta.comoPlataformaEn(datos.cuentaId, principal.usuarioId, async () => {
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

    try {
      return await enTransaccion(pool, async (tx) => {
        const placa = await placas.buscarPorId(placaId, tx);
        if (placa === null) throw new ErrorDeDominio('placa.no_encontrada', 404);
        if (placa.clave_hash === null) throw new ErrorDeDominio('placa.sin_reclamo', 409);
        if (
          (await new RepositorioDeDispositivosDePlataforma(pool).buscarEnServicioDePlaca(
            placa.id,
          )) !== null
        ) {
          throw new ErrorDeDominio('placa.ya_vinculada', 409);
        }
        const dispositivoId = await dispositivos.crearParaPlaca(tx, {
          placaId: placa.id,
          puertaId: puerta.id,
          nombre: datos.nombre,
          claveHash: placa.clave_hash,
        });
        return { dispositivoId };
      });
    } catch (error) {
      // `uq_dispositivos_puerta` / `uq_dispositivos_placa`: otra vinculación llegó primero.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        throw new ErrorDeDominio('puerta.con_dispositivo', 409);
      }
      throw error;
    }
  });
}
