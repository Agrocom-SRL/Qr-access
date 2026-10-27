import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeCuentas } from '../../seguridad/contracts.js';
import type { RecursoExportable } from '../domain/exportacion.js';
import { exportarPagina, type PaginaExportada } from './exportar-datos.js';
import type { FiltrosDeLecturas } from './listar-lecturas.js';

/**
 * Una página de datos de UNA cuenta en CSV para AGROCOM (ADR 0033 §3, ola W11): `usuarios`, `puertas` o `lecturas`.
 *
 * Es la exportación de la cuenta (`exportar-datos.ts`) con otro alcance: AGROCOM no tiene árbol, así que se lleva
 * TODA la cuenta (todos sus usuarios, todas sus puertas y todas sus lecturas). Lo demás es lo mismo y no se salta:
 * el tope de 10000 filas por recurso (422 `exportacion.tope_excedido`), el CSV sin tokens, hashes ni PIN, la
 * neutralización de fórmulas y la constancia en `exportaciones`, escrita en la misma operación; el límite de
 * exportación por hora lo aplica la ruta (`config.limite`).
 *
 * - **Aislamiento:** opera DENTRO de la cuenta del path (`comoPlataformaEn`, salto explícito ya autorizado por el
 *   permiso de plataforma de la ruta); el repositorio de cuenta filtra por ella. Cuenta inexistente: 404
 *   `cuenta.no_encontrada`.
 * - **Autoría:** la constancia (`created_by` y la bitácora) la firma el super admin, que existe en `usuarios` con
 *   `tenant_id NULL`; así queda claro en la cuenta QUIÉN de AGROCOM se llevó los datos.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  recurso: RecursoExportable,
  paginacion: { readonly pagina: number; readonly por_pagina: number },
  filtros: FiltrosDeLecturas,
): Promise<PaginaExportada> {
  if (!(await crearServicioDeCuentas(pool).existe(cuentaId))) {
    throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  }
  return ContextoCuenta.comoPlataformaEn(cuentaId, principal.usuarioId, () =>
    exportarPagina(
      pool,
      {
        usuariosYPuertas: null,
        // Sin `generadoPor` ni `puertaIds`: todas las lecturas de la cuenta (con los filtros pedidos).
        lecturas: () =>
          Promise.resolve({
            generadoPor: null,
            puertaIds: null,
            resultado: filtros.resultado,
            ejecucion: filtros.ejecucion ?? null,
            puertaId: filtros.puertaId,
            desde: filtros.desde,
            hasta: filtros.hasta,
          }),
      },
      recurso,
      paginacion,
      filtros,
    ),
  );
}
