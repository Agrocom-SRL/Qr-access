import { z } from 'zod';
import { esquemaListado, esquemaPaginacion } from '../../platform/http/paginacion.js';
import { GRAVEDADES, TIPOS_DE_INCIDENTE } from '../incidentes/contracts.js';
import { MAX_DIAS_DE_FLUJO } from './domain/reglas.js';

const esquemaId = z.string().regex(/^\d{1,19}$/);
const esquemaBuscar = z.string().trim().min(1).max(60);
const esquemaSentido = z.enum(['desc', 'asc']).default('desc');
/** Un booleano de query: `true` o `false` (z.coerce.boolean() tomaría «false» como verdadero). */
const esquemaBandera = z.enum(['true', 'false']).transform((valor) => valor === 'true');

const esquemaCuenta = z.object({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  estado: z.string(),
});

export const parametrosDeCuentaDeSenales = z.object({ cuenta_id: esquemaId });

// ---- Consumo de la bolsa --------------------------------------------------------------------------------------

export const ESTADOS_DE_BOLSA = ['normal', 'aviso', 'superada', 'sin_tope'] as const;

export const consultaDeConsumo = esquemaPaginacion.extend({
  estado: z.enum(ESTADOS_DE_BOLSA).optional(),
  /** Parte del código o del nombre de la cuenta. */
  buscar: esquemaBuscar.optional(),
  orden: z.enum(['porcentaje', 'usado', 'tope', 'nombre']).default('porcentaje'),
  sentido: esquemaSentido,
});

const esquemaConsumo = z.object({
  cuenta: esquemaCuenta,
  plan: z.string().nullable(),
  usado: z.number().int(),
  tope: z.number().int().nullable(),
  /** Un decimal; puede pasar de 100. `null` sin bolsa. */
  porcentaje: z.number().nullable(),
  estado: z.enum(ESTADOS_DE_BOLSA),
  origen_del_tope: z.enum(['excepcion', 'plan', 'general']).nullable(),
  aviso_at: z.string().nullable(),
  superada_at: z.string().nullable(),
});

export const respuestaDeConsumo = z.object({
  datos: z.array(esquemaConsumo),
  meta: z.object({
    pagina: z.number().int(),
    por_pagina: z.number().int(),
    /** Cuentas que cumplen el filtro. */
    total: z.number().int(),
    /** Mes local en curso (`aaaa-mm`) y desde cuándo se cuenta (ISO UTC). */
    mes: z.string(),
    desde: z.string(),
    aviso_porcentaje: z.number().int(),
    /** Cuántas cuentas hay en cada estado, sin aplicar el filtro de estado ni el de búsqueda. */
    por_estado: z.object({
      normal: z.number().int(),
      aviso: z.number().int(),
      superada: z.number().int(),
      sin_tope: z.number().int(),
    }),
  }),
});

export const respuestaDeConsumoDeCuenta = esquemaConsumo.extend({
  mes: z.string(),
  desde: z.string(),
  aviso_porcentaje: z.number().int(),
  /** QR generados por día local del mes en curso, hasta hoy (los días sin QR van en cero). */
  serie: z.array(z.object({ dia: z.string(), generados: z.number().int() })),
});

// ---- Señales abiertas -----------------------------------------------------------------------------------------

export const consultaDeSenales = esquemaPaginacion.extend({
  cuenta_id: esquemaId.optional(),
  usuario_id: esquemaId.optional(),
  tipo: z.enum(TIPOS_DE_INCIDENTE).optional(),
  gravedad: z.enum(GRAVEDADES).optional(),
  /** `abiertas` = sin resolver o pendientes; los demás, el resultado de la última resolución. */
  estado: z.enum(['abiertas', 'sin_resolver', 'pendiente', 'confirmado', 'descartado']).optional(),
  desde: z.iso
    .datetime({ offset: true })
    .transform((texto) => new Date(texto))
    .optional(),
  hasta: z.iso
    .datetime({ offset: true })
    .transform((texto) => new Date(texto))
    .optional(),
});

const esquemaSenal = z.object({
  id: z.string(),
  cuenta: esquemaCuenta.pick({ id: true, codigo: true, nombre: true }),
  usuario: z.object({ id: z.string(), etiqueta: z.string().nullable() }),
  tipo: z.enum(TIPOS_DE_INCIDENTE),
  gravedad: z.enum(GRAVEDADES),
  /** Código con el detalle medido (`aperturas=23;umbral=12`), no una frase. */
  descripcion: z.string().nullable(),
  /** Solo ids; nunca un token. */
  evidencia: z.object({
    qr_ids: z.array(z.string()),
    evento_acceso_ids: z.array(z.string()),
    evento_limite_ids: z.array(z.string()),
  }),
  estado: z.enum(['sin_resolver', 'pendiente', 'confirmado', 'descartado']),
  ocurrido_at: z.string(),
  created_at: z.string(),
});

export const respuestaDeSenales = esquemaListado(esquemaSenal);

export const consultaDeResumenDeSenales = z.object({
  dias: z.coerce.number().int().min(1).max(MAX_DIAS_DE_FLUJO).default(7),
});

export const respuestaDeResumenDeSenales = z.object({
  desde: z.string(),
  hasta: z.string(),
  dias: z.number().int(),
  total: z.number().int(),
  abiertas: z.number().int(),
  por_tipo: z.array(
    z.object({
      tipo: z.enum(TIPOS_DE_INCIDENTE),
      total: z.number().int(),
      abiertas: z.number().int(),
      altas: z.number().int(),
    }),
  ),
  /** Las diez cuentas con más señales (primero las de más gravedad alta). */
  cuentas: z.array(
    z.object({
      cuenta: esquemaCuenta.pick({ id: true, codigo: true, nombre: true }),
      total: z.number().int(),
      abiertas: z.number().int(),
      altas: z.number().int(),
    }),
  ),
});

// ---- Flujo atípico --------------------------------------------------------------------------------------------

export const consultaDeFlujoDeCuenta = z.object({
  dias: z.coerce.number().int().min(1).max(MAX_DIAS_DE_FLUJO).default(30),
});

export const consultaDeFlujoDeCuentas = esquemaPaginacion.extend({
  /** Días (hasta hoy) que se miran para contar los atípicos. */
  dias: z.coerce.number().int().min(1).max(30).default(7),
  solo_atipicas: esquemaBandera.default(false),
  buscar: esquemaBuscar.optional(),
  orden: z.enum(['por_usuario', 'aperturas', 'dias_atipicos', 'nombre']).default('por_usuario'),
  sentido: esquemaSentido,
});

const esquemaDiaDeFlujo = z.object({
  dia: z.string(),
  aperturas: z.number().int(),
  rechazos: z.number().int(),
  generados: z.number().int(),
  por_usuario: z.number(),
  /** Marca de anomalía: el día cruzó los dos umbrales del flujo. Un pico de un día no es una señal por sí solo. */
  atipico: z.boolean(),
  base: z.number().nullable(),
  veces_la_base: z.number().nullable(),
});

const esquemaUmbralesDeFlujo = z.object({
  aperturas_minimo: z.number().int(),
  aperturas_por_usuario: z.number().int(),
});

export const respuestaDeFlujoDeCuenta = z.object({
  cuenta: esquemaCuenta,
  /** Usuarios activos de HOY (no hay historia de cuántos hubo cada día). */
  usuarios_activos: z.number().int(),
  umbrales: esquemaUmbralesDeFlujo,
  zona_horaria: z.string(),
  serie: z.array(esquemaDiaDeFlujo),
});

const esquemaFlujoDeCuenta = z.object({
  cuenta: esquemaCuenta,
  usuarios_activos: z.number().int(),
  umbrales: esquemaUmbralesDeFlujo,
  aperturas_hoy: z.number().int(),
  por_usuario_hoy: z.number(),
  atipica_hoy: z.boolean(),
  aperturas_periodo: z.number().int(),
  /** Días del periodo (incluido hoy) en que el flujo fue atípico. */
  dias_atipicos: z.number().int(),
  ultimo_dia_atipico: z.string().nullable(),
  base: z.number().nullable(),
});

export const respuestaDeFlujoDeCuentas = z.object({
  datos: z.array(esquemaFlujoDeCuenta),
  meta: z.object({
    pagina: z.number().int(),
    por_pagina: z.number().int(),
    total: z.number().int(),
    dias: z.number().int(),
    hoy: z.string(),
  }),
});
