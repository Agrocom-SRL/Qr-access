/**
 * Los cuatro roles que trae toda cuenta (ADR 0004 §5, ADR 0028 §1). Administrador es protegido y
 * recibe todos los permisos de ámbito cuenta; los demás, los de esta lista (los mismos de la demo).
 * Cada usuario tiene uno solo de estos roles, y el nombre define su nivel en el árbol
 * (`domain/jerarquia.ts`).
 */
export interface RolBase {
  readonly nombre: string;
  readonly protegido: boolean;
  /** `null` = todos los permisos de ámbito cuenta del catálogo. */
  readonly permisos: readonly string[] | null;
}

/** Lo que puede hacer quien solo usa la puerta con sus QR. */
const PERMISOS_DE_MIEMBRO = [
  'organizacion.puerta.ver',
  'accesos.qr.emitir',
  'accesos.qr.ver',
  'accesos.qr.anular',
  'accesos.evento.ver',
] as const;

export const ROLES_BASE: readonly RolBase[] = [
  { nombre: 'Administrador', protegido: true, permisos: null },
  {
    // El Titular responde por su unidad: además de lo del Miembro, crea y administra a sus Miembros.
    nombre: 'Titular',
    protegido: false,
    permisos: [
      ...PERMISOS_DE_MIEMBRO,
      'seguridad.usuario.ver',
      'seguridad.usuario.crear',
      'seguridad.usuario.editar',
      'seguridad.usuario.eliminar',
    ],
  },
  { nombre: 'Miembro', protegido: false, permisos: PERMISOS_DE_MIEMBRO },
  {
    nombre: 'Guardia',
    protegido: false,
    permisos: [
      'organizacion.puerta.ver',
      'organizacion.puerta.supervisar',
      'accesos.qr.emitir',
      'accesos.evento.ver',
      'accesos.evento.ver_asignadas',
    ],
  },
];
