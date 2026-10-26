import type { CuentaDeCobro, FormularioDeCuentaDeCobro } from '../domain/cuentaDeCobro';

export interface CobroRepositorio {
  /** Todas, las activas primero. */
  listar: () => Promise<readonly CuentaDeCobro[]>;
  /** Sube antes la imagen del QR, si la trae, y crea la cuenta. */
  crear: (datos: FormularioDeCuentaDeCobro) => Promise<void>;
  editar: (id: string, datos: FormularioDeCuentaDeCobro) => Promise<void>;
  /** Activa o desactiva: una desactivada deja de mostrarse al cobrar, pero no se pierde. */
  cambiarActivo: (id: string, activo: boolean) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
  /** El archivo del QR, para mostrarlo. */
  verImagen: (imagenId: string) => Promise<Blob>;
}
