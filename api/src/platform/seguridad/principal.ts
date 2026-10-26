/** Quién llama a la API, ya autenticado (ADR 0004). Lo deja el plugin de autenticación. */
export interface PrincipalUsuario {
  readonly tipo: 'usuario';
  readonly usuarioId: string;
  readonly cuentaId: string;
  readonly sesionId: string;
  /** El único rol del usuario (ADR 0028 §2); `null` si no tiene uno vigente. */
  readonly rolActivoId: string | null;
  /** Permisos de su rol (invariante 10). */
  readonly permisos: ReadonlySet<string>;
  /**
   * Su estado efectivo (el peor entre el suyo, el de sus superiores y el de su cuenta, ADR 0031 §0).
   * Nunca `suspendido`: ese no autentica. `restringido` no genera QR nuevos.
   */
  readonly estado: 'activo' | 'restringido';
  /** De dónde viene el estado cuando no es `activo`; `null` si es `activo`. */
  readonly origenDelEstado: 'usuario' | 'superior' | 'cuenta' | null;
}

export interface PrincipalDispositivo {
  readonly tipo: 'dispositivo';
  readonly dispositivoId: string;
  readonly cuentaId: string;
  readonly puertaId: string;
}

/** Un super admin de AGROCOM (`tenant_id NULL`, ADR 0004 §7): opera sobre la plataforma, no sobre una cuenta. */
export interface PrincipalPlataforma {
  readonly tipo: 'plataforma';
  readonly usuarioId: string;
  readonly sesionId: string;
  /** Permisos de ámbito plataforma de su rol. */
  readonly permisos: ReadonlySet<string>;
}

export type Principal = PrincipalUsuario | PrincipalDispositivo | PrincipalPlataforma;

/** Cómo se autentica una ruta. Sin declarar nada, es `usuario`: se falla cerrado. */
export type TipoDeAcceso = 'publica' | 'usuario' | 'dispositivo' | 'plataforma';

/** Los módulos aportan estos verificadores; el plugin los usa sin conocerlos (ADR 0003). */
export interface Autenticadores {
  /** `null` si el JWT, la sesión o el usuario no son válidos. */
  autenticarUsuario(jwt: string): Promise<PrincipalUsuario | null>;
  /** `null` si la credencial no existe, no coincide o está revocada. */
  autenticarDispositivo(id: string, clave: string): Promise<PrincipalDispositivo | null>;
  /** `null` si el JWT no es de una sesión de plataforma vigente (un JWT de cuenta no sirve). */
  autenticarPlataforma(jwt: string): Promise<PrincipalPlataforma | null>;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    acceso?: TipoDeAcceso;
  }
  interface FastifyRequest {
    principal?: Principal;
  }
}
