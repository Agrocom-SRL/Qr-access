import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { sumarMinutos } from '../../../platform/tiempo/fechas.js';
import {
  crearServicioDeActividadParaSenales,
  diaLocal,
  ZONA_DE_LOS_TOPES,
  type QrConRechazosRepetidos,
} from '../../accesos/contracts.js';
import { crearServicioDeUmbralesDeSenal } from '../../limites/contracts.js';
import { claveDeSenal, gravedadDeQrReenviado, mayorGravedad } from '../domain/reglas.js';
import {
  pasadaVacia,
  recorrer,
  type CursorDeUsuario,
  TAMANO_DE_PAGINA,
  tratar,
  type ResultadoDePasada,
} from '../pasada.js';
import { RepositorioDeAvisosDeSenal } from '../repository.js';
import { tratarSenalDeUsuario } from '../senal-de-usuario.js';

/** Cuántos ids de cada clase guarda la evidencia de un incidente (el tope de la tabla). */
const MAX_IDS = 50;

/** El cursor de esta consulta: por (cuenta, generador, QR). */
interface CursorDeQr extends CursorDeUsuario {
  readonly qrId: string;
}

interface QrDelGenerador {
  readonly cuentaId: string;
  readonly usuarioId: string;
  readonly qrs: QrConRechazosRepetidos[];
}

/**
 * QR reenviado (ADR 0030 §4, ADR 0031 §19, ADR 0032 §4.3, ola W12): un QR ya usado que sigue llegando a los lectores
 * como `qr.usado`, sobre todo desde lectores distintos, es la huella de una imagen reenviada o fotografiada. Se cuentan
 * TODAS las filas de rechazo, también las repeticiones de un mismo intento (ADR 0032 §4.3): hacen volumen. Pero el
 * volumen por sí solo no basta, porque un lector que relee el código frente a una persona es normal; lo que distingue el
 * reenvío son los lectores distintos (`gravedadDeQrReenviado`): 3 o más, alta; 2, media; uno solo, solo constancia baja
 * y únicamente si insiste el triple del mínimo. Un incidente por generador y día local, con los QR y los intentos como
 * evidencia (ids, nunca el token).
 *
 * VACÍO DE DATOS: el ADR también menciona IP e instalaciones distintas para un mismo QR; el rechazo de un lector no
 * guarda la IP de quien muestra el QR (el lector es un dispositivo de la puerta), así que solo hay lectores.
 *
 * Una lectura de todas las cuentas busca los QR que llegan al mínimo más bajo posible; cada generador se juzga luego en
 * su cuenta con el mínimo efectivo. Como la página se corta por QR, el generador cuyos QR caen en dos páginas se une
 * antes de juzgarlo. Solo observa.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
): Promise<ResultadoDePasada> {
  const actividad = crearServicioDeActividadParaSenales(pool);
  const umbrales = crearServicioDeUmbralesDeSenal(pool);
  const { ventanaHoras, qrReenviadoRechazosMinimo: piso } = await umbrales.minimosEnLaPlataforma();
  const desde = sumarMinutos(ahora, -ventanaHoras * 60);
  const dia = diaLocal(ahora, ZONA_DE_LOS_TOPES);
  const resultado = pasadaVacia();

  const juzgar = (grupo: QrDelGenerador): Promise<void> =>
    tratar(resultado, registrarError, () =>
      ContextoCuenta.ejecutarEn(grupo.cuentaId, async () => {
        const claveUnica = claveDeSenal('qr_reenviado', grupo.usuarioId, dia);
        if (await new RepositorioDeAvisosDeSenal(pool).existe(claveUnica)) return 'omitida';
        const { qrReenviadoRechazosMinimo: minimo } = await umbrales.de(grupo.usuarioId);
        const juzgados = grupo.qrs.flatMap((qr) => {
          const gravedad = gravedadDeQrReenviado(qr.rechazos, qr.lectores, minimo);
          return gravedad === null ? [] : [{ qr, gravedad }];
        });
        if (juzgados.length === 0) return 'omitida';
        const peor = juzgados.reduce((a, b) => (b.qr.rechazos > a.qr.rechazos ? b : a));
        return tratarSenalDeUsuario(pool, grupo.cuentaId, {
          usuarioId: grupo.usuarioId,
          tipo: 'qr_reenviado',
          gravedad: mayorGravedad(juzgados.map((j) => j.gravedad)),
          evidencia: {
            qr_ids: juzgados.map((j) => j.qr.qrId).slice(0, MAX_IDS),
            evento_acceso_ids: juzgados.flatMap((j) => j.qr.eventoIds).slice(0, MAX_IDS),
          },
          claveUnica,
          dia,
          valor: peor.qr.rechazos,
          umbral: minimo,
          descripcion: `qrs=${String(juzgados.length)};rechazos=${String(peor.qr.rechazos)};lectores=${String(peor.qr.lectores)};minimo=${String(minimo)}`,
          ahora,
        });
      }),
    );

  const hallazgos = recorrer(
    (cursor: CursorDeQr | null) =>
      actividad.qrReenviados(desde, ahora, piso, tamanoDePagina, cursor),
    (h): CursorDeQr => ({
      cuentaId: h.cuentaId,
      usuarioId: h.usuarioId,
      qrId: h.qrId,
    }),
    tamanoDePagina,
  );
  let actual: QrDelGenerador | null = null;
  for await (const qr of hallazgos) {
    if (actual !== null && actual.cuentaId === qr.cuentaId && actual.usuarioId === qr.usuarioId) {
      actual.qrs.push(qr);
      continue;
    }
    if (actual !== null) await juzgar(actual);
    actual = { cuentaId: qr.cuentaId, usuarioId: qr.usuarioId, qrs: [qr] };
  }
  if (actual !== null) await juzgar(actual);
  return resultado;
}
