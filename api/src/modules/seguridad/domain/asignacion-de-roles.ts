/**
 * D-19 / ADR 0017 §5: nadie asigna un rol con permisos que él mismo no tiene con su rol activo.
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

/** Qué asignaciones sobran y qué roles faltan para pasar de `actuales` a `deseados`. */
export function diferenciaDeRoles(
  actuales: readonly { id: string; rolId: string }[],
  deseados: readonly string[],
): { quitar: string[]; agregar: string[] } {
  const quiero = new Set(deseados);
  const tengo = new Set(actuales.map((asignacion) => asignacion.rolId));
  return {
    quitar: actuales.filter((a) => !quiero.has(a.rolId)).map((a) => a.id),
    agregar: deseados.filter((rolId) => !tengo.has(rolId)),
  };
}
