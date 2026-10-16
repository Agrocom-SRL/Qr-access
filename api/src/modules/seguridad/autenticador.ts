import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { ContextoCuenta } from '../../platform/contexto/contexto-cuenta.js';
import { crearEmisorDeJwt } from '../../platform/seguridad/jwt.js';
import type { PrincipalPlataforma, PrincipalUsuario } from '../../platform/seguridad/principal.js';
import {
  RepositorioDeCuentas,
  RepositorioDeRolesDeSuperAdmin,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeSesionesDeSuperAdmins,
  RepositorioDeSuperAdmins,
  RepositorioDeUsuarios,
} from './repository.js';
import { sesionVigente } from './domain/sesion.js';

/**
 * Valida un JWT de acceso Y su vigencia real en la base (ADR 0004 §6): sesión sin revocar ni
 * vencer, usuario y cuenta activos, y rol activo todavía asignado. Un rol quitado o un usuario
 * dado de baja dejan de servir de inmediato, no cuando venza el JWT.
 */
export function crearAutenticadorDeUsuario({ pool, config }: DependenciasDeModulo) {
  const jwt = crearEmisorDeJwt(config.JWT_SECRETO, config.JWT_ACCESO_MINUTOS);

  return async function autenticarUsuario(
    token: string,
    ahora = new Date(),
  ): Promise<PrincipalUsuario | null> {
    const reclamos = await jwt.verificar(token);
    // Un JWT de plataforma (sin cuenta) no sirve en las rutas de una cuenta.
    if (reclamos === null) return null;
    if (reclamos.cuentaId === null) return null;
    const cuentaId = reclamos.cuentaId;

    // La cuenta sale del JWT firmado y filtra cada consulta: una sesión de otra cuenta no aparece.
    return ContextoCuenta.ejecutarEn(cuentaId, async () => {
      const sesion = await new RepositorioDeSesiones(pool).buscarPorId(reclamos.sesionId);
      if (sesion === null || !sesionVigente(sesion, ahora)) return null;
      if (sesion.usuario_id !== reclamos.usuarioId) return null;
      const usuario = await new RepositorioDeUsuarios(pool).buscarActivoPorId(reclamos.usuarioId);
      if (usuario === null) return null;
      if ((await new RepositorioDeCuentas(pool).buscarActivaPorId(cuentaId)) === null) return null;

      const rolesRepositorio = new RepositorioDeRolesDeUsuario(pool);
      let rolActivoId: string | null = null;
      let permisos: string[] = [];
      if (reclamos.rolActivoId !== null) {
        const roles = await rolesRepositorio.rolesDe(usuario.id);
        if (roles.some((rol) => rol.id === reclamos.rolActivoId)) {
          rolActivoId = reclamos.rolActivoId;
          permisos = await rolesRepositorio.permisosDe(rolActivoId);
        }
      }
      return {
        tipo: 'usuario',
        usuarioId: usuario.id,
        cuentaId,
        sesionId: sesion.id,
        rolActivoId,
        permisos: new Set(permisos),
      };
    });
  };
}

/**
 * Valida el JWT de un super admin y su vigencia real en la base: sesión de plataforma sin
 * revocar ni vencer, usuario activo y permisos de ámbito plataforma de su rol. Un JWT de una
 * cuenta (con `tid`) no sirve acá, igual que uno de plataforma no sirve en una cuenta.
 */
export function crearAutenticadorDePlataforma({ pool, config }: DependenciasDeModulo) {
  const jwt = crearEmisorDeJwt(config.JWT_SECRETO, config.JWT_ACCESO_MINUTOS);

  return async function autenticarPlataforma(
    token: string,
    ahora = new Date(),
  ): Promise<PrincipalPlataforma | null> {
    const reclamos = await jwt.verificar(token);
    if (reclamos === null) return null;
    if (reclamos.cuentaId !== null) return null;

    const sesion = await new RepositorioDeSesionesDeSuperAdmins(pool).buscarPorId(
      reclamos.sesionId,
    );
    if (sesion === null || !sesionVigente(sesion, ahora)) return null;
    if (sesion.usuario_id !== reclamos.usuarioId) return null;
    const admin = await new RepositorioDeSuperAdmins(pool).buscarActivoPorId(reclamos.usuarioId);
    if (admin === null) return null;

    const permisos = await new RepositorioDeRolesDeSuperAdmin(pool).permisosDe(admin.id);
    return {
      tipo: 'plataforma',
      usuarioId: admin.id,
      sesionId: sesion.id,
      permisos: new Set(permisos),
    };
  };
}
