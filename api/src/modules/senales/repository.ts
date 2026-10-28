import type { Pool } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

/**
 * Dueño de `avisos_de_senal`: la constancia de que una señal ya se llevó a la bandeja (ADR 0030 §5: no se avisa dos
 * veces por el mismo evento en el mismo día). De solo inserción; el UNIQUE `(tenant_id, clave_unica)` es el árbitro.
 */
export class RepositorioDeAvisosDeSenal extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'avisos_de_senal',
      columnas: ['tipo', 'usuario_id', 'clave_unica'],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  /** ¿Ya se avisó (o se decidió no avisar) esta clave en la cuenta del contexto? Es una lectura, sin bloqueo. */
  async existe(claveUnica: string): Promise<boolean> {
    return (await this.contar({ donde: 't.clave_unica = ?', params: [claveUnica] })) > 0;
  }

  /**
   * Deja la constancia; `false` si la clave ya estaba (otra pasada se adelantó). Un choque contra el único no
   * deshace la transacción: la sentencia falla sola y `tx` sigue viva.
   */
  async registrar(
    tx: Transaccion,
    constancia: { tipo: string; usuarioId: string | null; claveUnica: string },
  ): Promise<boolean> {
    try {
      await this.insertar(tx, {
        tipo: constancia.tipo,
        usuario_id: constancia.usuarioId,
        clave_unica: constancia.claveUnica,
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  }
}
