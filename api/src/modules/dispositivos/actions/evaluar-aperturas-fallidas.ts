import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { conBloqueoDeTarea } from '../../../platform/db/bloqueo-de-tarea.js';
import { enTransaccionSobre } from '../../../platform/db/transaccion.js';
import {
  crearServicioDeConfirmaciones,
  type AperturaSinInforme,
  type EjecucionDeApertura,
} from '../../accesos/contracts.js';
import { crearServicioDeUmbralesDeApertura } from '../../limites/contracts.js';
import { crearServicioDeAvisos, type PlacaDeAviso } from '../../notificaciones/contracts.js';
import {
  BUSQUEDA_DE_APERTURAS_SIN_INFORME_HORAS,
  claveDeGrupoDeApertura,
  dispositivosQueFallan,
  TOPE_DE_CONSTANCIAS_POR_PASADA,
  TOPE_DE_EJECUCIONES_LEIDAS,
  type EjecucionParaJuzgar,
  type FallaDeDispositivo,
  type UmbralesDeApertura,
} from '../domain/apertura-fallida.js';
import { RepositorioDeDispositivos, RepositorioDeDispositivosDePlataforma } from '../repository.js';

export interface ResultadoDeEvaluacionDeAperturas {
  /** Cuentas revisadas. */
  readonly cuentas: number;
  /** Aperturas que quedaron `sin_confirmacion` por falta de respuesta de la placa. */
  readonly constancias: number;
  /** Dispositivos que entraron o salieron del grupo de «aperturas que fallan». */
  readonly dispositivosActualizados: number;
  /** Avisos agrupados que se dejaron en la cola. */
  readonly avisos: number;
  /** Cuentas que fallaron (siguen las demás; se reintenta en la próxima pasada). */
  readonly errores: number;
  /** Cuentas que otra pasada estaba evaluando: se saltan y se reintentan en la próxima. */
  readonly ocupadas: number;
}

const SIN_CAMBIOS = { constancias: 0, dispositivosActualizados: 0, avisos: 0, ocupada: false };

function aEjecucion(ejecucion: EjecucionDeApertura): EjecucionParaJuzgar {
  return ejecucion;
}

/**
 * La constancia que el servidor dejará (o dejó) de una apertura sin informe, vista como ejecución. Se sella con el
 * instante en que venció el plazo (la orden + el plazo), no con «ahora»: si el detector estuvo caído, la falla cae
 * donde de verdad ocurrió y la ventana de juicio no se corre.
 */
function instanteDeConstancia(apertura: AperturaSinInforme, plazoSegundos: number): Date {
  return new Date(apertura.ocurridoAt.getTime() + plazoSegundos * 1000);
}

function comoConstancia(apertura: AperturaSinInforme, plazoSegundos: number): EjecucionParaJuzgar {
  return {
    eventoId: apertura.eventoId,
    dispositivoId: apertura.dispositivoId,
    resultado: 'sin_confirmacion',
    causa: 'sin_respuesta',
    registradaAt: instanteDeConstancia(apertura, plazoSegundos),
  };
}

/**
 * Quiénes fallan, dado lo registrado y las constancias: solo cuentan los dispositivos en servicio con el sensor
 * habilitado (uno fuera de servicio ya no se espera que abra; uno sin sensor no puede confirmar nada).
 */
function quienesFallan(
  habilitados: ReadonlyMap<string, Date>,
  ejecuciones: readonly EjecucionParaJuzgar[],
  ahora: Date,
  umbrales: UmbralesDeApertura,
): Map<string, FallaDeDispositivo> {
  return dispositivosQueFallan(ejecuciones, ahora, umbrales, new Set(habilitados.keys()));
}

/**
 * Evalúa las aperturas de UNA cuenta (el contexto ya está puesto). Mismo patrón que el detector de placas
 * (ADR 0032 §1), sin bloquear filas de `dispositivos` mientras se calcula:
 * 1. Lee y calcula con el pool, sin retener nada.
 * 2. Solo si algo cambia (hay constancias por dejar o un dispositivo entra o sale del grupo), toma el bloqueo de la
 *    cuenta (`GET_LOCK`, sin esperar) y, en UNA transacción sobre esa misma conexión, deja las constancias, marca a
 *    los dispositivos con compare-and-set y encola los avisos de los grupos que de verdad cambiaron.
 */
async function evaluarCuenta(
  pool: Pool,
  cuenta: { id: string; codigo: string; nombre: string },
  ahora: Date,
  umbrales: UmbralesDeApertura,
  plazoSegundos: number,
): Promise<{
  constancias: number;
  dispositivosActualizados: number;
  avisos: number;
  ocupada: boolean;
}> {
  const dispositivos = new RepositorioDeDispositivos(pool);
  const filas = await dispositivos.listarParaEvaluarAperturas();
  if (filas.length === 0) return SIN_CAMBIOS;

  const confirmaciones = crearServicioDeConfirmaciones(pool);
  // Dispositivo -> desde cuándo se habilitó su sensor. Solo las placas con sensor habilitado deben informar: sin
  // sensor, o con un firmware que aún no informa, el silencio no es una falla; y lo ocurrido ANTES de habilitarlo
  // tampoco se juzga (la placa aún no podía informar).
  const habilitados = new Map<string, Date>();
  for (const fila of filas) {
    if (
      fila.en_servicio === 1 &&
      fila.sensor_instalado === 1 &&
      fila.sensor_habilitado_at !== null
    ) {
      habilitados.set(fila.id, fila.sensor_habilitado_at);
    }
  }
  const limiteDeBusqueda = ahora.getTime() - BUSQUEDA_DE_APERTURAS_SIN_INFORME_HORAS * 3600_000;
  const [pendientes, leidas] = await Promise.all([
    confirmaciones.aperturasSinInforme(
      [...habilitados].map(([dispositivoId, habilitadoAt]) => ({
        dispositivoId,
        desde: new Date(Math.max(habilitadoAt.getTime(), limiteDeBusqueda)),
      })),
      new Date(ahora.getTime() - plazoSegundos * 1000),
      TOPE_DE_CONSTANCIAS_POR_PASADA,
    ),
    confirmaciones.ejecucionesDesde(
      new Date(ahora.getTime() - umbrales.ventanaSegundos * 1000),
      TOPE_DE_EJECUCIONES_LEIDAS,
    ),
  ]);
  // Un informe de una apertura ordenada antes de habilitar el sensor (p. ej. un `sin_sensor` de cuando aún no
  // estaba habilitado) no cuenta.
  const registradas = leidas.filter((ejecucion) => {
    const habilitadoAt = habilitados.get(ejecucion.dispositivoId);
    return habilitadoAt !== undefined && ejecucion.ocurridoAt >= habilitadoAt;
  });

  const previstas = quienesFallan(
    habilitados,
    [...registradas.map(aEjecucion), ...pendientes.map((p) => comoConstancia(p, plazoSegundos))],
    ahora,
    umbrales,
  );
  const cambian = filas.filter((fila) => (fila.apertura_fallida === 1) !== previstas.has(fila.id));
  // Lo normal: nada que dejar y nadie cambia. No se toma ni conexión ni bloqueo.
  if (pendientes.length === 0 && cambian.length === 0) return SIN_CAMBIOS;

  const puertas = await dispositivos.puertasConSitio([
    ...new Set(filas.map((fila) => fila.puerta_id)),
  ]);
  const avisos = crearServicioDeAvisos(pool);

  const resultado = await conBloqueoDeTarea(pool, `aperturas:${cuenta.id}`, (conexion) =>
    enTransaccionSobre(conexion, async (tx) => {
      // Las constancias que de verdad se dejaron: si la placa informó entre la lectura y ahora, no se pisa.
      const dejadas: AperturaSinInforme[] = [];
      for (const apertura of pendientes) {
        if (
          await confirmaciones.dejarSinRespuesta(
            tx,
            apertura,
            instanteDeConstancia(apertura, plazoSegundos),
          )
        ) {
          dejadas.push(apertura);
        }
      }
      const falla = quienesFallan(
        habilitados,
        [...registradas.map(aEjecucion), ...dejadas.map((d) => comoConstancia(d, plazoSegundos))],
        ahora,
        umbrales,
      );

      // Compare-and-set: si otra pasada cambió al dispositivo, se queda como estaba (la próxima lo revisa).
      const antes = new Map<string, boolean>();
      const despues = new Map<string, boolean>();
      let dispositivosActualizados = 0;
      for (const fila of filas) {
        const estabaEnGrupo = fila.apertura_fallida === 1;
        const estaraEnGrupo = falla.has(fila.id);
        const escrito =
          estabaEnGrupo !== estaraEnGrupo &&
          (await dispositivos.guardarAperturaFallida(tx, fila.id, estaraEnGrupo, estabaEnGrupo));
        if (escrito) dispositivosActualizados += 1;
        antes.set(fila.id, estabaEnGrupo);
        despues.set(fila.id, escrito ? estaraEnGrupo : estabaEnGrupo);
      }

      // Un grupo por sitio: se avisa solo si cambió quiénes lo forman.
      const sitios = new Set(
        filas.flatMap((fila) => {
          const sitioId = puertas.get(fila.puerta_id)?.sitio_id;
          return sitioId === undefined ? [] : [sitioId];
        }),
      );
      let encolados = 0;
      for (const sitioId of [...sitios].sort()) {
        const delSitio = filas.filter((fila) => puertas.get(fila.puerta_id)?.sitio_id === sitioId);
        const ids = (mapa: Map<string, boolean>) =>
          delSitio
            .filter((fila) => mapa.get(fila.id) === true)
            .map((fila) => fila.id)
            .sort((a, b) => Number(a) - Number(b));
        const miembrosAntes = ids(antes);
        const miembros = ids(despues);
        if (miembrosAntes.join(',') === miembros.join(',')) continue;

        const sitio = puertas.get(delSitio[0]?.puerta_id ?? '');
        const placas: PlacaDeAviso[] = miembros.flatMap((id) => {
          const fila = filas.find((candidata) => candidata.id === id);
          const detalle = falla.get(id);
          if (fila === undefined) return [];
          return [
            {
              dispositivo_id: id,
              puerta_id: fila.puerta_id,
              puerta_nombre: puertas.get(fila.puerta_id)?.puerta_nombre ?? '',
              desde: detalle?.desde.toISOString() ?? null,
              ...(detalle === undefined
                ? {}
                : { fallos: detalle.fallos, causa: detalle.ultimaCausa }),
            },
          ];
        });
        // Propietario de la cuenta y AGROCOM (la puerta no está abriendo): `aviso`, como la caída sostenida.
        for (const audiencia of ['cuenta', 'plataforma'] as const) {
          await avisos.encolar(
            tx,
            {
              tipo: 'apertura.fallida',
              severidad: 'aviso',
              audiencia,
              agrupacion: claveDeGrupoDeApertura(sitioId),
              sitioId,
              miembros,
              datos: {
                cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
                sitio:
                  sitio === undefined ? null : { id: sitio.sitio_id, nombre: sitio.sitio_nombre },
                placas,
              },
              alResolver: null,
            },
            ahora,
          );
          encolados += 1;
        }
      }
      return { constancias: dejadas.length, dispositivosActualizados, avisos: encolados };
    }),
  );
  return resultado.obtenido
    ? { ...resultado.valor, ocupada: false }
    : { ...SIN_CAMBIOS, ocupada: true };
}

/**
 * El detector de aperturas fallidas (ADR 0031 §18, ola W10). Recorre las cuentas con el reloj `ahora` y los umbrales
 * de la plataforma:
 * - Una apertura ordenada de una puerta CON sensor habilitado a la que la placa no contestó en el plazo queda con
 *   la constancia `sin_confirmacion` / `sin_respuesta` (una fila del servidor sellada con la orden + el plazo; si la
 *   placa contesta tarde, su fila manda). Solo se juzgan aperturas posteriores a `sensor_habilitado_at`.
 * - Una puerta con `fallidasMinimo` o más fallas en la ventana (desde su última apertura ejecutada) entra al grupo
 *   «aperturas que fallan» de su sitio; sale cuando vuelve a abrir bien o las fallas salen de la ventana.
 * - Solo si cambia quiénes forman el grupo de un sitio se deja UN aviso `apertura.fallida` (propietario y AGROCOM)
 *   en la cola, en la misma transacción; al quedar vacío, se cierra. Volver a correrlo sin cambios no encola nada.
 * - Las aperturas MANUALES (ADR 0035) cuentan igual: lo que informó la placa sobre una orden y la constancia que deja
 *   `vencer-ordenes` (acciones de `accesos`) llegan por `ejecucionesDesde`, que no distingue el método, con el mismo
 *   umbral y el mismo sensor habilitado; el grupo es por placa, así que una falla por QR y otra manual suman y no
 *   duplican el aviso. Este detector NO deja constancias de órdenes manuales (`aperturasSinInforme` solo mira QR).
 * Nunca abre ni cierra una puerta. Corre cada minuto (`tareas.ts`).
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
): Promise<ResultadoDeEvaluacionDeAperturas> {
  const configurados = await crearServicioDeUmbralesDeApertura(pool).umbrales();
  const umbrales: UmbralesDeApertura = {
    fallidasMinimo: configurados.fallidasMinimo,
    ventanaSegundos: configurados.fallidasVentanaMinutos * 60,
  };
  const cuentas = await new RepositorioDeDispositivosDePlataforma(
    pool,
  ).cuentasConDispositivosParaEvaluar();
  let constancias = 0;
  let dispositivosActualizados = 0;
  let avisos = 0;
  let errores = 0;
  let ocupadas = 0;
  for (const cuenta of cuentas) {
    try {
      const resultado = await ContextoCuenta.ejecutarEn(cuenta.id, () =>
        evaluarCuenta(pool, cuenta, ahora, umbrales, configurados.plazoConfirmacionSegundos),
      );
      constancias += resultado.constancias;
      dispositivosActualizados += resultado.dispositivosActualizados;
      avisos += resultado.avisos;
      if (resultado.ocupada) ocupadas += 1;
    } catch (error) {
      errores += 1;
      registrarError(error);
    }
  }
  return {
    cuentas: cuentas.length,
    constancias,
    dispositivosActualizados,
    avisos,
    errores,
    ocupadas,
  };
}
