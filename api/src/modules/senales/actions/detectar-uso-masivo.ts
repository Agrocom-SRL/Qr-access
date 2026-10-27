import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import {
  crearServicioDeActividadParaSenales,
  diaLocal,
  inicioDelDiaLocal,
  ZONA_DE_LOS_TOPES,
} from '../../accesos/contracts.js';
import { crearServicioDeUmbralesDeSenal } from '../../limites/contracts.js';
import { crearServicioDeArbol } from '../../seguridad/contracts.js';
import { claveDeSenal, gravedadDeUsoMasivo, restarDias } from '../domain/reglas.js';
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
 * Uso masivo (ADR 0030 §4, ola W12): un usuario con más de N aperturas con SU QR propio en el día local, con N distinto
 * por nivel (el Guardia, el más bajo), abre un incidente `uso_masivo` del sistema y avisa a quien administra su rama y a
 * AGROCOM. Es el sello del portero que abre con su QR a todos. Solo observa: la apertura ya ocurrió y nada se limita.
 *
 * Una lectura de todas las cuentas busca a quien llega al N más bajo posible (incluida la excepción más baja); cada
 * hallazgo se juzga luego, dentro de su cuenta, con el N efectivo de su nivel (excepción de usuario > de cuenta >
 * general). Un usuario sin nivel en el árbol (un rol propio) no se juzga: no hay N que aplicarle. Revisa hoy y ayer. Idempotente por
 * usuario y día local; cuenta TODAS las aperturas, repeticiones incluidas (ADR 0032 §4.3).
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
  maximoDeSenales: number = MAXIMO_DE_SENALES_POR_PASADA,
): Promise<ResultadoDePasada> {
  const actividad = crearServicioDeActividadParaSenales(pool);
  const umbrales = crearServicioDeUmbralesDeSenal(pool);
  const piso = Math.min(...Object.values((await umbrales.minimosEnLaPlataforma()).usoMasivo));
  // Hoy (hasta ahora) y AYER completo, como el flujo atípico: lo que cruzó el N en los últimos minutos antes de
  // medianoche se vería a las 00:0x con el conteo ya en cero y se perdería.
  const hoy = diaLocal(ahora, ZONA_DE_LOS_TOPES);
  const inicioDeHoy = inicioDelDiaLocal(ahora, ZONA_DE_LOS_TOPES);
  const finDeAyer = new Date(inicioDeHoy.getTime() - 1);
  const rangos = [
    {
      dia: restarDias(hoy, 1),
      desde: inicioDelDiaLocal(finDeAyer, ZONA_DE_LOS_TOPES),
      hasta: finDeAyer,
    },
    { dia: hoy, desde: inicioDeHoy, hasta: ahora },
  ];
  const resultado = pasadaVacia();

  for (const rango of rangos) {
    const { dia, desde, hasta } = rango;
    const hallazgos = recorrer(
      (cursor: CursorDeUsuario | null) =>
        actividad.aperturasPropias(desde, hasta, piso + 1, tamanoDePagina, cursor),
      (h): CursorDeUsuario => ({ cuentaId: h.cuentaId, usuarioId: h.usuarioId }),
      tamanoDePagina,
    );
    for await (const hallazgo of hallazgos) {
      if (pasadaAgotada(resultado, maximoDeSenales)) break;
      await tratar(resultado, registrarError, () =>
        // Dentro de SU cuenta y como sistema: el incidente y su repositorio de cuenta nunca cruzan cuentas.
        ContextoCuenta.ejecutarEn(hallazgo.cuentaId, async () => {
          const claveUnica = claveDeSenal('uso_masivo', hallazgo.usuarioId, dia);
          if (await new RepositorioDeAvisosDeSenal(pool).existe(claveUnica)) return 'omitida';
          const nivel = await crearServicioDeArbol(pool).nivelDe(hallazgo.usuarioId);
          if (nivel === null) return 'omitida';
          const umbral = (await umbrales.de(hallazgo.usuarioId)).usoMasivo[nivel];
          // «Más de N»: con exactamente N aperturas todavía es uso normal.
          if (hallazgo.total <= umbral) return 'omitida';
          return tratarSenalDeUsuario(pool, hallazgo.cuentaId, {
            usuarioId: hallazgo.usuarioId,
            tipo: 'uso_masivo',
            gravedad: gravedadDeUsoMasivo(hallazgo.total, umbral),
            evidencia: { evento_acceso_ids: [...hallazgo.eventoIds] },
            claveUnica,
            dia,
            valor: hallazgo.total,
            umbral,
            descripcion: `aperturas=${String(hallazgo.total)};umbral=${String(umbral)}`,
            ahora,
          });
        }),
      );
    }
  }
  return resultado;
}
