/**
 * Reglas puras de las señales de abuso (ADR 0030 §4 y §5, ADR 0031 §19, ola W12): cuándo una medida cruza su umbral,
 * con qué gravedad y qué clave evita avisar dos veces. Ninguna toca la base ni limita nada: las señales solo observan
 * y avisan, y quien decide es una persona.
 */

export type TipoDeSenal = 'uso_masivo' | 'uso_imposible' | 'qr_reenviado' | 'pin_compartido';

export type Gravedad = 'baja' | 'media' | 'alta';

/** Desfase de la zona de los topes (La Paz, sin horario de verano); va como parámetro del SQL, nunca interpolado. */
export const DESFASE_UTC = '-04:00';

/** Cuántos días anteriores forman la «base» habitual de una cuenta (mediana de los que tuvieron actividad). */
export const DIAS_DE_BASE = 14;

/** Cuántos días hacia atrás mira, como máximo, la vista del flujo y el consumo (acota la consulta). */
export const MAX_DIAS_DE_FLUJO = 90;

/**
 * Hasta cuándo, hacia atrás, se llevan a la bandeja las marcas de la bolsa que quedaron sin avisar (p. ej. por una
 * caída del detector). Una marca más vieja ya no se avisa: el aviso del 80 % de un mes que terminó no sirve.
 */
export const RETROCESO_DE_MARCAS_DE_BOLSA_DIAS = 3;

/** Uso masivo: desde este múltiplo del umbral la señal es de gravedad alta (por debajo, media). */
export const MULTIPLO_DE_USO_MASIVO_ALTO = 3;

/** Una clave del hecho y del día: `uso_masivo:<usuario>:2026-11-10`. Repetir el hecho el mismo día no vuelve a avisar. */
export function claveDeSenal(tipo: TipoDeSenal, usuarioId: string, dia: string): string {
  return `${tipo}:${usuarioId}:${dia}`;
}

/** La clave con que se recuerda que una marca de la bolsa ya se llevó a la bandeja. */
export function claveDeAvisoDeBolsa(claveDeLaMarca: string | null, marcaId: string): string {
  return `bolsa:${claveDeLaMarca ?? `id${marcaId}`}`;
}

/** La clave del aviso de flujo atípico de una cuenta en un día local. */
export function claveDeFlujoAtipico(dia: string): string {
  return `flujo.atipico:${dia}`;
}

export function gravedadDeUsoMasivo(aperturas: number, umbral: number): Gravedad {
  return aperturas >= umbral * MULTIPLO_DE_USO_MASIVO_ALTO ? 'alta' : 'media';
}

/**
 * Un QR reenviado se ve en los lectores: varios lectores distintos intentando un QR ya usado es la huella de una
 * imagen compartida; un solo lector insistiendo es, casi siempre, una persona intentando otra vez. Las repeticiones de
 * un mismo intento (ADR 0032 §4.3) cuentan en `rechazos`, pero no bastan por sí solas: con un único lector hace falta
 * que insistan muchísimo (`MULTIPLO_DE_INSISTENCIA` veces el mínimo) para dejar constancia, y aun así de gravedad baja.
 */
export const MULTIPLO_DE_INSISTENCIA = 3;

/** La gravedad de un QR reenviado, o `null` si no alcanza ni a dejar constancia. */
export function gravedadDeQrReenviado(
  rechazos: number,
  lectores: number,
  minimo: number,
): Gravedad | null {
  if (rechazos < minimo) return null;
  if (lectores >= 3) return 'alta';
  if (lectores === 2) return 'media';
  return rechazos >= minimo * MULTIPLO_DE_INSISTENCIA ? 'baja' : null;
}

/** El mayor orden de gravedad entre varias. */
export function mayorGravedad(gravedades: readonly Gravedad[]): Gravedad {
  if (gravedades.includes('alta')) return 'alta';
  if (gravedades.includes('media')) return 'media';
  return 'baja';
}

/** Solo las señales de gravedad media o alta llegan a la bandeja (ADR 0030 §4.1: la baja «se ve en su ficha, no se avisa»). */
export function seAvisa(gravedad: Gravedad): boolean {
  return gravedad !== 'baja';
}

export interface MedidaDeFlujo {
  readonly aperturas: number;
  /** Usuarios activos de la cuenta (nunca menos de 1 al dividir). */
  readonly usuariosActivos: number;
}

export interface UmbralesDeFlujo {
  readonly aperturasMinimo: number;
  readonly aperturasPorUsuario: number;
}

/** Aperturas por usuario activo, con un decimal. */
export function aperturasPorUsuario(medida: MedidaDeFlujo): number {
  return Math.round((medida.aperturas / Math.max(1, medida.usuariosActivos)) * 10) / 10;
}

/**
 * El flujo de una cuenta es atípico (ADR 0030 §4): suficientes aperturas en el día Y muy por encima de lo habitual
 * por usuario activo. El mínimo evita que una cuenta chica con pocos usuarios dispare por tres aperturas; la tasa por
 * usuario distingue una puerta con tráfico de un plan chico usado como portería de muchos.
 */
export function esFlujoAtipico(medida: MedidaDeFlujo, umbrales: UmbralesDeFlujo): boolean {
  return (
    medida.aperturas >= umbrales.aperturasMinimo &&
    medida.aperturas / Math.max(1, medida.usuariosActivos) >= umbrales.aperturasPorUsuario
  );
}

/** La mediana, o `null` si no hay números. */
export function mediana(numeros: readonly number[]): number | null {
  if (numeros.length === 0) return null;
  const ordenados = [...numeros].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  const valor =
    ordenados.length % 2 === 1
      ? (ordenados[medio] ?? 0)
      : ((ordenados[medio - 1] ?? 0) + (ordenados[medio] ?? 0)) / 2;
  return Math.round(valor * 10) / 10;
}

/** La base habitual: la mediana de las aperturas de los días anteriores que tuvieron alguna; `null` sin historia. */
export function baseHabitual(aperturasDeDiasAnteriores: readonly number[]): number | null {
  return mediana(aperturasDeDiasAnteriores.filter((aperturas) => aperturas > 0));
}

/** Los días locales `aaaa-mm-dd` de `desde` a `hasta`, ambos incluidos (aritmética de calendario, sin zona). */
export function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= fin; t += 86_400_000) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

/** El día calendario `n` días antes (o después, si es negativo) de otro `aaaa-mm-dd`. */
export function restarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

export type EstadoDeBolsa = 'normal' | 'aviso' | 'superada' | 'sin_tope';

/**
 * Dónde está la cuenta respecto de su bolsa mensual: `superada` pasado el 100 % (más QR que la bolsa, como marca
 * la generación), `aviso` desde el porcentaje de aviso, `sin_tope` si no hay bolsa que comparar.
 */
export function estadoDeBolsa(
  usado: number,
  tope: number | null,
  avisoPorcentaje: number,
): EstadoDeBolsa {
  if (tope === null || tope <= 0) return 'sin_tope';
  if (usado > tope) return 'superada';
  return usado * 100 >= tope * avisoPorcentaje ? 'aviso' : 'normal';
}

/** El porcentaje de la bolsa usado, con un decimal; `null` sin bolsa. */
export function porcentajeDeBolsa(usado: number, tope: number | null): number | null {
  if (tope === null || tope <= 0) return null;
  return Math.round((usado / tope) * 1000) / 10;
}

export interface ActividadSimple {
  readonly aperturas: number;
  readonly rechazos: number;
  readonly generados: number;
}

export interface DiaDeFlujo {
  readonly dia: string;
  readonly aperturas: number;
  readonly rechazos: number;
  readonly generados: number;
  /** Aperturas por usuario activo, con un decimal. */
  readonly por_usuario: number;
  /** El día cruzó los dos umbrales del flujo (ver `esFlujoAtipico`). */
  readonly atipico: boolean;
  /** La mediana de aperturas de los `DIAS_DE_BASE` días anteriores con actividad; `null` sin historia. */
  readonly base: number | null;
  /** Cuántas veces la base fueron las aperturas del día; `null` sin base. Un pico de un día no es una señal. */
  readonly veces_la_base: number | null;
}

/**
 * La serie diaria de la cuenta con la marca de anomalía de cada día. `dias` va ascendente e incluye los
 * `DIAS_DE_BASE` anteriores al primero que se muestra (sirven solo para la base); se devuelven los últimos `mostrar`.
 * Un día sin actividad cuenta como cero. `usuariosActivos` es el de hoy: no hay historia de cuántos usuarios hubo.
 */
export function armarSerieDeFlujo(entrada: {
  readonly dias: readonly string[];
  readonly mostrar: number;
  readonly actividad: ReadonlyMap<string, ActividadSimple>;
  readonly usuariosActivos: number;
  readonly umbrales: UmbralesDeFlujo;
}): DiaDeFlujo[] {
  const nulo: ActividadSimple = { aperturas: 0, rechazos: 0, generados: 0 };
  const serie = entrada.dias.map((dia, indice): DiaDeFlujo => {
    const actividad = entrada.actividad.get(dia) ?? nulo;
    const anteriores = entrada.dias
      .slice(Math.max(0, indice - DIAS_DE_BASE), indice)
      .map((anterior) => entrada.actividad.get(anterior)?.aperturas ?? 0);
    const base = baseHabitual(anteriores);
    const medida = { aperturas: actividad.aperturas, usuariosActivos: entrada.usuariosActivos };
    return {
      dia,
      aperturas: actividad.aperturas,
      rechazos: actividad.rechazos,
      generados: actividad.generados,
      por_usuario: aperturasPorUsuario(medida),
      atipico: esFlujoAtipico(medida, entrada.umbrales),
      base,
      veces_la_base:
        base === null || base <= 0 ? null : Math.round((actividad.aperturas / base) * 10) / 10,
    };
  });
  return serie.slice(Math.max(0, serie.length - entrada.mostrar));
}
