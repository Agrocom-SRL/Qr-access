import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import { TABLAS_RELEVANTES, type Valores } from './domain/clasificar.js';

export interface BitacoraFila extends RowDataPacket {
  id: string;
  tenant_id: string | null;
  usuario_id: string | null;
  dispositivo_id: string | null;
  tabla: string;
  registro_id: string;
  accion: 'creado' | 'actualizado' | 'eliminado' | 'restaurado';
  origen: 'api' | 'dispositivo' | 'sistema';
  antes: Valores | null;
  despues: Valores | null;
  ocurrido_at: Date;
}

export interface FiltroDeBitacora {
  readonly cuentaId?: string | undefined;
  readonly accion?: BitacoraFila['accion'] | undefined;
  readonly desde?: Date | undefined;
  readonly hasta?: Date | undefined;
}

const COLUMNAS =
  't.id, t.tenant_id, t.usuario_id, t.dispositivo_id, t.tabla, t.registro_id, t.accion, t.origen, t.antes, t.despues, t.ocurrido_at';

/**
 * Lectura de `bitacoras` de TODAS las cuentas para el super admin (A10, A05d, Resumen). Salto
 * EXPLÍCITO del aislamiento: solo lee, nunca escribe (la tabla es de solo inserción y la
 * escribe el repositorio base). Las condiciones son constantes; los valores van con `?`.
 */
export class RepositorioDeBitacora extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, { nombre: 'bitacoras', columnas: [], perfil: 'solo_insercion', deCuenta: false });
  }

  private condiciones(filtro: FiltroDeBitacora): { donde: string; params: unknown[] } {
    // La suscripción y los datos de empresa del alta ya van dentro de "Creó cuenta": no se repiten.
    const partes = [
      't.tabla IN (?)',
      "NOT (t.tabla IN ('suscripciones', 'cuenta_datos_empresa') AND t.accion = 'creado')",
    ];
    const params: unknown[] = [[...TABLAS_RELEVANTES]];
    if (filtro.cuentaId !== undefined) {
      // El alta de la cuenta se registra sin cuenta (la tabla `cuentas` es de plataforma): se encuentra por su id.
      partes.push("(t.tenant_id = ? OR (t.tabla = 'cuentas' AND t.registro_id = ?))");
      params.push(filtro.cuentaId, filtro.cuentaId);
    }
    if (filtro.accion !== undefined) {
      partes.push('t.accion = ?');
      params.push(filtro.accion);
    }
    if (filtro.desde !== undefined) {
      partes.push('t.ocurrido_at >= ?');
      params.push(filtro.desde);
    }
    if (filtro.hasta !== undefined) {
      partes.push('t.ocurrido_at < ?');
      params.push(filtro.hasta);
    }
    return { donde: partes.join(' AND '), params };
  }

  listar(
    filtro: FiltroDeBitacora,
    limite: number,
    desplazamiento: number,
  ): Promise<BitacoraFila[]> {
    const { donde, params } = this.condiciones(filtro);
    return this.seleccionar<BitacoraFila>({
      columnas: COLUMNAS,
      donde,
      params,
      orden: 't.ocurrido_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contarCon(filtro: FiltroDeBitacora): Promise<number> {
    const { donde, params } = this.condiciones(filtro);
    return this.contar({ donde, params });
  }
}
