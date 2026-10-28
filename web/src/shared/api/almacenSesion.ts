type Oyente = () => void;

/**
 * Guarda solo el token de acceso, en memoria. El refresco no pasa por aquí: la API lo deja en una
 * cookie `HttpOnly` (ADR 0033 §5) que JavaScript no puede leer, así que no hay nada que persistir.
 * Sin `localStorage` ni `sessionStorage` (ADR 0022): recargar la página no conserva el acceso y la
 * sesión se recupera pidiendo un refresco con la cookie.
 */
export class AlmacenSesion {
  private acceso: string | null = null;
  private readonly oyentes = new Set<Oyente>();

  obtener(): string | null {
    return this.acceso;
  }

  guardar(acceso: string): void {
    this.acceso = acceso;
    this.avisar();
  }

  limpiar(): void {
    this.acceso = null;
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
