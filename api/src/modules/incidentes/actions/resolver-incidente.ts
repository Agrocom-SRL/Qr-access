import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion, type Transaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import {
  crearServicioDePoliticaDeIncidentes,
  type PoliticaDeIncidentes,
} from '../../limites/contracts.js';
import { crearServicioDeAvisos, type AccionPropuesta } from '../../notificaciones/contracts.js';
import {
  crearServicioDeArbol,
  crearServicioDeCuentas,
  crearServicioDeUsuarios,
} from '../../seguridad/contracts.js';
import { alcanceDeIncidentes, puedeVer } from '../alcance.js';
import {
  agrupacionDePropuesta,
  motivoDeRestriccionAutomatica,
  proponerAccion,
  puedeAplicarseSola,
  type ResultadoDeResolucion,
} from '../domain/incidente.js';
import {
  RepositorioDeIncidentes,
  RepositorioDeResoluciones,
  type IncidenteFila,
} from '../repository.js';
import { detallar, type IncidenteDetallado } from './ver-incidente.js';

export interface DecisionSobreIncidente {
  readonly resultado: ResultadoDeResolucion;
  /** Obligatorio al confirmar; opcional en los otros resultados. */
  readonly motivo: string | null;
}

/** Lo que se evaluó al CONFIRMAR un incidente (ADR 0033 §4.3). `null` en los demás resultados. */
export interface ReincidenciaEvaluada {
  /** Incidentes confirmados del usuario dentro de la ventana, con este incluido. */
  readonly confirmados: number;
  readonly minimo: number;
  readonly ventanaDias: number;
  /** El paso que el sistema propuso; `null` si no corresponde ninguno (un incidente aislado no limita nada). */
  readonly propuesta: AccionPropuesta | null;
  /** El sistema restringió al usuario solo (restricción automática de la cuenta, solo el nivel leve). */
  readonly aplicadaAutomaticamente: boolean;
}

export interface ResultadoDeResolucionDeIncidente {
  readonly incidente: IncidenteDetallado;
  readonly reincidencia: ReincidenciaEvaluada | null;
}

/** Los datos que hacen falta para avisar de una propuesta, leídos antes de abrir la transacción. */
interface ContextoDeAviso {
  readonly cuenta: { id: string; codigo: string; nombre: string };
  readonly etiqueta: string | null;
  readonly superiores: readonly string[];
  readonly nivel: string | null;
}

async function evaluarYProponer(
  pool: Pool,
  tx: Transaccion,
  fila: IncidenteFila,
  politica: PoliticaDeIncidentes,
  aviso: ContextoDeAviso,
  ahora: Date,
): Promise<ReincidenciaEvaluada> {
  const { total: confirmados, deUnaSolaPersona } = await new RepositorioDeIncidentes(
    pool,
  ).resumirConfirmados(fila.usuario_id, sumarDias(ahora, -politica.reincidenciaVentanaDias), tx);
  const arbol = crearServicioDeArbol(pool);
  const estadoPropio = (await arbol.estadoPropioDe(fila.usuario_id, tx)) ?? 'suspendido';
  const accion = proponerAccion({
    tipoConfirmado: fila.tipo,
    confirmadosEnVentana: confirmados,
    minimo: politica.reincidenciaMinimo,
    estadoPropio,
  });
  const evaluada = {
    confirmados,
    minimo: politica.reincidenciaMinimo,
    ventanaDias: politica.reincidenciaVentanaDias,
  };
  if (accion === null) return { ...evaluada, propuesta: null, aplicadaAutomaticamente: false };

  // El nivel leve puede aplicarse solo SI la cuenta lo habilitó; el crítico (suspender) nunca (ADR 0033 §4.4).
  const aplicadaAutomaticamente =
    puedeAplicarseSola(accion, politica.restriccionAutomatica, aviso.nivel, deUnaSolaPersona) &&
    (await arbol.restringirComoSistema(
      tx,
      fila.usuario_id,
      motivoDeRestriccionAutomatica(fila.id),
      ahora,
    )) === 'aplicada';

  const datos = {
    cuenta: aviso.cuenta,
    sitio: null,
    placas: [],
    propuesta: {
      accion,
      usuario_id: fila.usuario_id,
      usuario_etiqueta: aviso.etiqueta,
      incidente_id: fila.id,
      incidente_tipo: fila.tipo,
      confirmados,
      minimo: politica.reincidenciaMinimo,
      ventana_dias: politica.reincidenciaVentanaDias,
      aplicada_automaticamente: aplicadaAutomaticamente,
    },
  };
  const avisos = crearServicioDeAvisos(pool);
  const comun = {
    tipo: 'incidente.propuesta',
    severidad: aplicadaAutomaticamente ? 'info' : accion === 'restringir' ? 'aviso' : 'critica',
    agrupacion: agrupacionDePropuesta(fila.usuario_id, accion),
    sitioId: null,
    miembros: [fila.usuario_id],
    datos,
    alResolver: null,
  } as const;
  // A quien administra la rama (sus superiores que reciben avisos de la cuenta) y a AGROCOM. Si el usuario es un
  // Administrador no hay quien lo administre dentro de la cuenta: solo AGROCOM.
  if (aviso.superiores.length > 0) {
    await avisos.encolar(tx, { ...comun, audiencia: 'cuenta', soloPara: aviso.superiores }, ahora);
  }
  await avisos.encolar(tx, { ...comun, audiencia: 'plataforma' }, ahora);
  return { ...evaluada, propuesta: accion, aplicadaAutomaticamente };
}

/**
 * Quien administra la rama descarta, confirma o deja pendiente un incidente de uso (ADR 0033 §4.2 y §4.3).
 *
 * - **Quién:** con `seguridad.incidente.resolver`, sobre incidentes de su alcance y nunca los propios (403
 *   `incidente.propio`). Uno de otra cuenta o de alguien fuera de su rama no existe (404 `incidente.no_encontrado`).
 * - **Confirmar exige motivo** (422 `incidente.motivo_requerido`). Cada decisión es una fila nueva (el historial
 *   queda); repetir el mismo resultado no hace nada. Una decisión puede cambiarse después (p. ej. un falso positivo
 *   descubierto tarde: de confirmado a descartado), y entonces deja de contar para la reincidencia.
 * - **Reincidencia:** al CONFIRMAR se cuentan los confirmados del usuario en la ventana móvil de la política. Al
 *   cruzar el umbral el sistema PROPONE (aviso en la bandeja de quienes administran su rama y de AGROCOM) y no
 *   aplica nada, salvo que la cuenta haya encendido la restricción automática: entonces restringe (solo el nivel
 *   leve, con origen `sistema`) en la misma transacción. Suspender, y suspender y anular, solo los decide una persona.
 *
 * Todo en UNA transacción, con los incidentes del usuario bloqueados: dos confirmaciones a la vez no se pierden la
 * reincidencia una a la otra.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  incidenteId: string,
  decision: DecisionSobreIncidente,
  ahora: Date = new Date(),
): Promise<ResultadoDeResolucionDeIncidente> {
  const incidentes = new RepositorioDeIncidentes(pool);
  const alcance = await alcanceDeIncidentes(pool, principal);
  const previa = await incidentes.buscarPorId(incidenteId);
  if (previa === null || !puedeVer(alcance, previa.usuario_id)) {
    throw new ErrorDeDominio('incidente.no_encontrado', 404);
  }
  if (previa.usuario_id === principal.usuarioId) throw new ErrorDeDominio('incidente.propio', 403);

  const motivo = decision.motivo?.trim() ?? '';
  if (decision.resultado === 'confirmado' && motivo === '') {
    throw new ErrorDeDominio('incidente.motivo_requerido', 422);
  }

  // Lo que hace falta para decidir y avisar, leído ANTES de abrir la transacción (sin retener una conexión).
  const arbol = crearServicioDeArbol(pool);
  const [politica, alcanceDelUsuario, superiores, etiquetas, cuenta] = await Promise.all([
    crearServicioDePoliticaDeIncidentes(pool).politica(),
    arbol.alcanceDe(previa.usuario_id),
    arbol.superioresDe(previa.usuario_id),
    crearServicioDeUsuarios(pool).etiquetasDe([previa.usuario_id]),
    crearServicioDeCuentas(pool).identificar(ContextoCuenta.cuentaRequerida()),
  ]);
  if (cuenta === null) throw new ErrorDeDominio('incidente.no_encontrado', 404);
  const aviso: ContextoDeAviso = {
    cuenta,
    etiqueta: etiquetas.get(previa.usuario_id) ?? null,
    superiores,
    nivel: alcanceDelUsuario.nivel,
  };

  const reincidencia = await enTransaccion(pool, async (tx) => {
    await incidentes.bloquearDelUsuario(tx, previa.usuario_id);
    const resoluciones = new RepositorioDeResoluciones(pool);
    const ultima = await resoluciones.ultima(incidenteId, tx);
    // El mismo resultado otra vez (un doble clic, un reintento): no hay nada nuevo que anotar ni que proponer.
    if (ultima?.resultado === decision.resultado) return null;
    await resoluciones.registrar(tx, {
      incidenteId,
      resultado: decision.resultado,
      motivo: motivo === '' ? null : motivo,
      resueltoPor: principal.usuarioId,
      resueltaAt: ahora,
    });
    if (decision.resultado !== 'confirmado') return null;
    return evaluarYProponer(pool, tx, previa, politica, aviso, ahora);
  });

  return { incidente: await detallar(pool, incidenteId), reincidencia };
}
