import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
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
  miembrosPorGrupo,
  type GrupoDeAviso,
  type PlacaParaAgrupar,
  type UmbralesDePlaca,
} from '../domain/estado-de-placa.js';
import { umbralesEnSegundos } from '../domain/umbrales.js';
import {
  RepositorioDeDispositivos,
  RepositorioDeDispositivosDePlataforma,
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
}

function evaluarPlaca(
  fila: DispositivoParaEvaluarFila,
  ultimaLecturaAt: Date | null,
  ahora: Date,
  umbrales: UmbralesDePlaca,
): EstadoNuevo {
  // Fuera de servicio (revocada, desactivada): no se espera que reporte, y su estado se limpia.
  if (fila.en_servicio !== 1) return { conexion: null, lector: null, observacion: false };
  const conexion = evaluarConexion(
    {
      ultimoLatidoAt: fila.ultimo_latido_at,
      enLineaDesde: fila.en_linea_desde,
      previo: fila.estado_conexion,
    },
    ahora,
    umbrales,
  );
  return {
    conexion,
    lector: evaluarLector(
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
  };
}

/** Evalúa las placas de UNA cuenta (el contexto ya está puesto) en una sola transacción. */
async function evaluarCuenta(
  pool: Pool,
  cuenta: { id: string; codigo: string; nombre: string },
  ahora: Date,
  umbrales: UmbralesDePlaca,
): Promise<{ placasActualizadas: number; avisos: number }> {
  const dispositivos = new RepositorioDeDispositivos(pool);
  const avisos = crearServicioDeAvisos(pool);
  return enTransaccion(pool, async (tx) => {
    // Bloqueadas hasta el final: otra pasada simultánea espera, ve el estado nuevo y no repite el aviso.
    const filas = await dispositivos.listarParaEvaluar(tx);
    if (filas.length === 0) return { placasActualizadas: 0, avisos: 0 };
    const [ultimasLecturas, puertas] = await Promise.all([
      crearServicioDeLecturas(pool).ultimaLecturaPorPuertas(
        filas.filter((fila) => fila.en_servicio === 1).map((fila) => fila.puerta_id),
      ),
      dispositivos.puertasConSitio([...new Set(filas.map((fila) => fila.puerta_id))]),
    ]);

    const antes: PlacaParaAgrupar[] = [];
    const despues: PlacaParaAgrupar[] = [];
    let placasActualizadas = 0;
    for (const fila of filas) {
      const nuevo = evaluarPlaca(
        fila,
        ultimasLecturas.get(fila.puerta_id) ?? null,
        ahora,
        umbrales,
      );
      const sitioId = puertas.get(fila.puerta_id)?.sitio_id;
      if (sitioId !== undefined) {
        antes.push({
          id: fila.id,
          sitioId,
          conexion: fila.estado_conexion,
          lector: fila.estado_lector,
        });
        despues.push({ id: fila.id, sitioId, conexion: nuevo.conexion, lector: nuevo.lector });
      }
      const cambio = {
        ...(nuevo.conexion !== fila.estado_conexion ? { estadoConexion: nuevo.conexion } : {}),
        ...(nuevo.lector !== fila.estado_lector ? { estadoLector: nuevo.lector } : {}),
        ...(nuevo.observacion !== (fila.en_observacion === 1)
          ? { enObservacion: nuevo.observacion }
          : {}),
      };
      if (Object.keys(cambio).length > 0) {
        await dispositivos.guardarEstado(tx, fila.id, cambio);
        placasActualizadas += 1;
      }
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
  });
}

/**
 * El detector de estados de placa (ADR 0031 §18). Recorre las cuentas, calcula el estado de cada placa en
 * servicio con el reloj `ahora` y los umbrales de la plataforma, lo guarda y, SOLO si cambió la membresía de un
 * grupo (placas caídas, desaparecidas o con el lector mudo de un sitio), deja UN aviso agrupado por sitio en la
 * cola de notificaciones, en la misma transacción. Volver a correrlo sin cambios no encola nada. Corre cada
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
  for (const cuenta of cuentas) {
    try {
      const resultado = await ContextoCuenta.ejecutarEn(cuenta.id, () =>
        evaluarCuenta(pool, cuenta, ahora, umbrales),
      );
      placasActualizadas += resultado.placasActualizadas;
      avisos += resultado.avisos;
    } catch (error) {
      errores += 1;
      registrarError(error);
    }
  }
  return { cuentas: cuentas.length, placasActualizadas, avisos, errores };
}
