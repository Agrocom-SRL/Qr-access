import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion, type Transaccion } from '../../../platform/db/transaccion.js';
import { crearServicioDeDestinatarios } from '../../seguridad/contracts.js';
import {
  decidir,
  esperaTrasFallo,
  INTENTOS_MAXIMOS,
  PERMISO_DE_DESTINATARIO,
  type AvisoAgrupado,
} from '../domain/aviso.js';
import {
  avisoDe,
  datosDe,
  miembrosDe,
  OperacionesDeBandeja,
  RepositorioDeCola,
  RepositorioDeColaDeTodas,
  RepositorioDeNotificaciones,
  RepositorioDeNotificacionesDePlataforma,
  type MensajeDeCola,
} from '../repository.js';

/** Cuántos mensajes pendientes mira cada pasada. */
const LOTE = 200;

export interface ResultadoDeEntrega {
  readonly entregadas: number;
  /** Fallaron y quedaron para un próximo intento. */
  readonly reintentos: number;
  /** Agotaron sus intentos: quedan `fallida` para revisión. */
  readonly fallidas: number;
  /** Canales sin proveedor: se anotan `omitida`, no se pierden en silencio. */
  readonly omitidas: number;
}

/**
 * Aplica un aviso agrupado a la bandeja de UN destinatario (idempotente: repetirlo deja lo mismo).
 * - Sin incidente abierto y con miembros: abre UNA notificación con todas las placas del grupo.
 * - Con incidente abierto: lo actualiza (no crea otra); si llegó alguien nuevo vuelve a ser noticia.
 * - Sin miembros: cierra el incidente y, si el aviso lo pide, deja la constancia «recuperada».
 */
async function aplicarA(
  bandeja: OperacionesDeBandeja,
  tx: Transaccion,
  destinatarioId: string,
  aviso: AvisoAgrupado,
  ahora: Date,
): Promise<void> {
  const abierta = await bandeja.buscarIncidenteAbierto(tx, destinatarioId, aviso.agrupacion);
  const decision = decidir(
    abierta === null ? null : { id: abierta.id, miembros: miembrosDe(abierta) },
    aviso,
  );
  switch (decision.accion) {
    case 'abrir':
      await bandeja.crear(tx, {
        cuentaId: aviso.datos.cuenta.id,
        destinatarioId,
        tipo: aviso.tipo,
        severidad: aviso.severidad,
        sitioId: aviso.sitioId,
        agrupacionClave: aviso.agrupacion,
        claveUnica: null,
        abierta: true,
        cantidad: aviso.miembros.length,
        miembros: aviso.miembros,
        datos: aviso.datos,
        novedadAt: ahora,
      });
      return;
    case 'actualizar':
      if (abierta !== null) {
        await bandeja.actualizarIncidente(tx, abierta.id, {
          cantidad: aviso.miembros.length,
          miembros: decision.miembros,
          datos: aviso.datos,
          ahora,
          hayNovedad: decision.hayNovedad,
        });
      }
      return;
    case 'cerrar': {
      if (abierta === null) return;
      await bandeja.cerrarIncidente(tx, abierta.id, ahora);
      if (aviso.alResolver === null) return;
      // Una constancia por incidente: si el mensaje se repite, la clave la reconoce.
      const clave = `resuelta:${abierta.id}`;
      if (await bandeja.existeClave(tx, destinatarioId, clave)) return;
      await bandeja.crear(tx, {
        cuentaId: aviso.datos.cuenta.id,
        destinatarioId,
        tipo: aviso.alResolver.tipo,
        severidad: aviso.alResolver.severidad,
        sitioId: aviso.sitioId,
        agrupacionClave: `${aviso.agrupacion}:resuelta`,
        claveUnica: clave,
        abierta: false,
        cantidad: miembrosDe(abierta).length,
        miembros: miembrosDe(abierta),
        datos: datosDe(abierta),
        novedadAt: ahora,
      });
      return;
    }
    case 'nada':
      return;
  }
}

/** Entrega por el canal `app`: a cada destinatario de la audiencia, en la misma transacción. */
async function entregarPorApp(
  pool: Pool,
  tx: Transaccion,
  mensaje: MensajeDeCola,
  ahora: Date,
): Promise<void> {
  const aviso = avisoDe(mensaje);
  const destinatarios = crearServicioDeDestinatarios(pool);
  if (mensaje.audiencia === 'cuenta') {
    const ids = await destinatarios.deLaCuenta(PERMISO_DE_DESTINATARIO.cuenta);
    const bandeja = new RepositorioDeNotificaciones(pool).bandeja;
    for (const id of ids) await aplicarA(bandeja, tx, id, aviso, ahora);
    return;
  }
  const ids = await destinatarios.deLaPlataforma(PERMISO_DE_DESTINATARIO.plataforma);
  const bandeja = new RepositorioDeNotificacionesDePlataforma(pool).bandeja;
  for (const id of ids) await aplicarA(bandeja, tx, id, aviso, ahora);
}

type Resultado = 'entregada' | 'omitida' | 'nada';

/** Un mensaje, en su cuenta y en su propia transacción: o se aplica y se marca entregado, o nada. */
async function entregarUno(pool: Pool, id: string, ahora: Date): Promise<Resultado> {
  return enTransaccion(pool, async (tx) => {
    const cola = new RepositorioDeCola(pool);
    const mensaje = await cola.buscarBloqueando(tx, id);
    // Otro entregador ya lo resolvió mientras esperábamos el bloqueo.
    if (mensaje?.estado !== 'pendiente') return 'nada';
    if (mensaje.canal !== 'app') {
      await cola.marcarOmitida(tx, id, 'canal.sin_proveedor');
      return 'omitida';
    }
    await entregarPorApp(pool, tx, mensaje, ahora);
    await cola.marcarEntregada(tx, id, ahora);
    return 'entregada';
  });
}

/** Anota el fallo en una transacción aparte (la de la entrega ya se deshizo). */
async function anotarFallo(pool: Pool, id: string, error: unknown, ahora: Date): Promise<boolean> {
  return enTransaccion(pool, async (tx) => {
    const cola = new RepositorioDeCola(pool);
    const mensaje = await cola.buscarBloqueando(tx, id);
    if (mensaje?.estado !== 'pendiente') return false;
    const intentos = mensaje.intentos + 1;
    const agotado = intentos >= INTENTOS_MAXIMOS;
    // Solo el nombre del error: el texto podría traer datos de la consulta (ADR 0033).
    const codigo = (error instanceof Error ? error.name : 'desconocido').slice(0, 60);
    await cola.registrarFallo(tx, id, {
      intentos,
      agotado,
      codigo,
      proximoIntentoAt: new Date(ahora.getTime() + esperaTrasFallo(intentos) * 1000),
    });
    return agotado;
  });
}

/**
 * Entrega los avisos pendientes de la cola (outbox): at-least-once, con reintentos de espera creciente y un tope
 * de intentos. Los mensajes de un mismo grupo se aplican en orden: si uno falla o aún no toca, los siguientes
 * del grupo esperan, para que una fotografía vieja nunca pise a una más nueva. Corre cada pocos segundos
 * (`tareas.ts`); con el reloj inyectado se prueba sin esperar.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
): Promise<ResultadoDeEntrega> {
  const pendientes = await new RepositorioDeColaDeTodas(pool).pendientes(LOTE);
  const detenidos = new Set<string>();
  let entregadas = 0;
  let reintentos = 0;
  let fallidas = 0;
  let omitidas = 0;
  for (const pendiente of pendientes) {
    const grupo = `${pendiente.tenant_id}|${pendiente.agrupacion_clave}`;
    if (detenidos.has(grupo)) continue;
    if (pendiente.proximo_intento_at > ahora) {
      detenidos.add(grupo);
      continue;
    }
    try {
      const resultado = await ContextoCuenta.ejecutarEn(pendiente.tenant_id, () =>
        entregarUno(pool, pendiente.id, ahora),
      );
      if (resultado === 'entregada') entregadas += 1;
      if (resultado === 'omitida') omitidas += 1;
    } catch (error) {
      registrarError(error);
      detenidos.add(grupo);
      const agotado = await ContextoCuenta.ejecutarEn(pendiente.tenant_id, () =>
        anotarFallo(pool, pendiente.id, error, ahora),
      );
      if (agotado) {
        fallidas += 1;
        // Agotado: deja de frenar a los siguientes de su grupo.
        detenidos.delete(grupo);
      } else {
        reintentos += 1;
      }
    }
  }
  return { entregadas, reintentos, fallidas, omitidas };
}
