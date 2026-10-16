import type { MiembroEquipo } from '../domain/equipo';

export interface ListadoEquipo {
  miembros: readonly MiembroEquipo[];
  activos: number;
}

export interface NuevoMiembro {
  nombre: string;
  usuario: string;
  contrasenaTemporal: string;
}

/** Lo que `application` necesita de la API del equipo AGROCOM. */
export interface EquipoRepositorio {
  listar: () => Promise<ListadoEquipo>;
  usuarioDisponible: (usuario: string) => Promise<boolean>;
  agregar: (nuevo: NuevoMiembro) => Promise<MiembroEquipo>;
  desactivar: (id: string) => Promise<void>;
  reactivar: (id: string) => Promise<void>;
  renombrar: (id: string, nombre: string) => Promise<void>;
}
