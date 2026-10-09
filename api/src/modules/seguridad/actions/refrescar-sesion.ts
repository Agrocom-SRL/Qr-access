import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { generarTokenOpaco, sha256Hex } from '../../../platform/seguridad/tokens.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import { decidirRolActivo } from '../domain/rol-activo.js';
import { sesionVigente } from '../domain/sesion.js';
import {
  RepositorioDeCuentas,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeSesionesDePlataforma,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

export interface SesionRefrescada {
  acceso: string;
  refresco: string;
}

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

  return ContextoCuenta.ejecutarEn(sesion.tenant_id, async () => {
    const usuario = await new RepositorioDeUsuarios(servicios.pool).buscarActivoPorId(
      sesion.usuario_id,
    );
    const cuenta = await new RepositorioDeCuentas(servicios.pool).buscarActivaPorId(
      sesion.tenant_id,
    );
    if (usuario === null || cuenta === null) throw invalido;

    const roles = await new RepositorioDeRolesDeUsuario(servicios.pool).rolesDe(usuario.id);
    const idsDeRoles = roles.map((rol) => rol.id);
    const rolActivoId =
      sesion.rol_activo_id !== null && idsDeRoles.includes(sesion.rol_activo_id)
        ? sesion.rol_activo_id
        : decidirRolActivo(idsDeRoles, usuario.rol_preferido_id);

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
      cuentaId: sesion.tenant_id,
      sesionId: sesion.id,
      rolActivoId,
    });
    return { acceso, refresco };
  });
}
