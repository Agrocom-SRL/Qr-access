import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { sumarMinutos } from '../../../platform/tiempo/fechas.js';
import {
  crearServicioDeActividadParaSenales,
  diaLocal,
  ZONA_DE_LOS_TOPES,
} from '../../accesos/contracts.js';
import { crearServicioDeUmbralesDeSenal } from '../../limites/contracts.js';
import { claveDeSenal } from '../domain/reglas.js';
import {
  pasadaVacia,
  recorrer,
  type CursorDeUsuario,
  MAXIMO_DE_SENALES_POR_PASADA,
  pasadaAgotada,
  TAMANO_DE_PAGINA,
  tratar,
  type ResultadoDePasada,
} from '../pasada.js';
import { RepositorioDeAvisosDeSenal } from '../repository.js';
import { tratarSenalDeUsuario } from '../senal-de-usuario.js';

/**
 * Uso imposible (ADR 0030 §4 y §4.1, ola W12): dos usos del QR PROPIO de un mismo usuario en puertas que no alcanzan a
 * recorrerse, dentro de la ventana (`senal.ventana_horas`): sitios distintos con menos de
 * `senal.uso_imposible_entre_sitios_minutos` de diferencia, o puertas distintas del mismo sitio con menos de
 * `senal.uso_imposible_entre_puertas_segundos` (0 = no se juzga). Es la huella de un QR propio compartido con otra
 * persona. Gravedad alta (ADR 0030 §4.1).
 *
 * Solo con datos que ya existen: no hay distancias entre sitios ni entre puertas, así que «no alcanza para ir de una a
 * otra» es un tiempo mínimo configurado, no un recorrido calculado. Las ventanas son globales (una consulta para todas
 * las cuentas). Solo QR propios: los QR de visitas que genera un usuario los usan otras personas a la vez, y eso es
 * normal. Idempotente por usuario y día local; solo observa.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
  maximoDeSenales: number = MAXIMO_DE_SENALES_POR_PASADA,
): Promise<ResultadoDePasada> {
  const actividad = crearServicioDeActividadParaSenales(pool);
  const umbrales = await crearServicioDeUmbralesDeSenal(pool).generales();
  const desde = sumarMinutos(ahora, -umbrales.ventanaHoras * 60);
  const dia = diaLocal(ahora, ZONA_DE_LOS_TOPES);
  const resultado = pasadaVacia();

  const hallazgos = recorrer(
    (cursor: CursorDeUsuario | null) =>
      actividad.usosImposibles(
        desde,
        ahora,
        {
          entreSitiosSegundos: umbrales.usoImposibleEntreSitiosMinutos * 60,
          entrePuertasSegundos: umbrales.usoImposibleEntrePuertasSegundos,
        },
        tamanoDePagina,
        cursor,
      ),
    (h): CursorDeUsuario => ({ cuentaId: h.cuentaId, usuarioId: h.usuarioId }),
    tamanoDePagina,
  );
  for await (const hallazgo of hallazgos) {
    if (pasadaAgotada(resultado, maximoDeSenales)) break;
    await tratar(resultado, registrarError, () =>
      ContextoCuenta.ejecutarEn(hallazgo.cuentaId, async () => {
        const claveUnica = claveDeSenal('uso_imposible', hallazgo.usuarioId, dia);
        if (await new RepositorioDeAvisosDeSenal(pool).existe(claveUnica)) return 'omitida';
        return tratarSenalDeUsuario(pool, hallazgo.cuentaId, {
          usuarioId: hallazgo.usuarioId,
          tipo: 'uso_imposible',
          gravedad: 'alta',
          evidencia: { evento_acceso_ids: hallazgo.eventoIds.slice(0, 50) },
          claveUnica,
          dia,
          valor: hallazgo.total,
          umbral: 1,
          descripcion: `pares=${String(hallazgo.total)};sitios_min=${String(umbrales.usoImposibleEntreSitiosMinutos)};puertas_s=${String(umbrales.usoImposibleEntrePuertasSegundos)}`,
          ahora,
        });
      }),
    );
  }
  return resultado;
}
