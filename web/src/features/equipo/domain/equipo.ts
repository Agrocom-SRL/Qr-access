/** Reglas puras del equipo AGROCOM (A11); espejo de `api/.../domain/super-admin.ts`. */

export interface MiembroEquipo {
  id: string;
  nombre: string;
  usuario: string;
  activo: boolean;
  /** Es quien está mirando la pantalla ("Tú"). */
  esActual: boolean;
  ultimoIngresoEn: Date | null;
}

/** Solo se desactiva a otra persona que siga activa; la API además exige que quede al menos un activo. */
export function puedeDesactivar(miembro: MiembroEquipo): boolean {
  return miembro.activo && !miembro.esActual;
}

/** Un miembro desactivado se puede volver a activar. */
export function puedeReactivar(miembro: MiembroEquipo): boolean {
  return !miembro.activo;
}

const USUARIO_ADMITIDO = /^[a-z0-9][a-z0-9._-]{2,59}$/;

export function usuarioConFormatoValido(usuario: string): boolean {
  return USUARIO_ADMITIDO.test(usuario.trim().toLowerCase());
}

/** `Valeria Justiniano` → `valeria.justiniano`: sin tildes, en minúsculas y con puntos. */
export function sugerirUsuario(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .map((palabra) => palabra.replaceAll(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join('.')
    .slice(0, 60);
}

/** Sin 0/O ni 1/l/I: la contraseña temporal se dicta por teléfono o se copia a un chat. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const LARGO_DE_CONTRASENA_TEMPORAL = 12;

/**
 * Contraseña temporal de 12 letras y números, sin guiones ni símbolos (`Qx7mR42pLbT9`): se dicta
 * y se copia sin sorpresas; quien la reciba la cambia en su primer ingreso. Recibe la fuente de
 * azar para poder probarla; en producción es `crypto.getRandomValues`.
 */
export function generarContrasenaTemporal(aleatorio: (limite: number) => number): string {
  const caracteres = Array.from({ length: LARGO_DE_CONTRASENA_TEMPORAL }, () =>
    ALFABETO.charAt(aleatorio(ALFABETO.length)),
  );
  return caracteres.join('');
}
