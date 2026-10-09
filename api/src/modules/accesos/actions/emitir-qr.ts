import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import { generarTokenQr, hashDeToken, textoDeQr } from '../domain/token-qr.js';
import { vencimientoMaximo } from '../domain/vencimiento.js';
import { RepositorioDePuertasDeQr, RepositorioDeQr } from '../repository.js';

export interface DatosDeEmision {
  readonly puertaIds: readonly string[];
  /** Una vigencia menor que la permitida; sin ella, el máximo (fin del día local). */
  readonly venceAt: Date | null;
  readonly etiqueta: string | null;
}

export interface QrEmitido {
  id: string;
  /** El único momento en que existe el token en claro (ADR 0008): después solo queda su hash. */
  texto: string;
  vence_at: string;
  etiqueta: string | null;
  puertas: { id: string; nombre: string }[];
}

/**
 * Emite un QR de un solo uso para una o más puertas de la cuenta (HU-11). Rechaza si la
 * suscripción no está vigente, si alguna puerta no es de la cuenta o si la vigencia pedida
 * pasa el máximo (fin del día local del sitio, o el límite del plan).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  datos: DatosDeEmision,
  ahora: Date = new Date(),
): Promise<QrEmitido> {
  const idsUnicos = [...new Set(datos.puertaIds)];
  const puertas = await crearServicioDeOrganizacion(pool).buscarPuertas(idsUnicos);
  const porId = new Map(puertas.map((puerta) => [puerta.id, puerta]));
  // Una puerta ajena, borrada o inactiva no existe para esta cuenta: 404.
  if (idsUnicos.some((id) => porId.get(id)?.activa !== true)) {
    throw new ErrorDeDominio('puerta.no_encontrada', 404);
  }

  const suscripcion = await crearServicioDeSuscripciones(pool).obtenerVigente(ahora);
  if (suscripcion === null) throw new ErrorDeDominio('suscripcion.vencida', 403);

  const maximo = vencimientoMaximo({
    ahora,
    zonasHorarias: puertas.map((puerta) => puerta.zonaHoraria),
    maxVigenciaHoras: suscripcion.maxVigenciaQrHoras,
  });
  if (datos.venceAt !== null && datos.venceAt <= ahora)
    throw new ErrorDeDominio('qr.vigencia_invalida', 422);
  if (datos.venceAt !== null && datos.venceAt > maximo) {
    throw new ErrorDeDominio('qr.vigencia_excedida', 422, { maximo: maximo.toISOString() });
  }
  const venceAt = datos.venceAt ?? maximo;

  const token = generarTokenQr();
  const id = await enTransaccion(pool, async (tx) => {
    const qrId = await new RepositorioDeQr(pool).crear(tx, {
      emitidoPor: principal.usuarioId,
      tokenHash: hashDeToken(token),
      etiqueta: datos.etiqueta,
      venceAt,
    });
    await new RepositorioDePuertasDeQr(pool).asociar(tx, qrId, idsUnicos);
    return qrId;
  });

  return {
    id,
    texto: textoDeQr(token),
    vence_at: aIso(venceAt),
    etiqueta: datos.etiqueta,
    puertas: idsUnicos.map((puertaId) => ({
      id: puertaId,
      nombre: porId.get(puertaId)?.nombre ?? '',
    })),
  };
}
