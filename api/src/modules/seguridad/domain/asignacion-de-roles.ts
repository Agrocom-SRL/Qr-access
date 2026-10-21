/**
 * D-19 / ADR 0017 §5: nadie asigna un rol con permisos que él mismo no tiene con su rol.
 * Devuelve el primer permiso que el actor no tiene, o `null` si puede asignar todos los roles.
 */
export function permisoQueExcede(
  permisosDeLosRoles: ReadonlyMap<string, readonly string[]>,
  permisosDelActor: ReadonlySet<string>,
): { rolId: string; permiso: string } | null {
  for (const [rolId, permisos] of permisosDeLosRoles) {
    const permiso = permisos.find((codigo) => !permisosDelActor.has(codigo));
    if (permiso !== undefined) return { rolId, permiso };
  }
  return null;
}
