import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { conBloqueoDeTarea } from '../../../platform/db/bloqueo-de-tarea.js';
import { enTransaccionSobre } from '../../../platform/db/transaccion.js';
import { crearServicioDeLecturas } from '../../accesos/contracts.js';
import { crearServicioDeUmbralesDePlaca } from '../../limites/contracts.js';
import {
  crearServicioDeAvisos,
  type Audiencia,
  type AvisoAgrupado,
  type PlacaDeAviso,
} from '../../notificaciones/contracts.js';
import {
  descomponerClave,
  estaEnObservacion,
  evaluarConexion,
  evaluarLector,
  gruposQueCambiaron,
  lectorObsoleto,
  miembrosPorGrupo,
  type GrupoDeAviso,
  type PlacaParaAgrupar,
  type UmbralesDePlaca,
} from '../domain/estado-de-placa.js';
import { umbralesEnSegundos } from '../domain/umbrales.js';
import {
  RepositorioDeDispositivos,
  RepositorioDeDispositivosDePlataforma,
  type CambioDeEstadoDePlaca,
  type DispositivoParaEvaluarFila,
} from '../repository.js';

export interface ResultadoDeEvaluacion {
  /** Cuentas revisadas. */
  readonly cuentas: number;
  /** Placas cuyo estado guardado cambió. */
  readonly placasActualizadas: number;
  /** Avisos agrupados que se dejaron en la cola. */
  readonly avisos: number;
  /** Cuentas que fallaron (siguen las demás; se reintenta en la próxima pasada). */
  readonly errores: number;
  /** Cuentas que otra pasada estaba evaluando: se saltan y se reintentan en la próxima. */
  readonly ocupadas: number;
}

/** A quién va cada aviso y con qué gravedad (ADR 0031 §18). */
const REGLAS_DE_AVISO: Readonly<
  Record<
    GrupoDeAviso,
    {
      readonly audiencias: readonly Audiencia[];
      readonly severidad: AvisoAgrupado['severidad'];
      readonly alResolver: AvisoAgrupado['alResolver'];
    }
  >
> = {
  // La puerta no lee QR (solo pulsador y llave): lo ve el propietario y AGROCOM.
  'placa.caida_sostenida': {
    audiencias: ['cuenta', 'plataforma'],
    severidad: 'aviso',
    alResolver: null,
  },
  // «Revisar físicamente la placa»: segundo aviso, solo a AGROCOM, y otro al recuperarse.
  'placa.desaparecida': {
    audiencias: ['plataforma'],
    severidad: 'critica',
    alResolver: { tipo: 'placa.recuperada', severidad: 'info' },
  },
  'placa.lector_sin_respuesta': {
    audiencias: ['plataforma'],
    severidad: 'aviso',
    alResolver: null,
  },
};

interface EstadoNuevo {
  readonly conexion: ReturnType<typeof evaluarConexion>;
  readonly lector: ReturnType<typeof evaluarLector>;
  readonly observacion: boolean;
  /** Lo guardado del lector quedó obsoleto: se limpia. */
  readonly olvidarLector: boolean;
}

function evaluarPlaca(
  fila: DispositivoParaEvaluarFila,
  ultimaLecturaAt: Date | null,
  ahora: Date,
  umbrales: UmbralesDePlaca,
): EstadoNuevo {
  // Fuera de servicio (revocada, desactivada): no se espera que reporte, y su estado se limpia.
  if (fila.en_servicio !== 1) {
    return { conexion: null, lector: null, observacion: false, olvidarLector: false };
  }
  const conexion = evaluarConexion(
    {
      ultimoLatidoAt: fila.ultimo_latido_at,
      enLineaDesde: fila.en_linea_desde,
      previo: fila.estado_conexion,
    },
    ahora,
    umbrales,
  );
  const olvidarLector = lectorObsoleto({
    lectorResponde: fila.lector_responde === null ? null : fila.lector_responde === 1,
    lectorInformadoAt: fila.lector_informado_at,
    ultimoLatidoAt: fila.ultimo_latido_at,
  });
  return {
    conexion,
    lector: olvidarLector
      ? null
      : evaluarLector(
          {
            lectorResponde: fila.lector_responde === null ? null : fila.lector_responde === 1,
            lectorCambioAt: fila.lector_cambio_at,
            previo: fila.estado_lector,
          },
          ahora,
          umbrales,
        ),
    observacion: estaEnObservacion(
      { conexion, ultimaLecturaAt, vinculadaAt: fila.created_at },
      ahora,
      umbrales,
    ),
    olvidarLector,
  };
}

/** Lo que cambia en la fila respecto de lo guardado; vacío = nada que escribir. */
function cambioDe(fila: DispositivoParaEvaluarFila, nuevo: EstadoNuevo): CambioDeEstadoDePlaca {
  return {
    ...(nuevo.conexion !== fila.estado_conexion ? { estadoConexion: nuevo.conexion } : {}),
    ...(nuevo.lector !== fila.estado_lector ? { estadoLector: nuevo.lector } : {}),
    ...(nuevo.observacion !== (fila.en_observacion === 1)
      ? { enObservacion: nuevo.observacion }
      : {}),
    ...(nuevo.olvidarLector ? { olvidarLector: true } : {}),
  };
}

interface PlacaEvaluada {
  readonly fila: DispositivoParaEvaluarFila;
  readonly nuevo: EstadoNuevo;
  readonly cambio: CambioDeEstadoDePlaca;
}

/**
 * Evalúa las placas de UNA cuenta (el contexto ya está puesto). Sin bloquear filas de `dispositivos` (padre de
 * las FK de las validaciones y los latidos, ADR 0032 §1):
 * 1. Lee y calcula con el pool, sin retener nada (las lecturas anidadas terminan ANTES de pedir el bloqueo).
 * 2. Solo si algo cambia, toma el bloqueo de aplicación de la cuenta (`GET_LOCK`, sin esperar: si otra pasada lo
 *    tiene, esta se salta) y, en UNA transacción sobre esa misma conexión, escribe cada placa con
 *    compare-and-set y encola los avisos de las que de verdad cambiaron. Una pasada con la foto vieja pierde el
 *    compare-and-set y no repite el aviso.
 * La transacción no espera ninguna otra conexión del pool; tras 2 s sin lograr un bloqueo de fila cede.
 */
async function evaluarCuenta(
  pool: Pool,
  cuenta: { id: string; codigo: string; nombre: string },
  ahora: Date,
  umbrales: UmbralesDePlaca,
): Promise<{ placasActualizadas: number; avisos: number; ocupada: boolean }> {
  const dispositivos = new RepositorioDeDispositivos(pool);
  const filas = await dispositivos.listarParaEvaluar();
  if (filas.length === 0) return { placasActualizadas: 0, avisos: 0, ocupada: false };
  const ultimasLecturas = await crearServicioDeLecturas(pool).ultimaLecturaPorPuertas(
    filas.filter((fila) => fila.en_servicio === 1).map((fila) => fila.puerta_id),
  );
  const puertas = await dispositivos.puertasConSitio([
    ...new Set(filas.map((fila) => fila.puerta_id)),
  ]);
  const evaluadas: PlacaEvaluada[] = filas.map((fila) => {
    const nuevo = evaluarPlaca(fila, ultimasLecturas.get(fila.puerta_id) ?? null, ahora, umbrales);
    return { fila, nuevo, cambio: cambioDe(fila, nuevo) };
  });
  // Lo normal: nada cambió. No se toma ni conexión ni bloqueo.
  if (evaluadas.every((placa) => Object.keys(placa.cambio).length === 0)) {
    return { placasActualizadas: 0, avisos: 0, ocupada: false };
  }

  const avisos = crearServicioDeAvisos(pool);
  const resultado = await conBloqueoDeTarea(pool, `estado_placas:${cuenta.id}`, (conexion) =>
    enTransaccionSobre(conexion, async (tx) => {
      const antes: PlacaParaAgrupar[] = [];
      const despues: PlacaParaAgrupar[] = [];
      let placasActualizadas = 0;
      for (const { fila, nuevo, cambio } of evaluadas) {
        // Compare-and-set: si otra pasada cambió la placa, se queda como estaba (la próxima la revisa).
        const escrita =
          Object.keys(cambio).length > 0 &&
          (await dispositivos.guardarEstado(tx, fila.id, cambio, {
            estadoConexion: fila.estado_conexion,
            estadoLector: fila.estado_lector,
            enObservacion: fila.en_observacion === 1,
            lectorInformadoAt: fila.lector_informado_at,
          }));
        if (escrita) placasActualizadas += 1;
        const sitioId = puertas.get(fila.puerta_id)?.sitio_id;
        if (sitioId === undefined) continue;
        antes.push({
          id: fila.id,
          sitioId,
          conexion: fila.estado_conexion,
          lector: fila.estado_lector,
        });
        despues.push({
          id: fila.id,
          sitioId,
          conexion: escrita ? nuevo.conexion : fila.estado_conexion,
          lector: escrita ? nuevo.lector : fila.estado_lector,
        });
      }

      const miembrosAntes = miembrosPorGrupo(antes);
      const miembrosDespues = miembrosPorGrupo(despues);
      const porId = new Map(filas.map((fila) => [fila.id, fila]));
      let encolados = 0;
      for (const clave of gruposQueCambiaron(miembrosAntes, miembrosDespues)) {
        const grupo = descomponerClave(clave);
        if (grupo === null) continue;
        const ids = miembrosDespues.get(clave) ?? [];
        const sitio = [...puertas.values()].find((p) => p.sitio_id === grupo.sitioId);
        if (sitio === undefined) continue;
        const placas: PlacaDeAviso[] = ids.flatMap((id) => {
          const fila = porId.get(id);
          if (fila === undefined) return [];
          const desde =
            grupo.grupo === 'placa.lector_sin_respuesta'
              ? fila.lector_cambio_at
              : fila.ultimo_latido_at;
          return [
            {
              dispositivo_id: id,
              puerta_id: fila.puerta_id,
              puerta_nombre: puertas.get(fila.puerta_id)?.puerta_nombre ?? '',
              desde: desde === null ? null : desde.toISOString(),
            },
          ];
        });
        const regla = REGLAS_DE_AVISO[grupo.grupo];
        for (const audiencia of regla.audiencias) {
          await avisos.encolar(
            tx,
            {
              tipo: grupo.grupo,
              severidad: regla.severidad,
              audiencia,
              agrupacion: clave,
              sitioId: grupo.sitioId,
              miembros: ids,
              datos: {
                cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
                sitio: { id: sitio.sitio_id, nombre: sitio.sitio_nombre },
                placas,
              },
              alResolver: regla.alResolver,
            },
            ahora,
          );
          encolados += 1;
        }
      }
      return { placasActualizadas, avisos: encolados };
    }),
  );
  return resultado.obtenido
    ? { ...resultado.valor, ocupada: false }
    : { placasActualizadas: 0, avisos: 0, ocupada: true };
}

/**
 * El detector de estados de placa (ADR 0031 §18). Recorre las cuentas, calcula el estado de cada placa en
 * servicio con el reloj `ahora` y los umbrales de la plataforma, lo guarda y, SOLO si cambió la membresía de un
 * grupo (placas caídas, desaparecidas o con el lector mudo de un sitio), deja UN aviso agrupado por sitio en la
 * cola de notificaciones, en la misma transacción (sin bloquear filas de `dispositivos`, ver `evaluarCuenta`). Volver a correrlo sin cambios no encola nada. Corre cada
 * minuto (`tareas.ts`); nunca abre ni cierra una puerta.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
): Promise<ResultadoDeEvaluacion> {
  const umbrales = umbralesEnSegundos(await crearServicioDeUmbralesDePlaca(pool).umbrales());
  const cuentas = await new RepositorioDeDispositivosDePlataforma(
    pool,
  ).cuentasConDispositivosParaEvaluar();
  let placasActualizadas = 0;
  let avisos = 0;
  let errores = 0;
  let ocupadas = 0;
  for (const cuenta of cuentas) {
    try {
      const resultado = await ContextoCuenta.ejecutarEn(cuenta.id, () =>
        evaluarCuenta(pool, cuenta, ahora, umbrales),
      );
      placasActualizadas += resultado.placasActualizadas;
      avisos += resultado.avisos;
      if (resultado.ocupada) ocupadas += 1;
    } catch (error) {
      errores += 1;
      registrarError(error);
    }
  }
  return { cuentas: cuentas.length, placasActualizadas, avisos, errores, ocupadas };
}
