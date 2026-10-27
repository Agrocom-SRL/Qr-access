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
  'accesos.qr.generar',
  'accesos.qr.generar_propio',
  'accesos.qr.ver',
  'accesos.qr.anular',
  // Anula en bloque los QR vigentes que le toquen según su nivel (el Miembro, solo los propios; ADR 0033 §3).
  'accesos.qr.anular_masivo',
  'accesos.evento.ver',
  // Ve los incidentes de uso que lo alcanzan (los propios; ADR 0033 §3).
  'seguridad.incidente.ver',
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
      // Restringe y suspende a sus Miembros, y solo a ellos (ADR 0033 §3, D-25).
      'seguridad.usuario.restringir',
      'seguridad.usuario.suspender',
      // Registra, descarta o confirma los incidentes de uso de sus Miembros (ADR 0033 §3 y §4).
      'seguridad.incidente.resolver',
    ],
  },
  { nombre: 'Miembro', protegido: false, permisos: PERMISOS_DE_MIEMBRO },
  {
    nombre: 'Guardia',
    protegido: false,
    permisos: [
      'organizacion.puerta.ver',
      'organizacion.puerta.supervisar',
      // Solo su QR propio: el de visitas (`accesos.qr.generar`) no es de su nivel (ADR 0028 §5).
      'accesos.qr.generar_propio',
      // Solo sus propios QR (ADR 0033 §3): anula en bloque lo suyo y ve los incidentes que lo alcanzan.
      'accesos.qr.anular_masivo',
      'seguridad.incidente.ver',
      'accesos.evento.ver',
      'accesos.evento.ver_asignadas',
    ],
  },
];
