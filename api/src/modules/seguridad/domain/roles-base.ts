/**
 * Los tres roles que trae toda cuenta (ADR 0004 §5). Administrador es protegido y recibe todos
 * los permisos de ámbito cuenta; Usuario y Guardia, los de esta lista (los mismos de la demo).
 */
export interface RolBase {
  readonly nombre: string;
  readonly protegido: boolean;
  /** `null` = todos los permisos de ámbito cuenta del catálogo. */
  readonly permisos: readonly string[] | null;
}

export const ROLES_BASE: readonly RolBase[] = [
  { nombre: 'Administrador', protegido: true, permisos: null },
  {
    nombre: 'Usuario',
    protegido: false,
    permisos: [
      'organizacion.puerta.ver',
      'accesos.qr.emitir',
      'accesos.qr.ver',
      'accesos.qr.anular',
      'accesos.evento.ver',
    ],
  },
  {
    nombre: 'Guardia',
    protegido: false,
    permisos: [
      'organizacion.puerta.ver',
      'organizacion.puerta.supervisar',
      'accesos.evento.ver',
      'accesos.evento.ver_todos',
    ],
  },
];
