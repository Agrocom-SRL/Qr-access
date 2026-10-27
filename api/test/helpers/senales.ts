import { randomBytes } from 'node:crypto';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { crearQr, type Cuenta, type QrDePrueba } from './fixtures.js';

/**
 * Datos de las señales de abuso escritos directo con SQL (no con la API ni los detectores): así un defecto del detector
 * no puede esconderse en el armado del escenario.
 */

/** Un QR propio YA USADO (por eso puede haber varios por usuario: solo uno propio sin usar cabe a la vez). */
export async function qrPropio(
  pool: Pool,
  cuenta: Cuenta,
  generadorId: string,
  puertaIds: readonly string[],
  usadoAt: Date,
): Promise<QrDePrueba> {
  const qr = await crearQr(pool, cuenta, generadorId, puertaIds, { usadoAt });
  await pool.query('UPDATE qr_accesos SET es_propio = 1 WHERE id = ?', [qr.id]);
  return qr;
}

export interface EventoDePrueba {
  readonly puertaId: string;
  readonly dispositivoId: string | null;
  readonly qrId?: string | null;
  readonly resultado?: 'permitido' | 'rechazado';
  readonly motivo?: string;
  readonly metodo?: 'qr' | 'pulsador';
  readonly cuando: Date;
  /** Id del intento original: esta fila es una repetición dentro de la ventana (ADR 0032, ola W7). */
  readonly repetidoDeId?: string | null;
}

/** Un intento de acceso escrito directo; por omisión, una apertura permitida por QR. */
export async function evento(pool: Pool, cuenta: Cuenta, datos: EventoDePrueba): Promise<string> {
  const resultado = datos.resultado ?? 'permitido';
  const [cabecera] = await pool.query<ResultSetHeader>(
    'INSERT INTO eventos_acceso (tenant_id, puerta_id, dispositivo_id, qr_acceso_id, metodo, resultado, motivo_code, ocurrido_at, repetido_de_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      cuenta.id,
      datos.puertaId,
      datos.dispositivoId,
      datos.qrId ?? null,
      datos.metodo ?? 'qr',
      resultado,
      datos.motivo ?? (resultado === 'permitido' ? 'acceso.permitido' : 'qr.usado'),
      datos.cuando,
      datos.repetidoDeId ?? null,
    ],
  );
  return String(cabecera.insertId);
}

/**
 * Una repetición del intento `originalId` (ADR 0032 §3 y §4): el mismo lector, el mismo QR y el mismo resultado,
 * `segundos` después, enlazada con `repetido_de_id`.
 */
export async function repeticionDe(
  pool: Pool,
  cuenta: Cuenta,
  original: EventoDePrueba & { readonly id: string },
  segundos: number,
): Promise<string> {
  return evento(pool, cuenta, {
    ...original,
    cuando: new Date(original.cuando.getTime() + segundos * 1000),
    repetidoDeId: original.id,
  });
}

/** `n` aperturas con QR propios distintos del usuario, uno por minuto hacia atrás desde `hasta`. */
export async function aperturasPropias(
  pool: Pool,
  cuenta: Cuenta,
  generadorId: string,
  puerta: { id: string },
  dispositivoId: string,
  n: number,
  hasta: Date,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const cuando = new Date(hasta.getTime() - i * 60_000);
    const qr = await qrPropio(pool, cuenta, generadorId, [puerta.id], cuando);
    ids.push(
      await evento(pool, cuenta, { puertaId: puerta.id, dispositivoId, qrId: qr.id, cuando }),
    );
  }
  return ids;
}

/** Una sesión escrita directo, con la IP y la última actividad (`updated_at`) que se pidan. */
export async function sesion(
  pool: Pool,
  cuenta: Cuenta,
  usuarioId: string,
  datos: { ip: string; actividad: Date; expira: Date; revocada?: Date; instalacion?: string },
): Promise<void> {
  await pool.query(
    'INSERT INTO sesiones (tenant_id, usuario_id, refresh_hash, ip, instalacion_id, expira_at, revocada_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      cuenta.id,
      usuarioId,
      randomBytes(32).toString('hex'),
      datos.ip,
      datos.instalacion ?? null,
      datos.expira,
      datos.revocada ?? null,
      datos.actividad,
      datos.actividad,
    ],
  );
}

/** Una marca de la bolsa tal como la deja la generación de QR. */
export async function marcaDeBolsa(
  pool: Pool,
  cuenta: Cuenta,
  usuarioId: string,
  datos: {
    tipo: 'bolsa.aviso' | 'bolsa.superada';
    claveUnica: string;
    cuando: Date;
    valor: number;
    tope: number;
  },
): Promise<string> {
  const [cabecera] = await pool.query<ResultSetHeader>(
    'INSERT INTO eventos_de_limite (tenant_id, usuario_id, tipo, valor, tope, clave_unica, ocurrido_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [cuenta.id, usuarioId, datos.tipo, datos.valor, datos.tope, datos.claveUnica, datos.cuando],
  );
  return String(cabecera.insertId);
}
