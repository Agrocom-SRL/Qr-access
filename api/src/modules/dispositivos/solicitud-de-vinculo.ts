import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import { hashear } from '../../platform/seguridad/hash.js';
import { RepositorioDeAnuncios } from './anuncios-repository.js';
import { SENTIDO_POR_OMISION } from './domain/sentido.js';
import { RepositorioDePlacas, type PlacaBasica } from './placas-repository.js';
import { conVinculoValido, esDuplicado } from './vinculo.js';

/**
 * Crea el dispositivo de la solicitud abierta de una placa (ADR 0026 §3 y ADR 0037): revalida la
 * ventana, la cuenta, la puerta y el plan con la fila bloqueada, guarda el argon2id de la clave y
 * descarta los demás candidatos de la MAC. Devuelve el id del dispositivo.
 *
 * Quien la llama ya comprobó que `clave` es el candidato legítimo de la placa. Corre sin contexto
 * de cuenta hasta crear el dispositivo con el de la cuenta pedida, a nombre de quien pidió el
 * vínculo: revisar línea por línea (invariantes 1 y 5).
 */
export async function crearDispositivoDeLaSolicitud(
  pool: Pool,
  placa: PlacaBasica,
  clave: string,
  ahora: Date,
): Promise<string> {
  const placas = new RepositorioDePlacas(pool);
  const anuncios = new RepositorioDeAnuncios(pool);
  const { por_confirmar_hasta: hasta, vinculo_cuenta_id: cuentaId } = placa;
  const { vinculo_puerta_id: puertaId, vinculo_nombre: nombre } = placa;
  const { vinculo_solicitado_por: solicitadoPor } = placa;
  // Nulo = solicitud anterior a la ubicación del lector: una sola placa para los dos lados.
  const sentido = placa.vinculo_sentido ?? SENTIDO_POR_OMISION;
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

  const claveHash = await hashear(clave);
  try {
    return await conVinculoValido(
      pool,
      { cuentaId, puertaId, usuarioId: solicitadoPor, sentido },
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
            sentido,
          });
          await placas.limpiarSolicitud(tx, placa.id);
          await anuncios.descartarTodos(tx, placa.id, ahora);
          return id;
        }),
    );
  } catch (error) {
    // `uq_dispositivos_puerta` / `uq_dispositivos_placa`: otra vinculación llegó primero.
    if (esDuplicado(error)) throw new ErrorDeDominio('puerta.con_dispositivo', 409);
    throw error;
  }
}
