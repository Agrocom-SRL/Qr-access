import type { Pool } from 'mysql2/promise';
import {
  crearRol,
  crearUsuarioConPin,
  PERMISOS_DE_GUARDIA,
  type Escenario,
  type UsuarioDePrueba,
} from './fixtures.js';

/**
 * El árbol de una cuenta de prueba (ADR 0028), colgando del Administrador del escenario:
 *
 *     administrador ─┬─ titular1 ─┬─ miembro1
 *                    │            └─ miembro1b
 *                    ├─ titular2 ──── miembro2
 *                    └─ guardia
 */
export interface Arbol {
  readonly titular1: UsuarioDePrueba;
  readonly titular2: UsuarioDePrueba;
  readonly miembro1: UsuarioDePrueba;
  readonly miembro1b: UsuarioDePrueba;
  readonly miembro2: UsuarioDePrueba;
  readonly guardia: UsuarioDePrueba;
  readonly rolGuardiaId: string;
}

export async function armarArbol(pool: Pool, escenario: Escenario): Promise<Arbol> {
  const { cuenta, administrador } = escenario;
  const superiorId = administrador.id;
  const rolGuardiaId = await crearRol(pool, cuenta, 'Guardia', PERMISOS_DE_GUARDIA);
  const titular1 = await crearUsuarioConPin(pool, cuenta, 'TI01', [escenario.rolTitularId], {
    superiorId,
  });
  const titular2 = await crearUsuarioConPin(pool, cuenta, 'TI02', [escenario.rolTitularId], {
    superiorId,
  });
  return {
    titular1,
    titular2,
    miembro1: await crearUsuarioConPin(pool, cuenta, 'ME01', [escenario.rolMiembroId], {
      superiorId: titular1.id,
    }),
    miembro1b: await crearUsuarioConPin(pool, cuenta, 'ME1B', [escenario.rolMiembroId], {
      superiorId: titular1.id,
    }),
    miembro2: await crearUsuarioConPin(pool, cuenta, 'ME02', [escenario.rolMiembroId], {
      superiorId: titular2.id,
    }),
    guardia: await crearUsuarioConPin(pool, cuenta, 'GU01', [rolGuardiaId], { superiorId }),
    rolGuardiaId,
  };
}

/**
 * La rama de un SEGUNDO Administrador de la misma cuenta (ADR 0028 §4: cada Administrador ve solo su rama):
 *
 *     administrador2 ─┬─ titular3 ──── miembro3
 *                     └─ guardia2
 */
export interface SegundaRama {
  readonly administrador2: UsuarioDePrueba;
  readonly titular3: UsuarioDePrueba;
  readonly miembro3: UsuarioDePrueba;
  readonly guardia2: UsuarioDePrueba;
}

export async function armarSegundaRama(
  pool: Pool,
  escenario: Escenario,
  arbol: Arbol,
): Promise<SegundaRama> {
  const { cuenta } = escenario;
  const administrador2 = await crearUsuarioConPin(pool, cuenta, 'AD02', [
    escenario.rolAdministradorId,
  ]);
  const titular3 = await crearUsuarioConPin(pool, cuenta, 'TI03', [escenario.rolTitularId], {
    superiorId: administrador2.id,
  });
  return {
    administrador2,
    titular3,
    miembro3: await crearUsuarioConPin(pool, cuenta, 'ME03', [escenario.rolMiembroId], {
      superiorId: titular3.id,
    }),
    guardia2: await crearUsuarioConPin(pool, cuenta, 'GU02', [arbol.rolGuardiaId], {
      superiorId: administrador2.id,
    }),
  };
}
