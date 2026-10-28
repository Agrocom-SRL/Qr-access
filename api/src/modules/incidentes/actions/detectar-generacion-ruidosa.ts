import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { sumarMinutos } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeRechazosRepetidos } from '../../limites/contracts.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { crearServicioDeUsuarios } from '../../seguridad/contracts.js';
import { claveDeGeneracionRuidosa } from '../domain/incidente.js';
import { RepositorioDeIncidentes } from '../repository.js';
import { ejecutar as registrarDelSistema } from './registrar-incidente-del-sistema.js';

export interface ResultadoDeDeteccion {
  /** Usuarios que cruzaron el umbral de rechazos en la ventana. */
  readonly revisados: number;
  /** Incidentes nuevos abiertos. */
  readonly incidentes: number;
  /** Hallazgos que no hacía falta tratar: ya tenían su incidente del día, o el usuario o su cuenta ya no operan. */
  readonly omitidos: number;
  /** Hallazgos que fallaron (siguen los demás; se reintenta en la próxima pasada). */
  readonly errores: number;
}

/** Cuántos hallazgos lee de una vez; la pasada recorre TODOS, página a página, con un cursor. */
const TAMANO_DE_PAGINA = 500;

/**
 * Primer detector del sistema sobre el contrato de incidentes (ADR 0033 §4.1, ADR 0030 §4; el resto de las señales es
 * la ola W12): un usuario con `incidente.rechazos_generacion_minimo` o más rechazos por tope de generación en las
 * últimas `incidente.rechazos_generacion_ventana_horas` abre un incidente `generacion_ruidosa` de gravedad baja, con
 * los ids de sus últimos rechazos como evidencia. Solo mira `eventos_de_limite` (un hecho ya registrado y observable);
 * no toca la generación de QR ni la validación.
 *
 * Idempotente: una `claveUnica` por usuario y día (UTC), así que correr el detector cada pocos minutos no llena la
 * lista. El incidente nace SIN resolver: no limita a nadie hasta que una persona lo confirme.
 *
 * Recorre los hallazgos con un cursor por (cuenta, usuario), no con un tope fijo: los que ya tienen su incidente del
 * día se saltan con una lectura (sin intentar insertar) y no tapan a los demás. Tampoco se abre nada para un usuario
 * dado de baja o suspendido (él, un superior o su cuenta): no es un error, se omite en cada pasada sin ruido.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
): Promise<ResultadoDeDeteccion> {
  const rechazos = crearServicioDeRechazosRepetidos(pool);
  const { minimo, ventanaHoras } = await rechazos.umbrales();
  const desde = sumarMinutos(ahora, -ventanaHoras * 60);
  let revisados = 0;
  let incidentes = 0;
  let omitidos = 0;
  let errores = 0;
  let cursor: { cuentaId: string; usuarioId: string } | null = null;
  for (;;) {
    const hallazgos = await rechazos.usuarios(desde, minimo, tamanoDePagina, cursor);
    for (const hallazgo of hallazgos) {
      revisados += 1;
      try {
        // Dentro de SU cuenta y como sistema: el incidente y su repositorio de cuenta nunca cruzan cuentas.
        const id = await ContextoCuenta.ejecutarEn(hallazgo.cuentaId, async () => {
          const claveUnica = claveDeGeneracionRuidosa(hallazgo.usuarioId, ahora);
          if (await new RepositorioDeIncidentes(pool).existeClave(claveUnica)) return null;
          // Baja, suspendido (o su cuenta): no hay a quién abrirle el incidente.
          if (!(await crearServicioDeUsuarios(pool).estaActivo(hallazgo.usuarioId))) return null;
          return registrarDelSistema(pool, {
            usuarioId: hallazgo.usuarioId,
            tipo: 'generacion_ruidosa',
            gravedad: 'baja',
            evidencia: { evento_limite_ids: [...hallazgo.eventoIds] },
            claveUnica,
            ocurridoAt: ahora,
          });
        });
        if (id === null) omitidos += 1;
        else incidentes += 1;
      } catch (error) {
        // Una baja entre la lectura y la escritura: no es un fallo del detector.
        if (error instanceof ErrorDeDominio && error.code === 'usuario.no_encontrado') {
          omitidos += 1;
          continue;
        }
        errores += 1;
        registrarError(error);
      }
    }
    const ultimo = hallazgos.at(-1);
    if (ultimo === undefined || hallazgos.length < tamanoDePagina) break;
    cursor = { cuentaId: ultimo.cuentaId, usuarioId: ultimo.usuarioId };
  }
  return { revisados, incidentes, omitidos, errores };
}
