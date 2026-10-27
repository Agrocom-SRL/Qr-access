import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RepositorioDeCuenta } from '../../platform/db/repositorio-de-cuenta.js';
import { RepositorioDeFilasDePlataforma } from '../../platform/db/repositorio-de-fila-de-plataforma.js';
import { RepositorioDePlataforma } from '../../platform/db/repositorio-de-plataforma.js';
import type {
  Consulta,
  Ejecutor,
  OpcionesDeActualizacion,
} from '../../platform/db/repositorio-base.js';
import type { Transaccion } from '../../platform/db/transaccion.js';
import type { AvisoAgrupado, DatosDeAviso, Severidad, TipoDeNotificacion } from './domain/aviso.js';

const COLUMNAS_ESCRIBIBLES = [
  'cuenta_id',
  'destinatario_id',
  'tipo',
  'severidad',
  'sitio_id',
  'agrupacion_clave',
  'clave_unica',
  'abierta',
  'cantidad',
  'miembros',
  'datos',
  'novedad_at',
  'resuelta_at',
  'leida_at',
  'descartada_at',
] as const;

export interface NotificacionFila extends RowDataPacket {
  id: string;
  cuenta_id: string;
  destinatario_id: string;
  tipo: TipoDeNotificacion;
  severidad: Severidad;
  sitio_id: string | null;
  agrupacion_clave: string;
  abierta: number;
  cantidad: number;
  /** MariaDB guarda JSON como texto; llega como `string`. */
  miembros: string | string[];
  datos: string | object;
  novedad_at: Date;
  resuelta_at: Date | null;
  leida_at: Date | null;
  descartada_at: Date | null;
  created_at: Date;
}

const COLUMNAS_DE_LECTURA =
  't.id, t.cuenta_id, t.destinatario_id, t.tipo, t.severidad, t.sitio_id, t.agrupacion_clave, t.abierta, ' +
  't.cantidad, t.miembros, t.datos, t.novedad_at, t.resuelta_at, t.leida_at, t.descartada_at, t.created_at';

/** Un JSON de la base: texto en MariaDB, objeto si el motor ya lo decodificó. */
function analizar(valor: string | object): unknown {
  return typeof valor === 'string' ? JSON.parse(valor) : valor;
}

/** Los ids que alguna vez formaron parte del incidente. */
export function miembrosDe(fila: Pick<NotificacionFila, 'miembros'>): string[] {
  return (analizar(fila.miembros) as unknown[]).map(String);
}

/** El contenido del aviso, tal como se guardó (lo escribe esta misma API, con forma conocida). */
export function datosDe(fila: Pick<NotificacionFila, 'datos'>): DatosDeAviso {
  return analizar(fila.datos) as DatosDeAviso;
}

/** El aviso agrupado que el detector dejó en la cola. */
export function avisoDe(mensaje: Pick<MensajeDeCola, 'carga'>): AvisoAgrupado {
  return analizar(mensaje.carga) as AvisoAgrupado;
}

export interface FiltroDeBandeja {
  readonly soloNoLeidas: boolean;
  readonly tipo: TipoDeNotificacion | null;
  /** Solo las que hablan de esta cuenta (la bandeja de plataforma junta varias). */
  readonly cuentaId: string | null;
}

export interface NuevaNotificacion {
  readonly cuentaId: string;
  readonly destinatarioId: string;
  readonly tipo: TipoDeNotificacion;
  readonly severidad: Severidad;
  readonly sitioId: string | null;
  readonly agrupacionClave: string;
  readonly claveUnica: string | null;
  readonly abierta: boolean;
  readonly cantidad: number;
  readonly miembros: readonly string[];
  readonly datos: object;
  readonly novedadAt: Date;
}

/** Lo que una subclase le presta: el alcance (cuenta o plataforma) lo pone ella, no esta clase. */
export interface Primitivas {
  seleccionar<F extends RowDataPacket>(consulta: Consulta, ejecutor?: Ejecutor): Promise<F[]>;
  seleccionarUna<F extends RowDataPacket>(
    consulta: Consulta,
    ejecutor?: Ejecutor,
  ): Promise<F | null>;
  contar(consulta: Pick<Consulta, 'donde' | 'params'>, ejecutor?: Ejecutor): Promise<number>;
  insertar(tx: Transaccion, valores: Readonly<Record<string, unknown>>): Promise<string>;
  actualizar(
    tx: Transaccion,
    id: string,
    cambios: Readonly<Record<string, unknown>>,
    opciones?: OpcionesDeActualizacion,
  ): Promise<boolean>;
}

/**
 * Las consultas de la bandeja, escritas UNA vez. Sirven a las dos bandejas (la de una cuenta y la de AGROCOM)
 * porque el filtro de cuenta no está aquí: lo agrega la primitiva de la subclase que la construye
 * (`RepositorioDeCuenta` o `RepositorioDeFilasDePlataforma`), por construcción (invariante 1).
 */
export class OperacionesDeBandeja {
  constructor(private readonly p: Primitivas) {}

  private static donde(destinatarioId: string, filtro: FiltroDeBandeja) {
    const condiciones = ['t.destinatario_id = ?', 't.descartada_at IS NULL'];
    const params: unknown[] = [destinatarioId];
    if (filtro.soloNoLeidas) condiciones.push('t.leida_at IS NULL');
    if (filtro.tipo !== null) {
      condiciones.push('t.tipo = ?');
      params.push(filtro.tipo);
    }
    if (filtro.cuentaId !== null) {
      condiciones.push('t.cuenta_id = ?');
      params.push(filtro.cuentaId);
    }
    return { donde: condiciones.join(' AND '), params };
  }

  listar(
    destinatarioId: string,
    filtro: FiltroDeBandeja,
    limite: number,
    desplazamiento: number,
  ): Promise<NotificacionFila[]> {
    return this.p.seleccionar<NotificacionFila>({
      columnas: COLUMNAS_DE_LECTURA,
      ...OperacionesDeBandeja.donde(destinatarioId, filtro),
      orden: 't.novedad_at DESC, t.id DESC',
      limite,
      desplazamiento,
    });
  }

  contar(destinatarioId: string, filtro: FiltroDeBandeja): Promise<number> {
    return this.p.contar(OperacionesDeBandeja.donde(destinatarioId, filtro));
  }

  contarNoLeidas(destinatarioId: string): Promise<number> {
    return this.p.contar({
      donde: 't.destinatario_id = ? AND t.descartada_at IS NULL AND t.leida_at IS NULL',
      params: [destinatarioId],
    });
  }

  /** La notificación SI es del destinatario; la de otro es como si no existiera. */
  buscarDe(destinatarioId: string, id: string): Promise<NotificacionFila | null> {
    return this.p.seleccionarUna<NotificacionFila>({
      columnas: COLUMNAS_DE_LECTURA,
      donde: 't.id = ? AND t.destinatario_id = ?',
      params: [id, destinatarioId],
    });
  }

  async idsNoLeidas(destinatarioId: string, limite: number): Promise<string[]> {
    const filas = await this.p.seleccionar<RowDataPacket>({
      columnas: 't.id',
      donde: 't.destinatario_id = ? AND t.descartada_at IS NULL AND t.leida_at IS NULL',
      params: [destinatarioId],
      orden: 't.id',
      limite,
    });
    return filas.map((fila) => String(fila.id));
  }

  marcarLeida(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.p.actualizar(tx, id, { leida_at: ahora });
  }

  descartar(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.p.actualizar(tx, id, { descartada_at: ahora });
  }

  /** El incidente abierto del grupo, bloqueado hasta que termine `tx` (dos entregas no lo pisan). */
  buscarIncidenteAbierto(
    tx: Transaccion,
    destinatarioId: string,
    agrupacion: string,
  ): Promise<NotificacionFila | null> {
    return this.p.seleccionarUna<NotificacionFila>(
      {
        columnas: COLUMNAS_DE_LECTURA,
        donde: 't.destinatario_id = ? AND t.agrupacion_clave = ? AND t.abierta = 1',
        params: [destinatarioId, agrupacion],
        bloquear: true,
      },
      tx,
    );
  }

  /**
   * El incidente del grupo que se cerró hace poco (desde `desde`), bloqueado hasta que termine `tx`: si el grupo
   * vuelve a caer dentro del enfriamiento se reabre este en vez de crear otro. La constancia «recuperada» tiene
   * otra clave de grupo (`...:resuelta`), así que nunca se confunde con él.
   */
  buscarCerradoReciente(
    tx: Transaccion,
    destinatarioId: string,
    agrupacion: string,
    desde: Date,
  ): Promise<NotificacionFila | null> {
    return this.p.seleccionarUna<NotificacionFila>(
      {
        columnas: COLUMNAS_DE_LECTURA,
        donde:
          't.destinatario_id = ? AND t.agrupacion_clave = ? AND t.abierta = 0 AND t.resuelta_at >= ?',
        params: [destinatarioId, agrupacion, desde],
        orden: 't.resuelta_at DESC, t.id DESC',
        bloquear: true,
      },
      tx,
    );
  }

  /** Vuelve a abrir un incidente cerrado hace poco. Solo es noticia de nuevo si llegó alguien que no conocía. */
  reabrirIncidente(
    tx: Transaccion,
    id: string,
    cambio: {
      readonly cantidad: number;
      readonly miembros: readonly string[];
      readonly datos: object;
      readonly ahora: Date;
      readonly hayNovedad: boolean;
    },
  ): Promise<boolean> {
    return this.p.actualizar(tx, id, {
      abierta: 1,
      resuelta_at: null,
      cantidad: cambio.cantidad,
      miembros: JSON.stringify(cambio.miembros),
      datos: JSON.stringify(cambio.datos),
      ...(cambio.hayNovedad
        ? { novedad_at: cambio.ahora, leida_at: null, descartada_at: null }
        : {}),
    });
  }

  /** Los incidentes abiertos que hablan de esa cuenta, bloqueados hasta que termine `tx`. */
  async idsAbiertosDeLaCuenta(tx: Transaccion, cuentaId: string): Promise<string[]> {
    const filas = await this.p.seleccionar<RowDataPacket>(
      {
        columnas: 't.id',
        donde: 't.cuenta_id = ? AND t.abierta = 1',
        params: [cuentaId],
        bloquear: true,
      },
      tx,
    );
    return filas.map((fila) => String(fila.id));
  }

  existeClave(tx: Transaccion, destinatarioId: string, claveUnica: string): Promise<boolean> {
    return this.p
      .contar(
        {
          donde: 't.destinatario_id = ? AND t.clave_unica = ?',
          params: [destinatarioId, claveUnica],
        },
        tx,
      )
      .then((total) => total > 0);
  }

  crear(tx: Transaccion, nueva: NuevaNotificacion): Promise<string> {
    return this.p.insertar(tx, {
      cuenta_id: nueva.cuentaId,
      destinatario_id: nueva.destinatarioId,
      tipo: nueva.tipo,
      severidad: nueva.severidad,
      sitio_id: nueva.sitioId,
      agrupacion_clave: nueva.agrupacionClave,
      clave_unica: nueva.claveUnica,
      abierta: nueva.abierta ? 1 : 0,
      cantidad: nueva.cantidad,
      miembros: JSON.stringify(nueva.miembros),
      datos: JSON.stringify(nueva.datos),
      novedad_at: nueva.novedadAt,
    });
  }

  /** El incidente cambió de miembros. Si llegó alguien nuevo, vuelve a figurar como no leído y no descartado. */
  actualizarIncidente(
    tx: Transaccion,
    id: string,
    cambio: {
      readonly cantidad: number;
      readonly miembros: readonly string[];
      readonly datos: object;
      readonly ahora: Date;
      readonly hayNovedad: boolean;
    },
  ): Promise<boolean> {
    return this.p.actualizar(tx, id, {
      cantidad: cambio.cantidad,
      miembros: JSON.stringify(cambio.miembros),
      datos: JSON.stringify(cambio.datos),
      ...(cambio.hayNovedad
        ? { novedad_at: cambio.ahora, leida_at: null, descartada_at: null }
        : {}),
    });
  }

  cerrarIncidente(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.p.actualizar(tx, id, { abierta: 0, resuelta_at: ahora, novedad_at: ahora });
  }
}

const DESCRIPCION = {
  nombre: 'notificaciones',
  columnas: COLUMNAS_ESCRIBIBLES,
  perfil: 'dominio_sin_bitacora',
} as const;

function primitivas(r: {
  seleccionar: Primitivas['seleccionar'];
  seleccionarUna: Primitivas['seleccionarUna'];
  contar: Primitivas['contar'];
  insertar: Primitivas['insertar'];
  actualizar: Primitivas['actualizar'];
}): Primitivas {
  return r;
}

/** Bandeja de una cuenta (`tenant_id` = la cuenta del contexto): la del propietario. */
export class RepositorioDeNotificaciones extends RepositorioDeCuenta {
  readonly bandeja: OperacionesDeBandeja;

  constructor(pool: Pool) {
    super(pool, { ...DESCRIPCION, deCuenta: true });
    this.bandeja = new OperacionesDeBandeja(
      primitivas({
        seleccionar: (c, e) => this.seleccionar(c, e),
        seleccionarUna: (c, e) => this.seleccionarUna(c, e),
        contar: (c, e) => this.contar(c, e),
        insertar: (tx, v) => this.insertar(tx, v),
        actualizar: (tx, id, c, o) => this.actualizar(tx, id, c, o),
      }),
    );
  }

  /** Borra (soft delete) una notificación ya vieja, de la cuenta del contexto. */
  depurar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
}

/** Bandeja de AGROCOM (`tenant_id IS NULL`): las notificaciones del equipo, de cualquier cuenta. */
export class RepositorioDeNotificacionesDePlataforma extends RepositorioDeFilasDePlataforma {
  readonly bandeja: OperacionesDeBandeja;

  constructor(pool: Pool) {
    super(pool, { ...DESCRIPCION, deCuenta: false });
    this.bandeja = new OperacionesDeBandeja(
      primitivas({
        seleccionar: (c, e) => this.seleccionar(c, e),
        seleccionarUna: (c, e) => this.seleccionarUna(c, e),
        contar: (c, e) => this.contar(c, e),
        insertar: (tx, v) => this.insertar(tx, v),
        actualizar: (tx, id, c, o) => this.actualizar(tx, id, c, o),
      }),
    );
  }

  depurar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
}

export interface PendienteFila extends RowDataPacket {
  id: string;
  tenant_id: string;
  audiencia: 'cuenta' | 'plataforma';
  canal: 'app' | 'push' | 'correo';
  agrupacion_clave: string;
  proximo_intento_at: Date;
}

export interface MensajeDeCola extends RowDataPacket {
  id: string;
  audiencia: 'cuenta' | 'plataforma';
  canal: 'app' | 'push' | 'correo';
  agrupacion_clave: string;
  carga: string | object;
  estado: 'pendiente' | 'entregada' | 'fallida' | 'omitida';
  intentos: number;
}

export interface NuevoMensaje {
  readonly audiencia: 'cuenta' | 'plataforma';
  readonly canal: 'app' | 'push' | 'correo';
  readonly agrupacionClave: string;
  readonly carga: object;
  readonly proximoIntentoAt: Date;
  readonly claveUnica: string;
}

const DESCRIPCION_DE_COLA = {
  nombre: 'cola_de_notificaciones',
  columnas: [
    'audiencia',
    'canal',
    'agrupacion_clave',
    'carga',
    'estado',
    'intentos',
    'proximo_intento_at',
    'ultimo_error',
    'entregada_at',
    'clave_unica',
  ],
  perfil: 'dominio_sin_bitacora',
  deCuenta: true,
} as const;

/** El outbox de la cuenta del contexto: se encola y se entrega siempre dentro de una cuenta. */
export class RepositorioDeCola extends RepositorioDeCuenta {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_COLA);
  }

  /**
   * Encola un mensaje en la transacción de quien detectó el cambio. Repetir la misma `clave_unica` no duplica:
   * devuelve `false` si ya estaba.
   */
  async encolar(tx: Transaccion, mensaje: NuevoMensaje): Promise<boolean> {
    const yaEsta = await this.contar(
      { donde: 't.clave_unica = ?', params: [mensaje.claveUnica] },
      tx,
    );
    if (yaEsta > 0) return false;
    await this.insertar(tx, {
      audiencia: mensaje.audiencia,
      canal: mensaje.canal,
      agrupacion_clave: mensaje.agrupacionClave,
      carga: JSON.stringify(mensaje.carga),
      proximo_intento_at: mensaje.proximoIntentoAt,
      clave_unica: mensaje.claveUnica,
    });
    return true;
  }

  /** El mensaje, bloqueado hasta que termine `tx`: dos entregadores no lo procesan a la vez. */
  buscarBloqueando(tx: Transaccion, id: string): Promise<MensajeDeCola | null> {
    return this.seleccionarUna<MensajeDeCola>(
      {
        columnas: 't.id, t.audiencia, t.canal, t.agrupacion_clave, t.carga, t.estado, t.intentos',
        donde: 't.id = ?',
        params: [id],
        bloquear: true,
      },
      tx,
    );
  }

  /**
   * ¿Hay un mensaje PENDIENTE anterior (id menor) del mismo grupo y destino? Entonces este espera su turno: los
   * mensajes de un grupo se aplican en orden aunque haya varios entregadores. Se mira bajo la transacción del
   * mensaje, no con la lista leída antes.
   */
  async hayPendienteAnterior(tx: Transaccion, mensaje: MensajeDeCola): Promise<boolean> {
    return (
      (await this.contar(
        {
          donde:
            "t.agrupacion_clave = ? AND t.audiencia = ? AND t.canal = ? AND t.estado = 'pendiente' AND t.id < ?",
          params: [mensaje.agrupacion_clave, mensaje.audiencia, mensaje.canal, mensaje.id],
        },
        tx,
      )) > 0
    );
  }

  /** ¿Ya se entregó uno POSTERIOR del mismo grupo y destino? Entonces este es una fotografía vieja. */
  async hayEntregadoPosterior(tx: Transaccion, mensaje: MensajeDeCola): Promise<boolean> {
    return (
      (await this.contar(
        {
          donde:
            "t.agrupacion_clave = ? AND t.audiencia = ? AND t.canal = ? AND t.estado = 'entregada' AND t.id > ?",
          params: [mensaje.agrupacion_clave, mensaje.audiencia, mensaje.canal, mensaje.id],
        },
        tx,
      )) > 0
    );
  }

  /** Los mensajes de la cuenta del contexto que aún esperan entrega, bloqueados hasta que termine `tx`. */
  async idsPendientes(tx: Transaccion): Promise<string[]> {
    const filas = await this.seleccionar<RowDataPacket>(
      { columnas: 't.id', donde: "t.estado = 'pendiente'", bloquear: true },
      tx,
    );
    return filas.map((fila) => String(fila.id));
  }

  /** Devuelve un `fallida` a la cola (re-drive) con `intentos` ya casi agotados: un fallo más y vuelve a `fallida`. */
  reprogramar(
    tx: Transaccion,
    id: string,
    reprogramacion: { intentos: number; proximoIntentoAt: Date },
  ): Promise<boolean> {
    return this.actualizar(
      tx,
      id,
      {
        estado: 'pendiente',
        intentos: reprogramacion.intentos,
        proximo_intento_at: reprogramacion.proximoIntentoAt,
      },
      { cuando: { sql: "estado = 'fallida'" } },
    );
  }

  marcarEntregada(tx: Transaccion, id: string, ahora: Date): Promise<boolean> {
    return this.actualizar(tx, id, {
      estado: 'entregada',
      entregada_at: ahora,
      ultimo_error: null,
    });
  }

  marcarOmitida(tx: Transaccion, id: string, motivo: string): Promise<boolean> {
    return this.actualizar(tx, id, { estado: 'omitida', ultimo_error: motivo });
  }

  /** Anota un fallo: otro intento más tarde, o `fallida` si se agotaron. */
  registrarFallo(
    tx: Transaccion,
    id: string,
    fallo: { intentos: number; proximoIntentoAt: Date; agotado: boolean; codigo: string },
  ): Promise<boolean> {
    return this.actualizar(tx, id, {
      intentos: fallo.intentos,
      proximo_intento_at: fallo.proximoIntentoAt,
      ultimo_error: fallo.codigo,
      ...(fallo.agotado ? { estado: 'fallida' } : {}),
    });
  }

  depurar(tx: Transaccion, id: string): Promise<boolean> {
    return this.borrar(tx, id);
  }
}

/**
 * Lectura de la cola y de las bandejas de TODAS las cuentas, para el entregador y la depuración periódicos: no
 * hay una cuenta en contexto hasta que se sabe a cuál pertenece cada mensaje. Salto EXPLÍCITO del aislamiento,
 * solo lectura de identificadores; cada mensaje se procesa después dentro de su cuenta (`ejecutarEn`).
 */
export class RepositorioDeColaDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, DESCRIPCION_DE_COLA);
  }

  /** Pendientes que ya les toca (de todas las cuentas), en orden de id (el orden de los hechos). */
  pendientes(ahora: Date, limite: number): Promise<PendienteFila[]> {
    return this.seleccionar<PendienteFila>({
      columnas: 't.id, t.tenant_id, t.audiencia, t.canal, t.agrupacion_clave, t.proximo_intento_at',
      donde: "t.estado = 'pendiente' AND t.proximo_intento_at <= ?",
      params: [ahora],
      orden: 't.id',
      limite,
    });
  }

  /** Los `fallida` que ya esperaron lo suficiente (`actualizadasAntes`) y siguen siendo recientes (`creadasDesde`). */
  fallidasParaReintentar(
    actualizadasAntes: Date,
    creadasDesde: Date,
    limite: number,
  ): Promise<(RowDataPacket & { id: string; tenant_id: string })[]> {
    return this.seleccionar({
      columnas: 't.id, t.tenant_id',
      donde: "t.estado = 'fallida' AND t.updated_at < ? AND t.created_at >= ?",
      params: [actualizadasAntes, creadasDesde],
      orden: 't.id',
      limite,
    });
  }

  /** Mensajes ya resueltos (entregados, omitidos o fallidos) y viejos; usa `idx_cola_de_notificaciones_retencion`. */
  viejos(
    antes: Date,
    limite: number,
  ): Promise<(RowDataPacket & { id: string; tenant_id: string })[]> {
    return this.seleccionar({
      columnas: 't.id, t.tenant_id',
      donde: "t.estado IN ('entregada', 'omitida', 'fallida') AND t.updated_at < ?",
      params: [antes],
      orden: 't.id',
      limite,
    });
  }
}

/** Ídem para las notificaciones viejas ya resueltas o leídas: `tenant_id` NULL = bandeja de AGROCOM. */
export class RepositorioDeNotificacionesDeTodas extends RepositorioDePlataforma {
  constructor(pool: Pool) {
    super(pool, { ...DESCRIPCION, deCuenta: true });
  }

  viejas(
    antes: Date,
    limite: number,
  ): Promise<(RowDataPacket & { id: string; tenant_id: string | null })[]> {
    return this.seleccionar({
      columnas: 't.id, t.tenant_id',
      donde: 't.abierta = 0 AND t.novedad_at < ?',
      params: [antes],
      orden: 't.id',
      limite,
    });
  }
}
