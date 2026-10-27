import type { Pool } from 'mysql2/promise';
import { armarListado, type Listado, type Paginacion } from '../../../platform/http/paginacion.js';
import { aIsoONulo } from '../../../platform/tiempo/fechas.js';
import {
  crearServicioDeSuscripcionesDePlataforma,
  type EstadoDeSuscripcion,
} from '../../suscripciones/contracts.js';
import type { Estado } from '../domain/estado.js';
import {
  contarPorEstado,
  filtrarCuentas,
  type ConteoPorEstado,
  type FiltroDeEstado,
} from '../domain/cuentas.js';
import { RepositorioDeConteoDeUsuarios, RepositorioDeCuentasDePlataforma } from '../repository.js';

export interface CuentaListada {
  id: string;
  codigo: string;
  nombre: string;
  /** El estado de la cuenta (no el de su suscripción, que va en `estado`). */
  cuenta_estado: Estado;
  plan: { id: string; nombre: string; cupo_usuarios: number | null } | null;
  usuarios_activos: number;
  vence_el: string | null;
  estado: EstadoDeSuscripcion;
}

export interface ListadoDeCuentas extends Listado<CuentaListada> {
  conteos: ConteoPorEstado;
}

/**
 * Las cuentas con su plan, usuarios y estado de suscripción (A03). Cruza `cuentas`, la suscripción
 * de cada una (contrato de `suscripciones`) y sus usuarios activos; busca, filtra y pagina en memoria.
 */
export async function ejecutar(
  pool: Pool,
  consulta: { busqueda: string; estado: FiltroDeEstado },
  paginacion: Paginacion,
  ahora: Date = new Date(),
): Promise<ListadoDeCuentas> {
  const cuentas = await new RepositorioDeCuentasDePlataforma(pool).listarTodas();
  const [suscripciones, usuarios] = await Promise.all([
    crearServicioDeSuscripcionesDePlataforma(pool).deTodasLasCuentas(ahora),
    new RepositorioDeConteoDeUsuarios(pool).activosPorCuenta(cuentas.map((c) => c.id)),
  ]);

  const todas: CuentaListada[] = cuentas.map((cuenta) => {
    const suscripcion = suscripciones.get(cuenta.id);
    return {
      id: cuenta.id,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      cuenta_estado: cuenta.estado,
      plan:
        suscripcion === undefined
          ? null
          : {
              id: suscripcion.plan.id,
              nombre: suscripcion.plan.nombre,
              cupo_usuarios: suscripcion.plan.cupoUsuarios,
            },
      usuarios_activos: usuarios.get(cuenta.id) ?? 0,
      vence_el: aIsoONulo(suscripcion?.hasta ?? null),
      // Sin suscripción la cuenta no genera QR: se muestra como vencida.
      estado: suscripcion?.estado ?? 'vencida',
    };
  });

  const filtradas = filtrarCuentas(todas, consulta);
  const desde = (paginacion.pagina - 1) * paginacion.por_pagina;
  return {
    ...armarListado(
      filtradas.slice(desde, desde + paginacion.por_pagina),
      paginacion,
      filtradas.length,
    ),
    conteos: contarPorEstado(todas),
  };
}
