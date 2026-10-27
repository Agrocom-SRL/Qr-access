import type { Pool } from 'mysql2/promise';
import { crearServicioDeIncidentes, type Evidencia } from '../incidentes/contracts.js';
import type { AvisoAgrupado, DatosDeAviso, SenalDeAviso } from '../notificaciones/contracts.js';
import {
  crearServicioDeArbol,
  crearServicioDeCuentas,
  crearServicioDeUsuarios,
} from '../seguridad/contracts.js';
import { llevarABandeja } from './bandeja.js';
import { seAvisa, type Gravedad, type TipoDeSenal } from './domain/reglas.js';

export interface HallazgoDeUsuario {
  readonly usuarioId: string;
  readonly tipo: TipoDeSenal;
  readonly gravedad: Gravedad;
  readonly evidencia: Partial<Evidencia>;
  readonly claveUnica: string;
  /** Día local (`aaaa-mm-dd`) de la señal. */
  readonly dia: string;
  /** Lo medido y el umbral que se cruzó. */
  readonly valor: number;
  readonly umbral: number;
  /** Código corto con el detalle, para la lista de incidentes (`aperturas=23;umbral=12`). No es una frase. */
  readonly descripcion: string;
  readonly ahora: Date;
}

/** `abierta` = incidente y aviso listos; `omitida` = nada que hacer; `ocupada` = otra pasada tenía el bloqueo. */
export type ResultadoDeSenal = 'abierta' | 'omitida' | 'ocupada';

/**
 * Convierte el hallazgo de un detector en un incidente del sistema (contrato de W11, idempotente por `claveUnica`) y
 * en un aviso al propietario y a AGROCOM (ADR 0030 §5), una sola vez por evento y día. Corre dentro de la cuenta del
 * contexto. La señal NUNCA limita nada: el incidente nace sin resolver y el aviso solo informa.
 *
 * Primero el incidente y luego el aviso, cada uno idempotente por separado: si una pasada cae entre los dos, la
 * siguiente encuentra el incidente (devuelve `null`) y completa el aviso. A quien ya no opera (baja o suspendido, él, un
 * superior o su cuenta) no se le abre nada.
 */
export async function tratarSenalDeUsuario(
  pool: Pool,
  cuentaId: string,
  hallazgo: HallazgoDeUsuario,
): Promise<ResultadoDeSenal> {
  if (!(await crearServicioDeUsuarios(pool).estaActivo(hallazgo.usuarioId))) return 'omitida';

  const incidenteId = await crearServicioDeIncidentes(pool).registrarDelSistema({
    usuarioId: hallazgo.usuarioId,
    tipo: hallazgo.tipo,
    gravedad: hallazgo.gravedad,
    evidencia: hallazgo.evidencia,
    descripcion: hallazgo.descripcion,
    claveUnica: hallazgo.claveUnica,
    ocurridoAt: hallazgo.ahora,
  });

  const [cuenta, etiquetas, superiores] = await Promise.all([
    crearServicioDeCuentas(pool).identificar(cuentaId),
    crearServicioDeUsuarios(pool).etiquetasDe([hallazgo.usuarioId]),
    crearServicioDeArbol(pool).superioresDe(hallazgo.usuarioId),
  ]);
  if (cuenta === null) return 'omitida';

  const senal: SenalDeAviso = {
    tipo: hallazgo.tipo,
    usuario_id: hallazgo.usuarioId,
    usuario_etiqueta: etiquetas.get(hallazgo.usuarioId) ?? null,
    gravedad: hallazgo.gravedad,
    incidente_id: incidenteId,
    dia: hallazgo.dia,
    valor: hallazgo.valor,
    umbral: hallazgo.umbral,
  };
  const datos: DatosDeAviso = { cuenta, sitio: null, placas: [], senal };
  const comun = {
    tipo: 'senal.uso',
    severidad: hallazgo.gravedad === 'alta' ? 'critica' : 'aviso',
    // Un aviso abierto por usuario y señal: los días siguientes lo actualizan en vez de abrir otro (la persistencia
    // es lo que importa, ADR 0030 §5).
    agrupacion: `senal.uso:usuario:${hallazgo.usuarioId}:${hallazgo.tipo}`,
    sitioId: null,
    miembros: [hallazgo.claveUnica],
    datos,
    alResolver: null,
  } as const;
  const avisos: AvisoAgrupado[] = [];
  if (seAvisa(hallazgo.gravedad)) {
    // A quien administra la rama (sus superiores que reciben avisos de la cuenta) y a AGROCOM. Un Administrador no
    // tiene superior dentro de la cuenta: solo AGROCOM (ADR 0033 §4.3, mismo criterio que la propuesta de W11).
    if (superiores.length > 0) avisos.push({ ...comun, audiencia: 'cuenta', soloPara: superiores });
    avisos.push({ ...comun, audiencia: 'plataforma' });
  }

  const entrega = await llevarABandeja(pool, cuentaId, {
    tipo: hallazgo.tipo,
    usuarioId: hallazgo.usuarioId,
    claveUnica: hallazgo.claveUnica,
    avisos,
    ahora: hallazgo.ahora,
  });
  if (entrega === 'ocupada') return 'ocupada';
  return entrega === 'avisada' ? 'abierta' : 'omitida';
}
