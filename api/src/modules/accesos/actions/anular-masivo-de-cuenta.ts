import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeArbol, crearServicioDeCuentas } from '../../seguridad/contracts.js';
import {
  anularEnLotes,
  TAMANO_DE_LOTE_DE_ANULACION,
  type PedidoDeAnulacionMasiva,
  type ResultadoDeAnulacionMasiva,
} from './anular-masivo.js';
import { TODA_LA_CUENTA, type IdsOTodaLaCuenta } from '../../../platform/db/alcance.js';

/**
 * Anula en bloque los QR VIGENTES de una cuenta, de un usuario suyo o de una rama, para AGROCOM (ADR 0031 §3,
 * ADR 0033 §3): la respuesta ante un incidente que la cuenta no alcanza a cortar sola.
 *
 * - **Aislamiento:** opera DENTRO de la cuenta del path (`comoPlataformaEn`, salto explícito del aislamiento ya
 *   autorizado por el permiso de plataforma de la ruta); una cuenta inexistente es 404 `cuenta.no_encontrada` y un
 *   usuario que no es de ESA cuenta, 404 `usuario.no_encontrado` (el repositorio filtra por la cuenta).
 * - **Alcance:** AGROCOM no tiene árbol: `cuenta` es TODA la cuenta (todos sus usuarios) y `usuario`/`rama` exigen
 *   `usuarioId` (no hay «el propio actor»).
 * - **Autoría:** firma el super admin (`anulado_por`, `created_by` y la bitácora con origen `api` y su usuario). Su
 *   fila está en `usuarios` (con `tenant_id NULL`), así que las FK se cumplen sin inventar un usuario de la cuenta.
 * - **Lotes y constancia:** los mismos topes que la anulación de la cuenta (lotes de 500, una constancia al final).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  pedido: PedidoDeAnulacionMasiva,
  ahora: Date = new Date(),
  tamanoDeLote: number = TAMANO_DE_LOTE_DE_ANULACION,
): Promise<ResultadoDeAnulacionMasiva> {
  if (!(await crearServicioDeCuentas(pool).existe(cuentaId))) {
    throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  }
  return ContextoCuenta.comoPlataformaEn(cuentaId, principal.usuarioId, async () => {
    const arbol = crearServicioDeArbol(pool);
    let generadores: IdsOTodaLaCuenta;
    let usuariosAlcanzados: number;
    let objetivo: string | null;
    if (pedido.alcance === 'cuenta') {
      // Toda la cuenta, sin pasar por la lista de usuarios: también los QR de quien ya se dio de baja.
      generadores = TODA_LA_CUENTA;
      usuariosAlcanzados = (await arbol.idsDeLaCuenta()).length;
      objetivo = null;
    } else {
      objetivo = pedido.usuarioId;
      if (objetivo === null || (await arbol.estadoPropioDe(objetivo)) === null) {
        throw new ErrorDeDominio('usuario.no_encontrado', 404);
      }
      const ids = pedido.alcance === 'usuario' ? [objetivo] : await arbol.ramaDe(objetivo);
      generadores = ids;
      usuariosAlcanzados = ids.length;
    }
    return anularEnLotes(
      pool,
      { generadores, usuariosAlcanzados, alcance: pedido.alcance, objetivo, motivo: pedido.motivo },
      principal.usuarioId,
      ahora,
      tamanoDeLote,
    );
  });
}
