import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { verificarHash } from '../../../platform/seguridad/hash.js';
import { huellaDeClave, normalizarMac } from '../domain/placa.js';
import { RepositorioDeAnuncios } from '../anuncios-repository.js';
import { RepositorioDePlacas } from '../placas-repository.js';
import { RepositorioDeDispositivosDePlataforma } from '../repository.js';
import { crearDispositivoDeLaSolicitud, esCandidatoDudoso } from '../solicitud-de-vinculo.js';
import {
  exigirSinBloqueo,
  rechazarAnuncio,
  type LimitadoresDeAnuncio,
  type ResultadoDeAnuncio,
} from './anunciar-placa.js';

export interface DatosDeConfirmacion {
  readonly mac: string;
  readonly clave: string;
  readonly ip: string;
}

/**
 * Confirmación explícita de una placa (ADR 0026 §4). Con el ADR 0037 el flujo normal ya no la
 * necesita —el anuncio vincula solo—, pero se conserva para las placas con firmware anterior, que
 * la llaman al recibir `confirmar`. Solo el candidato `(mac, clave)` que llega acá se vuelve
 * dispositivo. Ruta anónima: revisar línea por línea (invariantes 1 y 5).
 *
 * Es idempotente: si la placa ya tiene dispositivo con esa clave, repite `vinculado`.
 */
export async function ejecutar(
  pool: Pool,
  limitadores: LimitadoresDeAnuncio,
  datos: DatosDeConfirmacion,
  ahora: Date = new Date(),
): Promise<Extract<ResultadoDeAnuncio, { estado: 'vinculado' }>> {
  const mac = normalizarMac(datos.mac);
  if (mac === null) throw new ErrorDeDominio('placa.mac_invalida', 422);
  exigirSinBloqueo(limitadores, datos.ip, mac);

  const placa = await new RepositorioDePlacas(pool).buscarPorMac(mac);
  if (placa === null) return rechazarAnuncio(limitadores, datos.ip, mac);

  const dispositivoActual = await new RepositorioDeDispositivosDePlataforma(
    pool,
  ).buscarEnServicioDePlaca(placa.id);
  if (dispositivoActual !== null) {
    if (!(await verificarHash(dispositivoActual.claveHash, datos.clave))) {
      return rechazarAnuncio(limitadores, datos.ip, mac);
    }
    return { estado: 'vinculado', dispositivo_id: dispositivoActual.id };
  }

  const candidato = await new RepositorioDeAnuncios(pool).buscar(
    placa.id,
    huellaDeClave(datos.clave),
  );
  // Sin candidato (`undefined`) o ya descartado: no es la placa que se anunció.
  if (candidato?.descartada_at !== null) {
    return rechazarAnuncio(limitadores, datos.ip, mac);
  }

  let dispositivoId: string;
  try {
    dispositivoId = await crearDispositivoDeLaSolicitud(pool, placa, datos.clave, ahora);
  } catch (error) {
    // Dos claves activas para la misma MAC, o un candidato posterior a la solicitud: se trata como
    // un anuncio inválido (401 uniforme, cuenta contra los límites), sin decir cuál es la causa.
    if (esCandidatoDudoso(error)) return rechazarAnuncio(limitadores, datos.ip, mac);
    throw error;
  }
  limitadores.porIp.registrarExito(datos.ip);
  limitadores.porMac.registrarExito(mac);
  return { estado: 'vinculado', dispositivo_id: dispositivoId };
}
