/**
 * Convierte una fila cruda de `bitacoras` en un evento que el panel sabe mostrar (A10, A05d). La
 * API entrega un `codigo` estable y valores simples; el panel los traduce (invariante 12).
 */

export type Valores = Readonly<Record<string, unknown>>;
export type ValorSimple = string | number | boolean | null;

export interface CambioCrudo {
  readonly tabla: string;
  readonly accion: 'creado' | 'actualizado' | 'eliminado' | 'restaurado';
  readonly registroId: string;
  /** `null` = cambio de plataforma (no de una cuenta). */
  readonly tenantId: string | null;
  readonly antes: Valores | null;
  readonly despues: Valores | null;
}

/** Tablas cuyo cambio le interesa al super admin (el resto es ruido operativo de las cuentas). */
export const TABLAS_RELEVANTES = [
  'cuentas',
  'cuenta_datos_empresa',
  'suscripciones',
  'pagos',
  'planes',
  'usuarios',
  'sitios',
  'puertas',
  'dispositivos',
] as const;

const SINGULAR: Readonly<Record<string, string>> = {
  sitios: 'sitio',
  puertas: 'puerta',
  dispositivos: 'dispositivo',
  usuarios: 'usuario',
};

const VERBO = {
  creado: 'creado',
  actualizado: 'editado',
  eliminado: 'eliminado',
  restaurado: 'restaurado',
} as const;

function cambio(valores: Valores | null, campo: string): boolean {
  return valores !== null && campo in valores;
}

/**
 * El tipo de evento: `cuenta.creada`, `suscripcion.plan_cambiado`, `pago.registrado`… Lo que no
 * tiene un nombre propio cae en `<entidad>.<creado|editado|eliminado>`.
 */
export function clasificarCambio(c: CambioCrudo): string {
  switch (c.tabla) {
    case 'cuentas':
      if (c.accion === 'creado') return 'cuenta.creada';
      break;
    case 'cuenta_datos_empresa':
      if (c.accion === 'actualizado') return 'empresa.editada';
      if (c.accion === 'creado') return 'empresa.registrada';
      break;
    case 'suscripciones':
      if (c.accion === 'creado') return 'suscripcion.creada';
      if (cambio(c.despues, 'plan_id')) return 'suscripcion.plan_cambiado';
      if (cambio(c.despues, 'estado')) {
        return c.despues?.estado === 'suspendida'
          ? 'suscripcion.suspendida'
          : 'suscripcion.reactivada';
      }
      if (cambio(c.despues, 'hasta')) return 'suscripcion.renovada';
      break;
    case 'pagos':
      if (c.accion === 'creado') return 'pago.registrado';
      break;
    case 'planes':
      if (cambio(c.despues, 'precio_anual')) return 'plan.precio_editado';
      break;
    case 'usuarios':
      if (c.tenantId === null) {
        if (c.accion === 'creado') return 'equipo.agregado';
        if (c.despues?.activo === 0) return 'equipo.desactivado';
        if (cambio(c.despues, 'contrasena_temporal')) return 'equipo.contrasena_cambiada';
      } else if (c.accion !== 'creado' && cambio(c.despues, 'pin_generado_at')) {
        return 'usuario.pin_regenerado';
      }
      break;
    default:
  }
  return `${SINGULAR[c.tabla] ?? c.tabla}.${VERBO[c.accion]}`;
}

function simple(valor: unknown): ValorSimple {
  return typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean'
    ? valor
    : null;
}

function soloCampos(
  valores: Valores | null,
  campos: readonly string[],
): Record<string, ValorSimple> | null {
  if (valores === null) return null;
  const salida: Record<string, ValorSimple> = {};
  for (const campo of campos) if (campo in valores) salida[campo] = simple(valores[campo]);
  return salida;
}

export interface Detalle {
  antes: Record<string, ValorSimple> | null;
  despues: Record<string, ValorSimple> | null;
}

/**
 * Los valores de antes y después que muestra cada evento, ya con los nombres resueltos
 * (`nombresDePlanes`: id → nombre). Nunca incluye secretos: el repositorio base ya los quitó.
 */
export function detalleDelCambio(
  codigo: string,
  c: CambioCrudo,
  nombresDePlanes: ReadonlyMap<string, string>,
): Detalle {
  const plan = (id: unknown) => nombresDePlanes.get(String(id)) ?? null;
  switch (codigo) {
    case 'suscripcion.plan_cambiado':
      return {
        antes: { plan: plan(c.antes?.plan_id) },
        despues: { plan: plan(c.despues?.plan_id) },
      };
    case 'suscripcion.renovada':
      return { antes: soloCampos(c.antes, ['hasta']), despues: soloCampos(c.despues, ['hasta']) };
    case 'suscripcion.suspendida':
    case 'suscripcion.reactivada':
      return { antes: soloCampos(c.antes, ['estado']), despues: soloCampos(c.despues, ['estado']) };
    case 'pago.registrado':
      return { antes: null, despues: soloCampos(c.despues, ['monto', 'referencia', 'tipo']) };
    case 'plan.precio_editado':
      return {
        antes: { plan: plan(c.registroId), precio_anual: simple(c.antes?.precio_anual) },
        despues: { plan: plan(c.registroId), precio_anual: simple(c.despues?.precio_anual) },
      };
    case 'cuenta.creada':
      return { antes: null, despues: soloCampos(c.despues, ['nombre', 'codigo']) };
    case 'equipo.agregado':
      return { antes: null, despues: soloCampos(c.despues, ['etiqueta', 'username']) };
    case 'equipo.desactivado':
      return { antes: { activo: true }, despues: { activo: false } };
    case 'usuario.creado':
      return { antes: null, despues: soloCampos(c.despues, ['etiqueta']) };
    default: {
      const campos = Object.keys(c.despues ?? c.antes ?? {}).filter(
        (campo) => !['pin_generado_at', 'contrasena_temporal'].includes(campo),
      );
      return { antes: soloCampos(c.antes, campos), despues: soloCampos(c.despues, campos) };
    }
  }
}
