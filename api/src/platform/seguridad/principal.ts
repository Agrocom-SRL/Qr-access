/** Quién llama a la API, ya autenticado (ADR 0004). Lo deja el plugin de autenticación. */
export interface PrincipalUsuario {
  readonly tipo: 'usuario';
  readonly usuarioId: string;
  readonly cuentaId: string;
  readonly sesionId: string;
  /** `null` si el usuario tiene varios roles y todavía no eligió uno. */
  readonly rolActivoId: string | null;
  /** Permisos del rol activo, nunca la unión de sus roles (invariante 10). */
  readonly permisos: ReadonlySet<string>;
}

export interface PrincipalDispositivo {
  readonly tipo: 'dispositivo';
  readonly dispositivoId: string;
  readonly cuentaId: string;
  readonly puertaId: string;
}

export type Principal = PrincipalUsuario | PrincipalDispositivo;

/** Cómo se autentica una ruta. Sin declarar nada, es `usuario`: se falla cerrado. */
export type TipoDeAcceso = 'publica' | 'usuario' | 'dispositivo';

/** Los módulos aportan estos verificadores; el plugin los usa sin conocerlos (ADR 0003). */
export interface Autenticadores {
  /** `null` si el JWT, la sesión o el usuario no son válidos. */
  autenticarUsuario(jwt: string): Promise<PrincipalUsuario | null>;
  /** `null` si la credencial no existe, no coincide o está revocada. */
  autenticarDispositivo(id: string, clave: string): Promise<PrincipalDispositivo | null>;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    acceso?: TipoDeAcceso;
  }
  interface FastifyRequest {
    principal?: Principal;
  }
}
