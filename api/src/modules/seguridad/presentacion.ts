import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import { aIsoONulo } from '../../platform/tiempo/fechas.js';
import { crearServicioDeOrganizacion } from '../organizacion/contracts.js';
import {
  estadoEfectivo,
  nodosDeEstado,
  type Estado,
  type OrigenDeEstado,
} from './domain/estado.js';
import {
  RepositorioDeCuentas,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
  type UsuarioFila,
} from './repository.js';

export interface UsuarioListado {
  id: string;
  etiqueta: string | null;
  /** `true` si puede operar: ni él, ni un superior, ni su cuenta lo tienen suspendido. */
  activo: boolean;
  /** Su estado propio. */
  estado: Estado;
  /** El efectivo: el peor entre el suyo, los de sus superiores y el de su cuenta (D-25). */
  estado_efectivo: Estado;
  /** De dónde viene el efectivo cuando no es `activo`. */
  estado_origen: OrigenDeEstado | null;
  estado_motivo: string | null;
  estado_desde: string | null;
  /** Quién impuso el estado propio (`null` si no se sabe o si está activo). */
  estado_impuesto_por: string | null;
  roles: { id: string; nombre: string }[];
  /** La unidad de un Titular (ADR 0028); `null` en el resto. */
  unidad: { id: string; nombre: string; sitio_id: string } | null;
  pin_generado_at: string | null;
  ultimo_ingreso_at: string | null;
  created_at: string;
}

/** Arma los usuarios con sus roles y su último ingreso; nunca con nada del PIN (invariante 6). */
export async function presentarUsuarios(
  pool: Pool,
  filas: readonly UsuarioFila[],
): Promise<UsuarioListado[]> {
  const ids = filas.map((fila) => fila.id);
  const [roles, ingresos, unidades, todos, cuenta] = await Promise.all([
    new RepositorioDeRolesDeUsuario(pool).rolesDeVarios(ids),
    new RepositorioDeSesiones(pool).ultimoIngresoDe(ids),
    crearServicioDeOrganizacion(pool).unidadesDeTitulares(ids),
    new RepositorioDeUsuarios(pool).estadosDeTodos(),
    new RepositorioDeCuentas(pool).buscarPorId(ContextoCuenta.cuentaRequerida()),
  ]);
  // Los superiores pueden quedar fuera de la página: el efectivo se deriva con todos los de la cuenta.
  const nodos = nodosDeEstado(todos);
  return filas.map((fila) => {
    const efectivo = estadoEfectivo(fila.id, nodos, cuenta?.estado ?? 'suspendido');
    return {
      id: fila.id,
      etiqueta: fila.etiqueta,
      activo: efectivo.estado === 'activo' || efectivo.estado === 'restringido',
      estado: fila.estado,
      // `eliminado` no llega acá (la lista solo trae vigentes); ante la duda se muestra lo más grave.
      estado_efectivo: efectivo.estado === 'eliminado' ? 'suspendido' : efectivo.estado,
      estado_origen: efectivo.origen,
      estado_motivo: fila.estado_motivo,
      estado_desde: aIsoONulo(fila.estado_desde),
      estado_impuesto_por: fila.estado_impuesto_por,
      roles: (roles.get(fila.id) ?? []).map((rol) => ({ id: rol.id, nombre: rol.nombre })),
      unidad: ((unidad) =>
        unidad === undefined
          ? null
          : { id: unidad.id, nombre: unidad.nombre, sitio_id: unidad.sitioId })(
        unidades.get(fila.id),
      ),
      pin_generado_at: aIsoONulo(fila.pin_generado_at),
      ultimo_ingreso_at: aIsoONulo(ingresos.get(fila.id) ?? null),
      created_at: fila.created_at.toISOString(),
    };
  });
}
