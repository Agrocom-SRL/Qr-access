import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import type { EstadoDeOrden } from './domain/apertura-manual.js';

export interface OrdenFila extends RowDataPacket {
  id: string;
  puerta_id: string;
  dispositivo_id: string | null;
  usuario_id: string;
  lectura_id: string;
  estado: EstadoDeOrden;
  vence_at: Date;
  entregada_at: Date | null;
  resuelta_at: Date | null;
  clave_idempotencia: string | null;
  created_at: Date;
}

const COLUMNAS =
  't.id, t.puerta_id, t.dispositivo_id, t.usuario_id, t.lectura_id, t.estado, t.vence_at, t.entregada_at, ' +
  't.resuelta_at, t.clave_idempotencia, t.created_at';

export interface NuevaOrden {
  readonly puertaId: string;
  readonly usuarioId: string;
  /** La lectura `permitido` / `manual.ordenada` que registra la petición (misma transacción). */
  readonly lecturaId: string;
  /** HMAC de la `Idempotency-Key` de la app (nunca la clave en claro). */
  readonly claveIdempotencia: string;
  readonly creadaAt: Date;
  /** `creadaAt` + 15 s; la tabla rechaza más de 30 s (`ck_ordenes_apertura_vence`). */
  readonly venceAt: Date;
}

/**
 * Dueño de `ordenes_apertura` (ADR 0035 §3, ficha 38). A diferencia de `lecturas`, la orden CAMBIA de estado
 * (`pendiente` → `entregada` → `ejecutada`/`fallida`, o `vencida`), por eso es una tabla `transitoria`: sin soft
 * delete ni bitácora (el hecho queda en `lecturas` y el resultado en `confirmaciones_apertura`). Toda
 * transición es un compare-and-set sobre `estado` (y sobre el plazo cuando importa): una orden se entrega una sola
 * vez a una sola placa, igual que un QR se consume una sola vez (invariante 3 por analogía). Nada acá bloquea la
 * fila de `dispositivos` (ADR 0032 §1). Toda consulta lleva la cuenta del contexto (invariante 1).
 *
 * Lo usan la app (crear y consultar) y la placa (entregar, resolver); el barrido que vence las órdenes
 * de TODAS las cuentas es de plataforma y vive aparte.
 */
export class RepositorioDeOrdenesDeApertura extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'ordenes_apertura',
      columnas: [
        'puerta_id',
        'dispositivo_id',
        'usuario_id',
        'lectura_id',
        'estado',
        'vence_at',
        'entregada_at',
        'resuelta_at',
        'clave_idempotencia',
        'created_at',
        'created_by',
      ],
      perfil: 'transitoria',
      deCuenta: true,
    });
  }

  /**
   * Crea la orden `pendiente`. Falla con `ER_DUP_ENTRY` en `uq_ordenes_apertura_vigente` si la puerta ya tiene
   * una orden viva (no se acumulan pulsos) y en `uq_ordenes_apertura_clave` si la clave ya se usó.
   */
  crear(tx: Transaccion, orden: NuevaOrden): Promise<string> {
    return this.insertar(tx, {
      puerta_id: orden.puertaId,
      usuario_id: orden.usuarioId,
      lectura_id: orden.lecturaId,
      estado: 'pendiente',
      vence_at: orden.venceAt,
      clave_idempotencia: orden.claveIdempotencia,
      created_at: orden.creadaAt,
      created_by: orden.usuarioId,
    });
  }

  buscarPorId(id: string, tx?: Transaccion): Promise<OrdenFila | null> {
    return this.seleccionarUna<OrdenFila>(
      { columnas: COLUMNAS, donde: 't.id = ?', params: [id] },
      tx,
    );
  }

  /** La orden de ESE usuario; la de otro (o de otra cuenta) no vuelve: es lo que consulta la app. */
  buscarDelUsuario(id: string, usuarioId: string): Promise<OrdenFila | null> {
    return this.seleccionarUna<OrdenFila>({
      columnas: COLUMNAS,
      donde: 't.id = ? AND t.usuario_id = ?',
      params: [id, usuarioId],
    });
  }

  /** La orden que ese usuario ya creó con esa clave de idempotencia (ya hasheada), o `null`. */
  buscarPorClave(
    usuarioId: string,
    claveHash: string,
    tx?: Transaccion,
  ): Promise<OrdenFila | null> {
    return this.seleccionarUna<OrdenFila>(
      {
        columnas: COLUMNAS,
        donde: 't.usuario_id = ? AND t.clave_idempotencia = ?',
        params: [usuarioId, claveHash],
      },
      tx,
    );
  }

  /**
   * La orden viva (`pendiente` o `entregada`) de la puerta, vencida o no (`uq_ordenes_apertura_vigente` admite
   * una sola). Con `bloquear`, dentro de `tx`, la fila queda bloqueada hasta el fin de la transacción.
   */
  buscarVivaDeLaPuerta(
    puertaId: string,
    tx?: Transaccion,
    bloquear = false,
  ): Promise<OrdenFila | null> {
    return this.seleccionarUna<OrdenFila>(
      {
        columnas: COLUMNAS,
        donde: "t.puerta_id = ? AND t.estado IN ('pendiente', 'entregada')",
        params: [puertaId],
        bloquear,
      },
      tx,
    );
  }

  /**
   * Lo que una placa de la puerta puede tomar ahora: la orden `pendiente` y todavía vigente. Solo lectura: tomar
   * la orden es `entregar`, que la reserva de forma atómica.
   */
  buscarEntregableDeLaPuerta(puertaId: string, ahora: Date): Promise<OrdenFila | null> {
    return this.seleccionarUna<OrdenFila>({
      columnas: COLUMNAS,
      donde: "t.puerta_id = ? AND t.estado = 'pendiente' AND t.vence_at > ?",
      params: [puertaId, ahora],
      orden: 't.id',
    });
  }

  /** Cuándo creó el usuario su última orden sobre la puerta (para el enfriamiento), o `null`. */
  async ultimaCreadaDe(usuarioId: string, puertaId: string, tx: Transaccion): Promise<Date | null> {
    const fila = await this.seleccionarUna<RowDataPacket & { creada: Date }>(
      {
        columnas: 't.created_at AS creada',
        donde: 't.usuario_id = ? AND t.puerta_id = ?',
        params: [usuarioId, puertaId],
        orden: 't.created_at DESC, t.id DESC',
      },
      tx,
    );
    return fila?.creada ?? null;
  }

  /** Cuántas órdenes creó el usuario desde `desde` (inicio del día local del sitio), para el tope diario. */
  contarDesde(usuarioId: string, desde: Date, tx: Transaccion): Promise<number> {
    return this.contar(
      { donde: 't.usuario_id = ? AND t.created_at >= ?', params: [usuarioId, desde] },
      tx,
    );
  }

  /**
   * Entrega atómica a una placa: `pendiente` y vigente pasa a `entregada` con la placa que la tomó, UNA sola vez.
   * `true` solo para quien la ganó; una orden ya entregada, vencida, resuelta o de otra puerta/cuenta devuelve
   * `false`. Quien llama (la ruta de la placa) debe haber comprobado que `puertaId` es la de la placa: la orden
   * es de la puerta, no de una placa (ADR 0035 §3).
   */
  entregar(
    tx: Transaccion,
    id: string,
    puertaId: string,
    dispositivoId: string,
    ahora: Date,
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { estado: 'entregada', dispositivo_id: dispositivoId, entregada_at: ahora },
      {
        cuando: {
          sql: "estado = 'pendiente' AND vence_at > ? AND puerta_id = ?",
          params: [ahora, puertaId],
        },
      },
    );
  }

  /**
   * La placa que la tomó informa cómo terminó: `entregada` pasa a `ejecutada` o `fallida`, una sola vez y solo
   * desde ESA placa. `false` si la orden no está entregada a `dispositivoId` (otra placa, ya resuelta, vencida).
   * No exige que el plazo no haya corrido: la placa pudo ejecutar justo a tiempo y la respuesta tardó.
   */
  resolver(
    tx: Transaccion,
    id: string,
    dispositivoId: string,
    estado: 'ejecutada' | 'fallida',
    ahora: Date,
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { estado, resuelta_at: ahora },
      { cuando: { sql: "estado = 'entregada' AND dispositivo_id = ?", params: [dispositivoId] } },
    );
  }

  /**
   * Marca `vencida` una orden viva cuyo plazo ya pasó: una `pendiente` con `vence_at <= ahora` (nadie la tomó) o una
   * `entregada` con `vence_at + gracia <= ahora` (la placa que la tomó tuvo la gracia para informar; ver
   * `GRACIA_DE_RESULTADO_MS`). Con `graciaDeEntregadaMs = 0` (por omisión) una entregada vence junto con su plazo.
   * `false` si ya no está viva o todavía está dentro de su plazo. No escribe `confirmaciones_apertura`: eso lo
   * decide quien llama.
   */
  vencer(tx: Transaccion, id: string, ahora: Date, graciaDeEntregadaMs = 0): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      { estado: 'vencida', resuelta_at: ahora },
      {
        cuando: {
          sql: "(estado = 'pendiente' AND vence_at <= ?) OR (estado = 'entregada' AND vence_at <= ?)",
          params: [ahora, new Date(ahora.getTime() - graciaDeEntregadaMs)],
        },
      },
    );
  }

  /**
   * Las órdenes vivas de la cuenta del contexto que ya se pueden dar por vencidas (mismo criterio que `vencer`), las
   * más viejas primero y a lo sumo `limite`. Lectura sin bloqueo: `vencer` decide con compare-and-set.
   */
  listarParaVencer(ahora: Date, graciaDeEntregadaMs: number, limite: number): Promise<OrdenFila[]> {
    return this.seleccionar<OrdenFila>({
      columnas: COLUMNAS,
      donde:
        "(t.estado = 'pendiente' AND t.vence_at <= ?) OR (t.estado = 'entregada' AND t.vence_at <= ?)",
      params: [ahora, new Date(ahora.getTime() - graciaDeEntregadaMs)],
      orden: 't.vence_at, t.id',
      limite,
    });
  }
}

/**
 * Las órdenes de apertura de TODAS las cuentas, solo para el barrido periódico que las vence. Salto EXPLÍCITO del
 * aislamiento por cuenta (invariante 1), acotado a una sola lectura: devuelve QUÉ cuentas tienen órdenes por vencer,
 * nunca las filas. Cada escritura posterior corre dentro del contexto de ESA cuenta, con el repositorio de cuenta.
 */
export class RepositorioDeOrdenesDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, {
      nombre: 'ordenes_apertura',
      columnas: [],
      perfil: 'transitoria',
      deCuenta: true,
    });
  }

  /** Ids de las cuentas con alguna orden viva que ya se puede dar por vencida (usa `idx_ordenes_apertura_vencimiento`). */
  async cuentasConOrdenesPorVencer(ahora: Date, graciaDeEntregadaMs: number): Promise<string[]> {
    const filas = await this.seleccionar<RowDataPacket>({
      columnas: 'DISTINCT t.tenant_id',
      donde:
        "(t.estado = 'pendiente' AND t.vence_at <= ?) OR (t.estado = 'entregada' AND t.vence_at <= ?)",
      params: [ahora, new Date(ahora.getTime() - graciaDeEntregadaMs)],
      orden: 't.tenant_id',
    });
    return filas.map((fila) => String(fila.tenant_id));
  }
}
