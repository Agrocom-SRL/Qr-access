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
import { estadoEfectivo, nodosDeEstado } from './domain/estado.js';
import { sesionVigente } from './domain/sesion.js';

/**
 * Valida un JWT de acceso Y su vigencia real en la base (ADR 0004 §6): sesión sin revocar ni
 * vencer, usuario y cuenta no suspendidos, y rol activo todavía asignado. Un rol quitado, un usuario
 * dado de baja o suspendido (él, un superior o su cuenta, ADR 0031 §2) dejan de servir de inmediato,
 * no cuando venza el JWT. Un restringido sí entra: conserva la sesión y consulta (ADR 0033 §1); su
 * estado viaja en el principal para que la generación de QR lo rechace.
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
      const [cadena, cuenta] = await Promise.all([
        new RepositorioDeUsuarios(pool).cadenaDeEstados(reclamos.usuarioId),
        new RepositorioDeCuentas(pool).buscarPorId(cuentaId),
      ]);
      if (cuenta === null) return null;
      const efectivo = estadoEfectivo(reclamos.usuarioId, nodosDeEstado(cadena), cuenta.estado);
      // Suspendido o eliminado (él o un superior): sin acceso. Cualquier otro valor, falla cerrado.
      if (efectivo.estado !== 'activo' && efectivo.estado !== 'restringido') return null;
      const usuario = { id: reclamos.usuarioId };

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
        estado: efectivo.estado,
        origenDelEstado: efectivo.origen,
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
