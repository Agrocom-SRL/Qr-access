/** Reglas puras de las cuentas donde AGROCOM recibe sus pagos (ADR 0029). */

export type MetodoDeCobro = 'transferencia' | 'qr';
export const METODOS_DE_COBRO: readonly MetodoDeCobro[] = ['transferencia', 'qr'];

export type TipoDeCuenta = 'ahorro' | 'corriente';
export const TIPOS_DE_CUENTA: readonly TipoDeCuenta[] = ['ahorro', 'corriente'];

/** Bancos de la lista: se puede escribir otro con "Otro". */
export const BANCOS = [
  'Banco Unión',
  'Banco Nacional de Bolivia',
  'Banco de Crédito',
  'Banco Mercantil Santa Cruz',
  'Banco BISA',
  'Banco Ganadero',
  'Banco Económico',
  'Banco FIE',
  'Banco Sol',
  'Banco Fassil',
  'Banco Prodem',
] as const;

/** Imágenes que acepta el QR de cobro (la API revisa el contenido real). */
export const TIPOS_DE_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES_DE_IMAGEN = 5 * 1024 * 1024;

export interface CuentaDeCobro {
  id: string;
  metodo: MetodoDeCobro;
  banco: string;
  titular: string | null;
  numeroCuenta: string | null;
  tipoCuenta: TipoDeCuenta | null;
  /** El archivo del QR, que se baja con `verImagen`. */
  imagenId: string | null;
  nota: string | null;
  activo: boolean;
}

export interface FormularioDeCuentaDeCobro {
  metodo: MetodoDeCobro;
  banco: string;
  titular: string;
  numeroCuenta: string;
  tipoCuenta: TipoDeCuenta | '';
  nota: string;
  /** El QR nuevo elegido en este formulario. */
  imagen: File | null;
  /** El QR que la cuenta ya tiene (al editar); sigue valiendo si no se elige otro. */
  imagenActualId: string | null;
}

export type ErrorDeCuentaDeCobro = 'requerido' | 'archivoInvalido' | 'archivoGrande';

export const FORMULARIO_VACIO: FormularioDeCuentaDeCobro = {
  metodo: 'transferencia',
  banco: '',
  titular: '',
  numeroCuenta: '',
  tipoCuenta: '',
  nota: '',
  imagen: null,
  imagenActualId: null,
};

export function formularioDe(cuenta: CuentaDeCobro): FormularioDeCuentaDeCobro {
  return {
    metodo: cuenta.metodo,
    banco: cuenta.banco,
    titular: cuenta.titular ?? '',
    numeroCuenta: cuenta.numeroCuenta ?? '',
    tipoCuenta: cuenta.tipoCuenta ?? '',
    nota: cuenta.nota ?? '',
    imagen: null,
    imagenActualId: cuenta.imagenId,
  };
}

/** Una cuenta bancaria pide titular y número; un QR pide su imagen (la actual o una nueva). */
export function validarCuentaDeCobro(
  datos: FormularioDeCuentaDeCobro,
): Partial<Record<keyof FormularioDeCuentaDeCobro, ErrorDeCuentaDeCobro>> {
  const errores: Partial<Record<keyof FormularioDeCuentaDeCobro, ErrorDeCuentaDeCobro>> = {};
  if (datos.banco.trim() === '') errores.banco = 'requerido';
  if (datos.metodo === 'transferencia') {
    if (datos.titular.trim() === '') errores.titular = 'requerido';
    if (datos.numeroCuenta.trim() === '') errores.numeroCuenta = 'requerido';
    return errores;
  }
  if (datos.imagen === null) {
    if (datos.imagenActualId === null) errores.imagen = 'requerido';
  } else if (!TIPOS_DE_IMAGEN.includes(datos.imagen.type)) {
    errores.imagen = 'archivoInvalido';
  } else if (datos.imagen.size > MAX_BYTES_DE_IMAGEN) {
    errores.imagen = 'archivoGrande';
  }
  return errores;
}
