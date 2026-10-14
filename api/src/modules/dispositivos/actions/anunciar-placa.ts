import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { verificarHash } from '../../../platform/seguridad/hash.js';
import type { LimitadorDeIntentos } from '../../../platform/seguridad/limitador-de-intentos.js';
import { huellaDeClave, normalizarMac } from '../domain/placa.js';
import { MAXIMO_DE_CANDIDATOS, RepositorioDeAnuncios } from '../anuncios-repository.js';
import { RepositorioDePlacas } from '../placas-repository.js';
import { RepositorioDeDispositivosDePlataforma } from '../repository.js';
import { esDuplicado } from '../vinculo.js';

export interface DatosDeAnuncio {
  readonly mac: string;
  /** La clave que sorteó la placa; hasta confirmarse, el servidor solo guarda su huella. */
  readonly clave: string;
  readonly firmware: string;
  readonly ip: string;
}

export type ResultadoDeAnuncio =
  | { readonly estado: 'detectada' }
  | { readonly estado: 'confirmar' }
  | { readonly estado: 'vinculado'; readonly dispositivo_id: string };

export interface LimitadoresDeAnuncio {
  readonly porIp: LimitadorDeIntentos;
  readonly porMac: LimitadorDeIntentos;
  /** Cuenta las placas nuevas que crea una IP: el inventario lo llena un anuncio anónimo. */
  readonly nuevasPorIp: LimitadorDeIntentos;
}

export function rechazarAnuncio(
  limitadores: Pick<LimitadoresDeAnuncio, 'porIp' | 'porMac'>,
  ip: string,
  mac: string,
): never {
  limitadores.porIp.registrarFallo(ip);
  limitadores.porMac.registrarFallo(mac);
  // Siempre lo mismo: no se revela si la MAC tiene dispositivo ni cuál dato falló.
  throw new ErrorDeDominio('dispositivo.anuncio_invalido', 401);
}

export function exigirSinBloqueo(
  limitadores: Pick<LimitadoresDeAnuncio, 'porIp' | 'porMac'>,
  ip: string,
  mac: string,
): void {
  const espera = Math.max(
    limitadores.porIp.segundosDeBloqueo(ip),
    limitadores.porMac.segundosDeBloqueo(mac),
  );
  if (espera > 0)
    throw new ErrorDeDominio('dispositivo.anuncio_bloqueado', 429, {
      reintentar_en_segundos: espera,
    });
}

/**
 * La placa dice quién es cada 30 s mientras no tenga vínculo (ADR 0026 §2). Ruta anónima: no
 * hay credencial que revisar, así que no puede dar nada que no sea público ni abrir nada
 * (invariante 2); sin contexto de cuenta, se revisa línea por línea (invariantes 1 y 5).
 *
 * - MAC nueva → se registra como placa `detectada`;
 * - placa con dispositivo en servicio → responde `vinculado` solo si la clave es la de ese
 *   dispositivo (idempotente: si la respuesta se perdió, se repite); otra clave es 401;
 * - placa sin dispositivo → registra la clave como candidato y responde `confirmar` si el
 *   super admin pidió vincularla y la ventana sigue abierta, o `detectada`.
 */
export async function ejecutar(
  pool: Pool,
  limitadores: LimitadoresDeAnuncio,
  datos: DatosDeAnuncio,
  ahora: Date = new Date(),
): Promise<ResultadoDeAnuncio> {
  const mac = normalizarMac(datos.mac);
  if (mac === null) throw new ErrorDeDominio('placa.mac_invalida', 422);
  exigirSinBloqueo(limitadores, datos.ip, mac);

  const placas = new RepositorioDePlacas(pool);
  let placa = await placas.buscarPorMac(mac);
  if (placa === null) {
    if (limitadores.nuevasPorIp.segundosDeBloqueo(datos.ip) > 0) {
      throw new ErrorDeDominio('dispositivo.anuncio_bloqueado', 429, {
        reintentar_en_segundos: limitadores.nuevasPorIp.segundosDeBloqueo(datos.ip),
      });
    }
    limitadores.nuevasPorIp.registrarFallo(datos.ip);
    try {
      await enTransaccion(pool, (tx) =>
        placas.crear(tx, { mac, firmware: datos.firmware, ip: datos.ip, en: ahora }),
      );
    } catch (error) {
      // Otro anuncio de la misma MAC llegó entre la consulta y el INSERT: ya existe.
      if (!esDuplicado(error)) throw error;
    }
    placa = await placas.buscarPorMac(mac);
    if (placa === null) throw new ErrorDeDominio('dispositivo.anuncio_invalido', 401);
  }

  const dispositivo = await new RepositorioDeDispositivosDePlataforma(pool).buscarEnServicioDePlaca(
    placa.id,
  );
  if (dispositivo !== null) {
    // Con vínculo, solo la placa que ya tiene esa clave se entera: otra clave no cambia nada.
    if (!(await verificarHash(dispositivo.claveHash, datos.clave))) {
      return rechazarAnuncio(limitadores, datos.ip, mac);
    }
    limitadores.porIp.registrarExito(datos.ip);
    limitadores.porMac.registrarExito(mac);
    return { estado: 'vinculado', dispositivo_id: dispositivo.id };
  }

  const anuncios = new RepositorioDeAnuncios(pool);
  const huella = huellaDeClave(datos.clave);
  const candidato = await anuncios.buscar(placa.id, huella);
  if (candidato?.descartada_at != null) return rechazarAnuncio(limitadores, datos.ip, mac);
  if (candidato === null && (await anuncios.contarVivos(placa.id)) >= MAXIMO_DE_CANDIDATOS) {
    throw new ErrorDeDominio('dispositivo.anuncio_bloqueado', 429, { reintentar_en_segundos: 300 });
  }

  const telemetria = { firmware: datos.firmware, ip: datos.ip, en: ahora };
  const placaId = placa.id;
  try {
    await enTransaccion(pool, async (tx) => {
      if (candidato === null) await anuncios.crear(tx, { placaId, huella, ...telemetria });
      else await anuncios.tocar(tx, candidato.id, telemetria);
      await placas.registrarAnuncio(tx, placaId, telemetria);
    });
  } catch (error) {
    // El mismo candidato se anunció dos veces a la vez: da igual cuál ganó.
    if (!esDuplicado(error)) throw error;
  }
  limitadores.porIp.registrarExito(datos.ip);
  limitadores.porMac.registrarExito(mac);

  const esperaElPulsador = placa.por_confirmar_hasta !== null && placa.por_confirmar_hasta > ahora;
  return { estado: esperaElPulsador ? 'confirmar' : 'detectada' };
}
