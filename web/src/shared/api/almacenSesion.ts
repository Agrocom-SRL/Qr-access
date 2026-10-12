/** Tokens de la sesión del super admin. */
export interface Tokens {
  acceso: string;
  refresco: string;
}

type Oyente = () => void;

const CLAVE_REFRESCO = 'acceso.refresco';

/** El `sessionStorage` puede faltar o lanzar (ventana privada, datos bloqueados): sin él no se recuerda nada. */
function almacenamientoDePestana(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * El token de acceso vive solo en memoria. El de refresco se recuerda en el `sessionStorage` de la
 * pestaña para que recargar o escribir otra URL no cierre la sesión; se borra al cerrar la
 * pestaña o la sesión (nunca en `localStorage`, ADR 0022).
 * TODO(docs): cookie httpOnly para el refresco necesita soporte en la API; hoy el refresco viaja en el cuerpo.
 */
export class AlmacenSesion {
  private tokens: Tokens | null = null;
  private readonly oyentes = new Set<Oyente>();

  constructor(private readonly pestana: Storage | null = almacenamientoDePestana()) {}

  obtener(): Tokens | null {
    return this.tokens;
  }

  /** El refresco recordado por la pestaña, para recuperar la sesión tras una recarga. */
  refrescoRecordado(): string | null {
    try {
      return this.pestana?.getItem(CLAVE_REFRESCO) ?? null;
    } catch {
      return null;
    }
  }

  guardar(tokens: Tokens): void {
    this.tokens = tokens;
    try {
      this.pestana?.setItem(CLAVE_REFRESCO, tokens.refresco);
    } catch {
      // Sin almacenamiento la sesión sigue, solo que no sobrevive a una recarga.
    }
    this.avisar();
  }

  limpiar(): void {
    this.tokens = null;
    try {
      this.pestana?.removeItem(CLAVE_REFRESCO);
    } catch {
      // Nada que borrar.
    }
    this.avisar();
  }

  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    return () => {
      this.oyentes.delete(oyente);
    };
  }

  private avisar(): void {
    this.oyentes.forEach((o) => {
      o();
    });
  }
}
