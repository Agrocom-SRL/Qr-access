import type { Pool } from 'mysql2/promise';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { aIso } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import {
  RepositorioDeCuentas,
  RepositorioDeRolesDeUsuario,
  RepositorioDeUsuarios,
} from '../repository.js';

export interface SesionActual {
  usuario: { id: string; etiqueta: string | null };
  cuenta: { id: string; codigo: string; nombre: string };
  /** Todos sus roles: la app los ofrece para elegir cuando reabre sin rol activo. */
  roles: { id: string; nombre: string }[];
  rol_activo: { id: string; nombre: string } | null;
  permisos: string[];
  /** Plan y vencimiento de la suscripción vigente (HU-03); `null` si no hay una vigente. */
  suscripcion: { plan: string; hasta: string } | null;
}

/** Quién soy, en qué cuenta, con qué rol y qué puedo hacer: con esto la app arma su menú. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  ahora: Date = new Date(),
): Promise<SesionActual> {
  const [usuario, cuenta, roles, suscripcion] = await Promise.all([
    new RepositorioDeUsuarios(pool).buscarActivoPorId(principal.usuarioId),
    new RepositorioDeCuentas(pool).buscarActivaPorId(principal.cuentaId),
    new RepositorioDeRolesDeUsuario(pool).rolesDe(principal.usuarioId),
    crearServicioDeSuscripciones(pool).obtenerVigente(ahora),
  ]);
  if (usuario === null || cuenta === null) throw new ErrorDeDominio('autenticacion.requerida', 401);

  const rolActivo = roles.find((rol) => rol.id === principal.rolActivoId) ?? null;
  return {
    usuario: { id: usuario.id, etiqueta: usuario.etiqueta },
    cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
    roles: roles.map((rol) => ({ id: rol.id, nombre: rol.nombre })),
    rol_activo: rolActivo === null ? null : { id: rolActivo.id, nombre: rolActivo.nombre },
    permisos: [...principal.permisos].sort(),
    suscripcion:
      suscripcion === null
        ? null
        : { plan: suscripcion.planNombre, hasta: aIso(suscripcion.hasta) },
  };
}
