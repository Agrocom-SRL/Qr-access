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
