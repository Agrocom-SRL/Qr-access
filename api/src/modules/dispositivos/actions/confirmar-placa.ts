import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { hashear, verificarHash } from '../../../platform/seguridad/hash.js';
import { huellaDeClave, normalizarMac } from '../domain/placa.js';
import { RepositorioDeAnuncios } from '../anuncios-repository.js';
import { RepositorioDePlacas } from '../placas-repository.js';
import { RepositorioDeDispositivosDePlataforma } from '../repository.js';
import { conVinculoValido, esDuplicado } from '../vinculo.js';
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
 * La placa avisa que alguien mantuvo pulsado su botón (ADR 0026 §4). Es la prueba de presencia
 * física que reemplaza al código de fábrica: solo el candidato `(mac, clave)` que llega acá se
 * vuelve dispositivo; un anuncio falso de la misma MAC jamás confirma porque nadie pulsa su botón.
 * Ruta anónima y sin contexto de cuenta hasta que crea el dispositivo con el contexto de la cuenta
 * pedida, a nombre de quien pidió el vínculo: revisar línea por línea (invariantes 1 y 5).
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

  const placas = new RepositorioDePlacas(pool);
  const placa = await placas.buscarPorMac(mac);
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

  const anuncios = new RepositorioDeAnuncios(pool);
  const huella = huellaDeClave(datos.clave);
  const candidato = await anuncios.buscar(placa.id, huella);
  // Sin candidato (`undefined`) o ya descartado: no es la placa que se anunció.
  if (candidato?.descartada_at !== null) {
    return rechazarAnuncio(limitadores, datos.ip, mac);
  }
  const { por_confirmar_hasta: hasta, vinculo_cuenta_id: cuentaId } = placa;
  const { vinculo_puerta_id: puertaId, vinculo_nombre: nombre } = placa;
  const { vinculo_solicitado_por: solicitadoPor } = placa;
  if (
    hasta === null ||
    hasta <= ahora ||
    cuentaId === null ||
    puertaId === null ||
    nombre === null ||
    solicitadoPor === null
  ) {
    throw new ErrorDeDominio('placa.sin_solicitud', 409);
  }

  const claveHash = await hashear(datos.clave);
  try {
    const dispositivoId = await conVinculoValido(
      pool,
      { cuentaId, puertaId, usuarioId: solicitadoPor },
      ahora,
      ({ puertaId: puertaValida, dispositivos }) =>
        enTransaccion(pool, async (tx) => {
          // Con la fila bloqueada: si el super admin cancelo o cambió la solicitud, no vale.
          const bloqueada = await placas.buscarPorId(placa.id, tx);
          const vigenteHasta = bloqueada?.por_confirmar_hasta;
          if (
            bloqueada === null ||
            vigenteHasta === null ||
            vigenteHasta === undefined ||
            vigenteHasta <= ahora ||
            bloqueada.vinculo_cuenta_id !== cuentaId ||
            bloqueada.vinculo_puerta_id !== puertaId
          ) {
            throw new ErrorDeDominio('placa.sin_solicitud', 409);
          }
          const id = await dispositivos.crearParaPlaca(tx, {
            placaId: placa.id,
            puertaId: puertaValida,
            nombre,
            claveHash,
          });
          await placas.limpiarSolicitud(tx, placa.id);
          await anuncios.descartarTodos(tx, placa.id, ahora);
          return id;
        }),
    );
    limitadores.porIp.registrarExito(datos.ip);
    limitadores.porMac.registrarExito(mac);
    return { estado: 'vinculado', dispositivo_id: dispositivoId };
  } catch (error) {
    // `uq_dispositivos_puerta` / `uq_dispositivos_placa`: otra vinculación llegó primero.
    if (esDuplicado(error)) throw new ErrorDeDominio('puerta.con_dispositivo', 409);
    throw error;
  }
}
