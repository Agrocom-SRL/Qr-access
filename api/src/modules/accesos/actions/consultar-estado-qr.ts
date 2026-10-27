import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import { tienePermiso } from '../../../plugins/permisos.js';
import { estadoDelQr, type EstadoDeQr } from '../domain/estado-qr.js';
import { puertasPorId } from '../presentacion.js';
import { RepositorioDeLecturas, RepositorioDeQr } from '../repository.js';

export interface EstadoDeQrConsultado {
  id: string;
  estado: EstadoDeQr;
  vence_at: string;
  /** El último intento de lectura sobre este QR; `null` si nadie lo ha acercado a un lector. */
  ultimo_intento: {
    ocurrido_at: string;
    resultado: 'permitido' | 'rechazado';
    motivo_code: string;
    puerta: { id: string; nombre: string };
  } | null;
}

/**
 * Qué pasó con un QR: su estado y el último intento de lectura (HU de seguimiento del QR). La
 * app lo consulta mientras muestra el QR para saber si la puerta lo aceptó o por qué lo rechazó.
 * Solo lee `qr_accesos` y `lecturas`; quien lo generó ve el suyo y quien tenga
 * `accesos.qr.ver_todos`, cualquiera de la cuenta. Uno ajeno o de otra cuenta no existe: 404.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  qrId: string,
  ahora: Date = new Date(),
): Promise<EstadoDeQrConsultado> {
  const qr = await new RepositorioDeQr(pool).buscarPorId(qrId);
  const esDeOtro = qr !== null && qr.generado_por !== principal.usuarioId;
  if (qr === null || (esDeOtro && !tienePermiso(principal, 'accesos.qr.ver_todos'))) {
    throw new ErrorDeDominio('qr.no_encontrado', 404);
  }

  const intento = await new RepositorioDeLecturas(pool).ultimoDeQr(qr.id);
  const puertas = intento === null ? null : await puertasPorId(pool, [intento.puerta_id]);
  return {
    id: qr.id,
    estado: estadoDelQr(
      { anuladoAt: qr.anulado_at, usadoAt: qr.usado_at, venceAt: qr.vence_at },
      ahora,
    ),
    vence_at: aIso(qr.vence_at),
    ultimo_intento:
      intento === null
        ? null
        : {
            ocurrido_at: aIso(intento.ocurrido_at),
            resultado: intento.resultado,
            motivo_code: intento.motivo_code,
            puerta: {
              id: intento.puerta_id,
              nombre: puertas?.get(intento.puerta_id)?.nombre ?? '',
            },
          },
  };
}
