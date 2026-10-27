import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeCuentas } from '../../seguridad/contracts.js';
import { presentarIncidentes, type IncidenteDeUso } from '../presentacion.js';
import { RepositorioDeIncidentes } from '../repository.js';
import type { FiltrosDeIncidentes } from './listar-incidentes.js';

/**
 * Los incidentes de uso de UNA cuenta, para AGROCOM (ADR 0033 §4.3: la propuesta le llega a AGROCOM, que decide sobre
 * una cuenta). Solo lectura. Opera DENTRO de la cuenta (ADR 0004 §7): salto explícito del aislamiento, ya autorizado
 * por el permiso de plataforma de la ruta; el repositorio de cuenta filtra por ella. Una cuenta inexistente es 404.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  filtros: FiltrosDeIncidentes,
  paginacion: Paginacion,
): Promise<Listado<IncidenteDeUso>> {
  if (!(await crearServicioDeCuentas(pool).existe(cuentaId))) {
    throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  }
  return ContextoCuenta.comoPlataformaEn(cuentaId, principal.usuarioId, async () => {
    const filtro = { usuarioIds: null, ...filtros };
    const { limite, desplazamiento } = limiteDe(paginacion);
    const repositorio = new RepositorioDeIncidentes(pool);
    const [filas, total] = await Promise.all([
      repositorio.listar(filtro, limite, desplazamiento),
      repositorio.contarFiltrados(filtro),
    ]);
    return armarListado(await presentarIncidentes(pool, filas), paginacion, total);
  });
}
