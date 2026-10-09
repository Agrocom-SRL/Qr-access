export interface VigenciaDeSesion {
  readonly revocada_at: Date | null;
  readonly expira_at: Date;
}

/** Una sesión sirve mientras no esté revocada ni vencida. */
export function sesionVigente(sesion: VigenciaDeSesion, ahora: Date): boolean {
  return sesion.revocada_at === null && sesion.expira_at > ahora;
}
