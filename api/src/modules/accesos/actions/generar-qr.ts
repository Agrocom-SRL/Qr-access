import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import { generarTokenQr, hashDeToken, textoDeQr } from '../domain/token-qr.js';
import { vencimientoMaximo, vencimientoPorDefecto } from '../domain/vencimiento.js';
import { RepositorioDePuertasDeQr, RepositorioDeQr } from '../repository.js';

export interface DatosDeGeneracion {
  readonly puertaIds: readonly string[];
  /** Una vigencia hasta el máximo del plan; sin ella, el fin del día local. */
  readonly venceAt: Date | null;
  readonly etiqueta: string | null;
  /** Es el QR de "Mi QR de acceso": solo uno activo por usuario y fuera de "Mis QR". */
  readonly propio?: boolean;
}

export interface QrGenerado {
  id: string;
  /** El único momento en que existe el token en claro (ADR 0008): después solo queda su hash. */
  texto: string;
  vence_at: string;
  etiqueta: string | null;
  puertas: { id: string; nombre: string }[];
}

/**
 * Genera un QR de un solo uso para una o más puertas de la cuenta (HU-11). Rechaza si la
 * suscripción no está vigente, si alguna puerta no es de la cuenta o si la vigencia pedida
 * pasa el máximo (el límite del plan o, sin él, 7 días); sin vigencia pedida, vence al fin del día
 * local del sitio.
 *
 * Un restringido (él, un superior o su cuenta, ADR 0031 §0) no genera: `qr.generacion_restringida`.
 * Es lo primero que se mira; lo ya generado por él sigue abriendo hasta vencer.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  datos: DatosDeGeneracion,
  ahora: Date = new Date(),
): Promise<QrGenerado> {
  if (principal.estado !== 'activo') {
    throw new ErrorDeDominio('qr.generacion_restringida', 403, {
      origen: principal.origenDelEstado,
    });
  }
  const idsUnicos = [...new Set(datos.puertaIds)];
  const puertas = await crearServicioDeOrganizacion(pool).buscarPuertas(idsUnicos);
  const porId = new Map(puertas.map((puerta) => [puerta.id, puerta]));
  // Una puerta ajena, borrada o inactiva no existe para esta cuenta: 404.
  if (idsUnicos.some((id) => porId.get(id)?.activa !== true)) {
    throw new ErrorDeDominio('puerta.no_encontrada', 404);
  }

  const suscripcion = await crearServicioDeSuscripciones(pool).obtenerVigente(ahora);
  if (suscripcion === null) throw new ErrorDeDominio('suscripcion.vencida', 403);

  const limites = {
    ahora,
    zonasHorarias: puertas.map((puerta) => puerta.zonaHoraria),
    maxVigenciaHoras: suscripcion.maxVigenciaQrHoras,
  };
  const maximo = vencimientoMaximo(limites);
  if (datos.venceAt !== null && datos.venceAt <= ahora)
    throw new ErrorDeDominio('qr.vigencia_invalida', 422);
  if (datos.venceAt !== null && datos.venceAt > maximo) {
    throw new ErrorDeDominio('qr.vigencia_excedida', 422, { maximo: maximo.toISOString() });
  }
  const venceAt = datos.venceAt ?? vencimientoPorDefecto(limites);

  const token = generarTokenQr();
  const propio = datos.propio === true;
  const id = await enTransaccion(pool, async (tx) => {
    const repositorio = new RepositorioDeQr(pool);
    // El propio anterior se anula en la misma transacción que crea el nuevo: nunca hay dos
    // activos (y el UNIQUE `propio_activo` lo garantiza aunque dos generaciones corran a la vez).
    if (propio) await repositorio.anularPropiosActivos(tx, principal.usuarioId, ahora);
    const qrId = await repositorio.crear(tx, {
      generadoPor: principal.usuarioId,
      tokenHash: hashDeToken(token),
      etiqueta: datos.etiqueta,
      venceAt,
      propio,
    });
    await new RepositorioDePuertasDeQr(pool).asociar(tx, qrId, idsUnicos);
    return qrId;
  }).catch((error: unknown) => {
    // Dos generaciones propias simultáneas: la segunda choca con el UNIQUE y se reintenta.
    if (propio && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new ErrorDeDominio('qr.propio_en_curso', 409);
    }
    throw error;
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
