import type { Pool } from 'mysql2/promise';
import { enTransaccion, type Transaccion } from '../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import { hashear } from '../../platform/seguridad/hash.js';
import { RepositorioDeAnuncios } from './anuncios-repository.js';
import { huellaDeClave } from './domain/placa.js';
import { SENTIDO_POR_OMISION } from './domain/sentido.js';
import { RepositorioDePlacas, type PlacaBasica } from './placas-repository.js';
import {
  LAPSO_DE_CANDIDATO_ACTIVO_MS,
  VENTANA_DE_CONFIRMACION_MS,
  conVinculoValido,
  esDuplicado,
} from './vinculo.js';

/** Código con que se rechaza un candidato que no puede vincularse; no sale al cliente. */
export const CANDIDATO_DUDOSO = 'placa.candidato_dudoso';

/**
 * Exige que `huella` sea el ÚNICO candidato activo de la placa y que ya existiera cuando el super
 * admin abrió la solicitud (ADR 0037): con dos claves anunciándose a la vez para la misma MAC no hay
 * forma de saber cuál es la placa real, y un candidato que aparece después de pedir el vínculo no es
 * la placa que el super admin vio en el panel. Falla cerrada con `CANDIDATO_DUDOSO`.
 *
 * Con `bloquear` (dentro de la transacción de creación) la comprobación y la creación son atómicas.
 */
async function exigirCandidatoUnico(
  anuncios: RepositorioDeAnuncios,
  placaId: string,
  huella: string,
  abiertaEn: Date,
  ahora: Date,
  ejecutor: Pool | Transaccion,
  bloquear = false,
): Promise<void> {
  const desde = new Date(ahora.getTime() - LAPSO_DE_CANDIDATO_ACTIVO_MS);
  const activos = await anuncios.activos(placaId, desde, ejecutor, bloquear);
  const unico = activos.length === 1 ? activos[0] : undefined;
  if (unico?.clave_huella !== huella || unico.created_at > abiertaEn) {
    throw new ErrorDeDominio(CANDIDATO_DUDOSO, 409);
  }
}

/**
 * Crea el dispositivo de la solicitud abierta de una placa (ADR 0026 §3 y ADR 0037): comprueba que
 * el candidato es único, revalida la ventana, la cuenta, la puerta y el plan con la fila bloqueada,
 * guarda el argon2id de la clave y descarta los demás candidatos de la MAC. Devuelve el id del
 * dispositivo. La usan `/anunciar` y `/confirmar`: las dos pasan por las mismas guardas.
 *
 * Es una ruta anónima, así que lo caro (el argon2id) va al final, solo si el candidato y la
 * solicitud ya pasaron todas las comprobaciones baratas. Corre sin contexto de cuenta hasta crear
 * el dispositivo con el de la cuenta pedida, a nombre de quien pidió el vínculo: revisar línea por
 * línea (invariantes 1 y 5).
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

  const huella = huellaDeClave(clave);
  // Cuándo se abrió la solicitud: la ventana empieza al pedir el vínculo.
  const abiertaEn = new Date(hasta.getTime() - VENTANA_DE_CONFIRMACION_MS);
  // Guarda barata antes de validar el plan y de gastar un argon2id.
  await exigirCandidatoUnico(anuncios, placa.id, huella, abiertaEn, ahora, pool);

  try {
    return await conVinculoValido(
      pool,
      { cuentaId, puertaId, usuarioId: solicitadoPor, sentido },
      ahora,
      async ({ puertaId: puertaValida, dispositivos }) => {
        // Cuenta, puerta y plan ya se validaron: recién ahora se paga el argon2id.
        const claveHash = await hashear(clave);
        return enTransaccion(pool, async (tx) => {
          // Con la fila bloqueada: si el super admin canceló o cambió la solicitud, no vale. Se
          // compara todo lo que se validó arriba, no solo la cuenta y la puerta.
          const bloqueada = await placas.buscarPorId(placa.id, tx);
          const vigenteHasta = bloqueada?.por_confirmar_hasta;
          if (
            bloqueada === null ||
            vigenteHasta === null ||
            vigenteHasta === undefined ||
            vigenteHasta <= ahora ||
            vigenteHasta.getTime() !== hasta.getTime() ||
            bloqueada.vinculo_cuenta_id !== cuentaId ||
            bloqueada.vinculo_puerta_id !== puertaId ||
            bloqueada.vinculo_nombre !== nombre ||
            bloqueada.vinculo_solicitado_por !== solicitadoPor ||
            (bloqueada.vinculo_sentido ?? SENTIDO_POR_OMISION) !== sentido
          ) {
            throw new ErrorDeDominio('placa.sin_solicitud', 409);
          }
          // Atómica con la creación: la placa está bloqueada y los candidatos, leídos con FOR UPDATE.
          await exigirCandidatoUnico(anuncios, placa.id, huella, abiertaEn, ahora, tx, true);
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
        });
      },
    );
  } catch (error) {
    // `uq_dispositivos_puerta` / `uq_dispositivos_placa`: otra vinculación llegó primero.
    if (esDuplicado(error)) throw new ErrorDeDominio('puerta.con_dispositivo', 409);
    throw error;
  }
}

/** ¿Es este el rechazo de la guarda de candidato único? Quien llama decide qué responder. */
export function esCandidatoDudoso(error: unknown): boolean {
  return error instanceof ErrorDeDominio && error.code === CANDIDATO_DUDOSO;
}
