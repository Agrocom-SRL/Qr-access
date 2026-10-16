import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalDispositivo } from '../../../platform/seguridad/principal.js';
import { sha256Hex } from '../../../platform/seguridad/tokens.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeUsuarios } from '../../seguridad/contracts.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import { extraerToken, hashDeToken } from '../domain/token-qr.js';
import {
  decidirAntesDeConsumir,
  motivoTrasConsumoFallido,
  MOTIVO_PERMITIDO,
  type MotivoDeRechazo,
} from '../domain/validacion.js';
import { RepositorioDePuertasDeQr, RepositorioDeEventos, RepositorioDeQr } from '../repository.js';

export type ResultadoDeValidacion =
  | { abrir: true; segundos: number; evento_id: string; motivo_code: typeof MOTIVO_PERMITIDO }
  | { abrir: false; evento_id: string; motivo_code: MotivoDeRechazo };

export interface LecturaDelDispositivo {
  /** Lo que leyó el lector, tal cual. */
  readonly texto: string;
  /** Hora que dice el reloj del dispositivo; solo informativa: la hora válida es la del servidor. */
  readonly leidoEn: Date | null;
}

/**
 * Validación de un QR en la puerta (ADR 0008 §4). Responde SIEMPRE con un resultado, nunca con
 * un error HTTP de negocio, y deja SIEMPRE un `eventos_acceso` (invariante 4). Solo abre con
 * `abrir: true` cuando el consumo atómico del paso 7 tuvo éxito; ante cualquier duda, rechaza.
 */
export async function ejecutar(
  pool: Pool,
  dispositivo: PrincipalDispositivo,
  lectura: LecturaDelDispositivo,
  ahora: Date = new Date(),
): Promise<ResultadoDeValidacion> {
  const [puerta] = await crearServicioDeOrganizacion(pool).buscarPuertas([dispositivo.puertaId]);
  // Un dispositivo sin puerta no puede registrar un evento ni abrir: falla segura.
  if (puerta === undefined) throw new ErrorDeDominio('puerta.no_encontrada', 404);

  const qrs = new RepositorioDeQr(pool);
  const eventos = new RepositorioDeEventos(pool);

  const rechazar = async (
    motivo: MotivoDeRechazo,
    tokenHash: string,
    qrId: string | null,
  ): Promise<ResultadoDeValidacion> => {
    const eventoId = await enTransaccion(pool, (tx) =>
      eventos.registrar(tx, {
        puertaId: dispositivo.puertaId,
        dispositivoId: dispositivo.dispositivoId,
        qrAccesoId: qrId,
        tokenHash,
        resultado: 'rechazado',
        motivoCode: motivo,
        ocurridoAt: ahora,
        leidoEnDispositivoAt: lectura.leidoEn,
      }),
    );
    return { abrir: false, evento_id: eventoId, motivo_code: motivo };
  };

  // 1. Formato. Lo ilegible se guarda como hash del texto, nunca el texto.
  const token = extraerToken(lectura.texto);
  if (token === null) return rechazar('qr.formato_invalido', sha256Hex(lectura.texto), null);

  // 2. Hash del token, buscado SOLO en la cuenta del dispositivo (el contexto la fija).
  const tokenHash = hashDeToken(token);
  const qr = await qrs.buscarPorHash(tokenHash);
  if (qr === null) return rechazar('qr.desconocido', tokenHash, null);

  // 3 a 6. Anulado, vencido, otra puerta, suscripción.
  const puertasDelQr =
    (await new RepositorioDePuertasDeQr(pool).puertasDe([qr.id])).get(qr.id) ?? [];
  const [emisorActivo, suscripcion] = await Promise.all([
    crearServicioDeUsuarios(pool).estaActivo(qr.emitido_por),
    crearServicioDeSuscripciones(pool).obtenerVigente(ahora),
  ]);
  const motivo = decidirAntesDeConsumir({
    qr: { anuladoAt: qr.anulado_at, venceAt: qr.vence_at, puertaIds: puertasDelQr, emisorActivo },
    puertaDelDispositivoId: dispositivo.puertaId,
    ahora,
    suscripcionVigente: suscripcion !== null,
  });
  if (motivo !== null) return rechazar(motivo, tokenHash, qr.id);

  // 7. Consumo atómico + evento "permitido" en la MISMA transacción: si el evento no queda,
  // el consumo se deshace y la puerta no abre.
  const eventoId = await enTransaccion(pool, async (tx) => {
    const consumido = await qrs.consumir(tx, qr.id, dispositivo.dispositivoId, ahora);
    if (!consumido) return null;
    return eventos.registrar(tx, {
      puertaId: dispositivo.puertaId,
      dispositivoId: dispositivo.dispositivoId,
      qrAccesoId: qr.id,
      tokenHash,
      resultado: 'permitido',
      motivoCode: MOTIVO_PERMITIDO,
      ocurridoAt: ahora,
      leidoEnDispositivoAt: lectura.leidoEn,
    });
  });
  if (eventoId !== null) {
    return {
      abrir: true,
      segundos: puerta.segundosApertura,
      evento_id: eventoId,
      motivo_code: MOTIVO_PERMITIDO,
    };
  }

  // Perdió la carrera (otro lector lo consumió) o cambió de estado entre los pasos: se relee.
  const actual = await qrs.buscarPorId(qr.id);
  const motivoFinal = motivoTrasConsumoFallido(
    actual === null
      ? null
      : { anuladoAt: actual.anulado_at, usadoAt: actual.usado_at, venceAt: actual.vence_at },
    ahora,
  );
  return rechazar(motivoFinal, tokenHash, qr.id);
}
