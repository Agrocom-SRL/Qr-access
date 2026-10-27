import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { sumarMinutos } from '../../../platform/tiempo/fechas.js';
import { diaLocal, ZONA_DE_LOS_TOPES } from '../../accesos/contracts.js';
import { crearServicioDeUmbralesDeSenal } from '../../limites/contracts.js';
import { crearServicioDeSesionesParaSenales } from '../../seguridad/contracts.js';
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
 * PIN compartido (ADR 0030 §4.1, ola W12): un usuario con sesiones activas (vivas y movidas dentro de la ventana
 * `senal.ventana_horas`) desde `senal.pin_compartido_ips_minimo` IP distintas o más. Iniciar sesión en varios aparatos
 * NUNCA se bloquea ni se avisa por sí solo (una persona legítima tiene teléfono, tablet y navegador): lo que se vigila
 * es la dispersión de IP. Gravedad media (el ADR la fija para «muchas IP distintas a la vez»).
 *
 * VACÍO DE DATOS: el ADR también pide contar instalaciones distintas (`sesiones.instalacion_id`, ola W8), pero esa
 * columna no existe en este esquema, así que solo se cuentan IP. Cuando W8 se integre, la señal gana la combinación
 * «varias instalaciones y uso masivo» (gravedad alta). Una IP compartida por un sitio entero (todos los guardias en la
 * misma red) cuenta como una sola, por lo que esta señal no ve el PIN compartido dentro de una misma red.
 *
 * La IP nunca sale del detector: solo se cuenta. Idempotente por usuario y día local; solo observa.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
  maximoDeSenales: number = MAXIMO_DE_SENALES_POR_PASADA,
): Promise<ResultadoDePasada> {
  const sesiones = crearServicioDeSesionesParaSenales(pool);
  const umbrales = crearServicioDeUmbralesDeSenal(pool);
  const { ventanaHoras, pinCompartidoIpsMinimo: piso } = await umbrales.minimosEnLaPlataforma();
  const desde = sumarMinutos(ahora, -ventanaHoras * 60);
  const dia = diaLocal(ahora, ZONA_DE_LOS_TOPES);
  const resultado = pasadaVacia();

  const hallazgos = recorrer(
    (cursor: CursorDeUsuario | null) =>
      sesiones.conVariasIps(ahora, desde, piso, tamanoDePagina, cursor),
    (h): CursorDeUsuario => ({ cuentaId: h.cuentaId, usuarioId: h.usuarioId }),
    tamanoDePagina,
  );
  for await (const hallazgo of hallazgos) {
    if (pasadaAgotada(resultado, maximoDeSenales)) break;
    await tratar(resultado, registrarError, () =>
      ContextoCuenta.ejecutarEn(hallazgo.cuentaId, async () => {
        const claveUnica = claveDeSenal('pin_compartido', hallazgo.usuarioId, dia);
        if (await new RepositorioDeAvisosDeSenal(pool).existe(claveUnica)) return 'omitida';
        const { pinCompartidoIpsMinimo: umbral } = await umbrales.de(hallazgo.usuarioId);
        if (hallazgo.ips < umbral) return 'omitida';
        return tratarSenalDeUsuario(pool, hallazgo.cuentaId, {
          usuarioId: hallazgo.usuarioId,
          tipo: 'pin_compartido',
          gravedad: 'media',
          evidencia: {},
          claveUnica,
          dia,
          valor: hallazgo.ips,
          umbral,
          descripcion: `ips=${String(hallazgo.ips)};sesiones=${String(hallazgo.sesiones)};umbral=${String(umbral)}`,
          ahora,
        });
      }),
    );
  }
  return resultado;
}
