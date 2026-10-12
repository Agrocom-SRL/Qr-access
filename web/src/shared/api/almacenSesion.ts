/** Tokens de la sesión del super admin. */
export interface Tokens {
  acceso: string;
  refresco: string;
}

type Oyente = () => void;

/**
 * Tokens solo en memoria (ADR 0021: nunca en `localStorage`). Al recargar la página hay que
 * ingresar de nuevo.
 * TODO(docs): cookie httpOnly para el refresco necesita soporte en la API; hoy el refresco viaja en el cuerpo.
 */
export class AlmacenSesion {
  private tokens: Tokens | null = null;
  private readonly oyentes = new Set<Oyente>();

  obtener(): Tokens | null {
    return this.tokens;
  }

  guardar(tokens: Tokens): void {
    this.tokens = tokens;
    this.avisar();
  }

  limpiar(): void {
    this.tokens = null;
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
