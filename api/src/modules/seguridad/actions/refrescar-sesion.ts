import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { generarTokenOpaco, sha256Hex } from '../../../platform/seguridad/tokens.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import { estadoEfectivo, nodosDeEstado } from '../domain/estado.js';
import { rolUnico } from '../domain/rol-unico.js';
import { sesionVigente, type SesionRefrescada } from '../domain/sesion.js';
import {
  RepositorioDeCuentas,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeSesionesDePlataforma,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { ejecutar as refrescarDePlataforma } from './refrescar-sesion-plataforma.js';

/**
 * Refresco rotativo (ADR 0004 §4): el refresh presentado deja de servir y se entrega otro. La
 * sesión es la misma, así que el JWT de acceso que el cliente ya tenga sigue vigente hasta
 * que venza. Un refresh ya usado, vencido o de una sesión revocada responde lo mismo.
 */
export async function ejecutar(
  servicios: ServiciosDeSeguridad,
  refrescoPresentado: string,
  ahora: Date = new Date(),
): Promise<SesionRefrescada> {
  const invalido = new ErrorDeDominio('sesion.refresco_invalido', 401);
  const hashActual = sha256Hex(refrescoPresentado);

  // Salto explícito del aislamiento: el refresh llega sin JWT; el hash (256 bits) identifica la sesión.
  const sesion = await new RepositorioDeSesionesDePlataforma(servicios.pool).buscarPorRefreshHash(
    hashActual,
  );
  if (sesion === null || !sesionVigente(sesion, ahora)) throw invalido;

  // Sesión de un super admin (sin cuenta): su propio camino, que nunca toca datos de cuentas.
  if (sesion.tenant_id === null) {
    return refrescarDePlataforma(servicios, sesion.id, sesion.usuario_id, hashActual, ahora);
  }
  const cuentaId = sesion.tenant_id;

  return ContextoCuenta.ejecutarEn(cuentaId, async () => {
    const [cadena, cuenta] = await Promise.all([
      new RepositorioDeUsuarios(servicios.pool).cadenaDeEstados(sesion.usuario_id),
      new RepositorioDeCuentas(servicios.pool).buscarPorId(cuentaId),
    ]);
    if (cuenta === null) throw invalido;
    // Suspendido o eliminado (él, un superior o su cuenta): el refresh ya no sirve. Restringido sí.
    const { estado } = estadoEfectivo(sesion.usuario_id, nodosDeEstado(cadena), cuenta.estado);
    if (estado !== 'activo' && estado !== 'restringido') throw invalido;
    const usuario = { id: sesion.usuario_id };

    const roles = await new RepositorioDeRolesDeUsuario(servicios.pool).rolesDe(usuario.id);
    // Se relee el rol en cada refresco: si el usuario cambió de rol, la sesión sigue al rol vigente.
    const rolActivoId = rolUnico(roles.map((rol) => rol.id));

    const refresco = generarTokenOpaco(32);
    const rotada = await enTransaccion(servicios.pool, (tx) =>
      new RepositorioDeSesiones(servicios.pool).rotar(
        tx,
        sesion.id,
        hashActual,
        sha256Hex(refresco),
        sumarDias(ahora, servicios.config.JWT_REFRESH_DIAS),
        ahora,
      ),
    );
    // Dos refrescos simultáneos con el mismo token: solo uno rota.
    if (!rotada) throw invalido;

    const acceso = await servicios.jwt.firmar({
      usuarioId: usuario.id,
      cuentaId,
      sesionId: sesion.id,
      rolActivoId,
    });
    return { acceso, refresco };
  });
}
