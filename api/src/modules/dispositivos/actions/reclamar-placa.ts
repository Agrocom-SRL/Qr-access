import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { LimitadorDeIntentos } from '../../../platform/seguridad/limitador-de-intentos.js';
import {
  hashear,
  verificarContraRelleno,
  verificarHash,
} from '../../../platform/seguridad/hash.js';
import { normalizarCodigo, normalizarMac } from '../domain/placa.js';
import { RepositorioDeDispositivosDePlataforma } from '../repository.js';
import { RepositorioDePlacas } from '../placas-repository.js';

export interface DatosDeReclamo {
  readonly mac: string;
  readonly codigo: string;
  /** La clave que sorteó la placa; el servidor solo guarda su hash (ADR 0025 §4). */
  readonly clave: string;
  readonly firmware: string;
  readonly ip: string;
}

export type ResultadoDeReclamo =
  | { readonly estado: 'pendiente' }
  | { readonly estado: 'vinculado'; readonly dispositivo_id: string };

export interface LimitadoresDeReclamo {
  readonly porIp: LimitadorDeIntentos;
  readonly porMac: LimitadorDeIntentos;
}

function rechazar(limitadores: LimitadoresDeReclamo, ip: string, mac: string): never {
  limitadores.porIp.registrarFallo(ip);
  limitadores.porMac.registrarFallo(mac);
  // Siempre lo mismo: no se revela si la MAC existe ni cuál dato falló.
  throw new ErrorDeDominio('dispositivo.reclamo_invalido', 401);
}

/**
 * La placa pregunta si ya tiene vínculo (ADR 0025 §5). Es la única ruta de dispositivo sin
 * credencial de dispositivo: se autentica con MAC + código de vinculación. Sin contexto de
 * cuenta (la placa aún no es de ninguna): revisar línea por línea (invariantes 1 y 5).
 *
 * - código válido y sin dispositivo en servicio → guarda el hash de la clave y responde `pendiente`;
 * - código válido y con dispositivo en servicio → responde `vinculado` solo si la clave coincide
 *   (idempotente: si la respuesta se perdió, se repite);
 * - todo lo demás → 401 igual, y cuenta como fallo del límite de intentos.
 */
export async function ejecutar(
  pool: Pool,
  limitadores: LimitadoresDeReclamo,
  datos: DatosDeReclamo,
  ahora: Date = new Date(),
): Promise<ResultadoDeReclamo> {
  const mac = normalizarMac(datos.mac) ?? '--';
  const espera = Math.max(
    limitadores.porIp.segundosDeBloqueo(datos.ip),
    limitadores.porMac.segundosDeBloqueo(mac),
  );
  if (espera > 0)
    throw new ErrorDeDominio('dispositivo.reclamo_bloqueado', 429, {
      reintentar_en_segundos: espera,
    });

  const placas = new RepositorioDePlacas(pool);
  const placa = mac === '--' ? null : await placas.buscarPorMac(mac);
  if (placa === null) {
    await verificarContraRelleno(datos.codigo);
    return rechazar(limitadores, datos.ip, mac);
  }
  if (!(await verificarHash(placa.codigo_hash, normalizarCodigo(datos.codigo)))) {
    return rechazar(limitadores, datos.ip, mac);
  }

  const dispositivo = await new RepositorioDeDispositivosDePlataforma(pool).buscarEnServicioDePlaca(
    placa.id,
  );
  const claveCoincide =
    placa.clave_hash !== null && (await verificarHash(placa.clave_hash, datos.clave));

  if (dispositivo !== null) {
    // Con vínculo, solo la placa que ya tiene esa clave se entera: otra clave no cambia nada.
    if (!claveCoincide) return rechazar(limitadores, datos.ip, mac);
    limitadores.porIp.registrarExito(datos.ip);
    limitadores.porMac.registrarExito(mac);
    return { estado: 'vinculado', dispositivo_id: dispositivo.id };
  }

  const claveHash = claveCoincide ? undefined : await hashear(datos.clave);
  await enTransaccion(pool, (tx) =>
    placas.registrarReclamo(tx, placa.id, {
      firmware: datos.firmware,
      ip: datos.ip,
      en: ahora,
      ...(claveHash === undefined ? {} : { claveHash }),
    }),
  );
  limitadores.porIp.registrarExito(datos.ip);
  limitadores.porMac.registrarExito(mac);
  return { estado: 'pendiente' };
}
