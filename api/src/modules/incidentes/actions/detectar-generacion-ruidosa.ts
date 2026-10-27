import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { sumarMinutos } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeRechazosRepetidos } from '../../limites/contracts.js';
import { claveDeGeneracionRuidosa } from '../domain/incidente.js';
import { ejecutar as registrarDelSistema } from './registrar-incidente-del-sistema.js';

export interface ResultadoDeDeteccion {
  /** Usuarios que cruzaron el umbral de rechazos en la ventana. */
  readonly revisados: number;
  /** Incidentes nuevos abiertos (los que ya existían ese día no cuentan). */
  readonly incidentes: number;
  /** Hallazgos que fallaron (siguen los demás; se reintenta en la próxima pasada). */
  readonly errores: number;
}

/** A lo sumo cuántos usuarios trata cada pasada; el resto espera a la siguiente. */
const MAXIMO_POR_PASADA = 500;

/**
 * Primer detector del sistema sobre el contrato de incidentes (ADR 0033 §4.1, ADR 0030 §4; el resto de las señales es
 * la ola W12): un usuario con `incidente.rechazos_generacion_minimo` o más rechazos por tope de generación en las
 * últimas `incidente.rechazos_generacion_ventana_horas` abre un incidente `generacion_ruidosa` de gravedad baja, con
 * los ids de sus últimos rechazos como evidencia. Solo mira `eventos_de_limite` (un hecho ya registrado y observable);
 * no toca la generación de QR ni la validación.
 *
 * Idempotente: una `claveUnica` por usuario y día (UTC), así que correr el detector cada pocos minutos no llena la
 * lista. El incidente nace SIN resolver: no limita a nadie hasta que una persona lo confirme.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
): Promise<ResultadoDeDeteccion> {
  const rechazos = crearServicioDeRechazosRepetidos(pool);
  const { minimo, ventanaHoras } = await rechazos.umbrales();
  const hallazgos = await rechazos.usuarios(
    sumarMinutos(ahora, -ventanaHoras * 60),
    minimo,
    MAXIMO_POR_PASADA,
  );
  let incidentes = 0;
  let errores = 0;
  for (const hallazgo of hallazgos) {
    try {
      // Dentro de SU cuenta y como sistema: el incidente y su repositorio de cuenta nunca cruzan cuentas.
      const id = await ContextoCuenta.ejecutarEn(hallazgo.cuentaId, () =>
        registrarDelSistema(pool, {
          usuarioId: hallazgo.usuarioId,
          tipo: 'generacion_ruidosa',
          gravedad: 'baja',
          evidencia: { evento_limite_ids: [...hallazgo.eventoIds] },
          claveUnica: claveDeGeneracionRuidosa(hallazgo.usuarioId, ahora),
          ocurridoAt: ahora,
        }),
      );
      if (id !== null) incidentes += 1;
    } catch (error) {
      errores += 1;
      registrarError(error);
    }
  }
  return { revisados: hallazgos.length, incidentes, errores };
}
