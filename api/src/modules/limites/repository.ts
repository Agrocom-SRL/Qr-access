import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';

export interface ConfiguracionFila extends RowDataPacket {
  id: string;
  clave: string;
  valor: number;
}

/** Dueño de `configuracion_limites`: los topes de la plataforma, sin cuenta (los edita AGROCOM). */
export class RepositorioDeConfiguracion extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'configuracion_limites',
      columnas: ['clave', 'valor'],
      perfil: 'dominio',
      deCuenta: false,
    });
  }

  listar(): Promise<ConfiguracionFila[]> {
    return this.seleccionar<ConfiguracionFila>({
      columnas: 't.id, t.clave, t.valor',
      orden: 't.clave',
    });
  }

  buscarPorClave(clave: string): Promise<ConfiguracionFila | null> {
    return this.seleccionarUna<ConfiguracionFila>({
      columnas: 't.id, t.clave, t.valor',
      donde: 't.clave = ?',
      params: [clave],
    });
  }

  /** Cambia el valor de una clave que ya existe; la bitácora guarda el antes y el después. */
  cambiar(tx: Transaccion, id: string, valor: number): Promise<boolean> {
    return this.actualizar(tx, id, { valor });
  }

  /** Crea una clave que falta (una base sin sembrar); lo normal es que ya esté sembrada. */
  crear(tx: Transaccion, clave: string, valor: number): Promise<string> {
    return this.insertar(tx, { clave, valor });
  }
}

export interface ExcepcionFila extends RowDataPacket {
  id: string;
  usuario_id: string | null;
  clave: string;
  valor: number;
  created_at: Date;
}

const COLUMNAS_DE_EXCEPCION = 't.id, t.usuario_id, t.clave, t.valor, t.created_at';

/** Dueño de `excepciones_de_limite`: lo que una cuenta o un usuario tiene distinto del tope general. */
export class RepositorioDeExcepciones extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'excepciones_de_limite',
      columnas: ['usuario_id', 'clave', 'valor'],
      perfil: 'dominio',
      deCuenta: true,
    });
  }

  /** Todas las de la cuenta del contexto, las de la cuenta y las de sus usuarios. */
  listar(): Promise<ExcepcionFila[]> {
    return this.seleccionar<ExcepcionFila>({
      columnas: COLUMNAS_DE_EXCEPCION,
      orden: 't.clave, t.usuario_id, t.id',
    });
  }

  /** Las que rigen para un usuario: las de su cuenta (`usuario_id` NULL) y las suyas. */
  deUsuarioYDeCuenta(usuarioId: string): Promise<ExcepcionFila[]> {
    return this.seleccionar<ExcepcionFila>({
      columnas: COLUMNAS_DE_EXCEPCION,
      donde: 't.usuario_id IS NULL OR t.usuario_id = ?',
      params: [usuarioId],
    });
  }

  buscarPorId(id: string): Promise<ExcepcionFila | null> {
    return this.seleccionarUna<ExcepcionFila>({
      columnas: COLUMNAS_DE_EXCEPCION,
      donde: 't.id = ?',
      params: [id],
    });
  }

  buscar(clave: string, usuarioId: string | null): Promise<ExcepcionFila | null> {
    return this.seleccionarUna<ExcepcionFila>({
      columnas: COLUMNAS_DE_EXCEPCION,
      donde:
        usuarioId === null
          ? 't.clave = ? AND t.usuario_id IS NULL'
          : 't.clave = ? AND t.usuario_id = ?',
      params: usuarioId === null ? [clave] : [clave, usuarioId],
    });
  }

  crear(tx: Transaccion, clave: string, usuarioId: string | null, valor: number): Promise<string> {
    return this.insertar(tx, { clave, usuario_id: usuarioId, valor });
  }

  cambiar(tx: Transaccion, id: string, valor: number): Promise<boolean> {
    return this.actualizar(tx, id, { valor });
  }

  quitar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
}

/** Qué pasó con un tope (columna `tipo` de `eventos_de_limite`). */
export type TipoDeEventoDeLimite =
  | 'qr.limite_diario'
  | 'qr.limite_pendientes'
  | 'qr.limite_propios_sin_uso'
  | 'qr.reemplazo_sin_uso'
  | 'bolsa.aviso'
  | 'bolsa.superada';

export interface NuevoEventoDeLimite {
  readonly usuarioId: string | null;
  readonly tipo: TipoDeEventoDeLimite;
  /** Cuánto llevaba al ocurrir. */
  readonly valor: number | null;
  /** El tope que regía. */
  readonly tope: number | null;
  /** Si no es `null`, el evento no se repite con la misma clave (una vez por evento y día). */
  readonly claveUnica: string | null;
  readonly ocurridoAt: Date;
}

interface ConteoFila extends RowDataPacket {
  total: number | string;
  ultimo: Date | null;
}

/** Dueño de `eventos_de_limite`: solo inserción, como `eventos_acceso` (no se edita ni se borra). */
export class RepositorioDeEventosDeLimite extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'eventos_de_limite',
      columnas: ['usuario_id', 'tipo', 'valor', 'tope', 'clave_unica', 'ocurrido_at'],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  registrar(tx: Transaccion, evento: NuevoEventoDeLimite): Promise<string> {
    return this.insertar(tx, {
      usuario_id: evento.usuarioId,
      tipo: evento.tipo,
      valor: evento.valor,
      tope: evento.tope,
      clave_unica: evento.claveUnica,
      ocurrido_at: evento.ocurridoAt,
    });
  }

  /**
   * Registra una marca que no se repite: `false` si ya estaba (misma cuenta y misma `clave_unica`). Un
   * choque contra el único no deshace la transacción: la sentencia falla sola y `tx` sigue viva.
   */
  async registrarUnica(tx: Transaccion, evento: NuevoEventoDeLimite): Promise<boolean> {
    try {
      await this.registrar(tx, evento);
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  }

  /** Cuántos eventos de ese tipo tuvo el usuario desde `desde`, y cuándo fue el último. */
  async resumirDeUsuario(
    usuarioId: string,
    tipo: TipoDeEventoDeLimite,
    desde: Date,
    tx?: Transaccion,
  ): Promise<{ total: number; ultimo: Date | null }> {
    const fila = await this.seleccionarUna<ConteoFila>(
      {
        columnas: 'COUNT(*) AS total, MAX(t.ocurrido_at) AS ultimo',
        donde: 't.usuario_id = ? AND t.tipo = ? AND t.ocurrido_at >= ?',
        params: [usuarioId, tipo, desde],
      },
      tx,
    );
    return { total: Number(fila?.total ?? 0), ultimo: fila?.ultimo ?? null };
  }
}

/** Un usuario con rechazos de generación repetidos, visto desde la plataforma. */
export interface RechazosRepetidosFila extends RowDataPacket {
  tenant_id: string;
  usuario_id: string;
  total: number | string;
  /** Los ids de los últimos rechazos (más nuevos primero), separados por coma. */
  ultimos_ids: string;
}

/**
 * Lee `eventos_de_limite` de TODAS las cuentas, solo para el detector de señales (ADR 0033 §4, W11): salto
 * explícito del aislamiento, de solo lectura. Cada hallazgo se procesa después DENTRO de su cuenta.
 */
export class RepositorioDeEventosDeLimiteDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'eventos_de_limite',
      columnas: [],
      perfil: 'solo_insercion',
      deCuenta: true,
    });
  }

  /**
   * Usuarios con al menos `minimo` rechazos por tope de generación desde `desde`. Los marcadores informativos
   * (reemplazos y bolsa) no son rechazos y no cuentan.
   */
  rechazosRepetidos(
    desde: Date,
    minimo: number,
    limite: number,
    despuesDe: { readonly cuentaId: string; readonly usuarioId: string } | null,
  ): Promise<RechazosRepetidosFila[]> {
    // Paginación por cursor sobre (cuenta, usuario): el detector recorre TODOS los hallazgos, página a página, sin que
    // los primeros (ya tratados) tapen a los demás.
    const cursor = despuesDe === null ? [] : [despuesDe.cuentaId, despuesDe.usuarioId];
    return this.seleccionar<RechazosRepetidosFila>({
      columnas:
        't.tenant_id, t.usuario_id, COUNT(*) AS total, ' +
        "SUBSTRING_INDEX(GROUP_CONCAT(t.id ORDER BY t.id DESC SEPARATOR ','), ',', 20) AS ultimos_ids",
      donde:
        "t.usuario_id IS NOT NULL AND t.ocurrido_at >= ? AND t.tipo IN ('qr.limite_diario', 'qr.limite_pendientes', 'qr.limite_propios_sin_uso')" +
        (despuesDe === null ? '' : ' AND (t.tenant_id, t.usuario_id) > (?, ?)'),
      // El último `?` es el del HAVING: la consulta junta los parámetros en el orden del texto.
      params: [desde, ...cursor, minimo],
      agrupar: 't.tenant_id, t.usuario_id HAVING COUNT(*) >= ?',
      orden: 't.tenant_id, t.usuario_id',
      limite,
    });
  }
}
