import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import {
  RepositorioDeComprobantes,
  RepositorioDeCuentasDeCobro,
  type CuentaDeCobroFila,
  type NuevaCuentaDeCobro,
} from '../repository.js';

export interface CuentaDeCobro {
  id: string;
  metodo: 'transferencia' | 'qr';
  banco: string;
  titular: string | null;
  numero_cuenta: string | null;
  tipo_cuenta: 'ahorro' | 'corriente' | null;
  imagen_id: string | null;
  nota: string | null;
  activo: boolean;
}

const aVista = (fila: CuentaDeCobroFila): CuentaDeCobro => ({
  id: fila.id,
  metodo: fila.metodo,
  banco: fila.banco,
  titular: fila.titular,
  numero_cuenta: fila.numero_cuenta,
  tipo_cuenta: fila.tipo_cuenta,
  imagen_id: fila.imagen_id,
  nota: fila.nota,
  activo: fila.activo === 1,
});

/** Las cuentas donde AGROCOM recibe pagos (ADR 0029), las activas primero. */
export async function listar(pool: Pool): Promise<CuentaDeCobro[]> {
  return (await new RepositorioDeCuentasDeCobro(pool).listar()).map(aVista);
}

/** Una cuenta bancaria pide titular y número; un QR pide su imagen (y esta tiene que ser una imagen, no un PDF). */
async function exigirDatosDelMetodo(
  pool: Pool,
  datos: Pick<NuevaCuentaDeCobro, 'metodo' | 'titular' | 'numeroCuenta' | 'imagenId'>,
): Promise<void> {
  if (datos.metodo === 'transferencia') {
    if (datos.titular === null || datos.numeroCuenta === null) {
      throw new ErrorDeDominio('cuenta_de_cobro.datos_incompletos', 422);
    }
    return;
  }
  if (datos.imagenId === null) throw new ErrorDeDominio('cuenta_de_cobro.datos_incompletos', 422);
  const imagen = await new RepositorioDeComprobantes(pool).buscarPorId(datos.imagenId);
  if (imagen === null) throw new ErrorDeDominio('comprobante.no_encontrado', 422);
  if (imagen.tipo_mime === 'application/pdf') {
    throw new ErrorDeDominio('cuenta_de_cobro.imagen_invalida', 422);
  }
}

async function exigirNumeroLibre(
  repositorio: RepositorioDeCuentasDeCobro,
  banco: string,
  numeroCuenta: string | null,
  propia?: string,
): Promise<void> {
  if (numeroCuenta === null) return;
  const repetida = await repositorio.buscarPorNumero(banco, numeroCuenta);
  if (repetida !== null && repetida.id !== propia) {
    throw new ErrorDeDominio('cuenta_de_cobro.existente', 409);
  }
}

export async function crear(pool: Pool, datos: NuevaCuentaDeCobro): Promise<{ id: string }> {
  await exigirDatosDelMetodo(pool, datos);
  const cuentas = new RepositorioDeCuentasDeCobro(pool);
  await exigirNumeroLibre(cuentas, datos.banco, datos.numeroCuenta);
  const id = await enTransaccion(pool, (tx) => cuentas.crear(tx, datos));
  return { id };
}

export interface CambiosDeCuentaDeCobro {
  readonly banco?: string | undefined;
  readonly titular?: string | null | undefined;
  readonly numeroCuenta?: string | null | undefined;
  readonly tipoCuenta?: 'ahorro' | 'corriente' | null | undefined;
  readonly imagenId?: string | null | undefined;
  readonly nota?: string | null | undefined;
  readonly activo?: boolean | undefined;
}

/** Edita una cuenta: el método no cambia (se crea otra); lo que queda tiene que seguir siendo válido para su método. */
export async function editar(
  pool: Pool,
  id: string,
  cambios: CambiosDeCuentaDeCobro,
): Promise<void> {
  const cuentas = new RepositorioDeCuentasDeCobro(pool);
  const actual = await cuentas.buscarPorId(id);
  if (actual === null) throw new ErrorDeDominio('cuenta_de_cobro.no_encontrada', 404);

  const resultante = {
    metodo: actual.metodo,
    banco: cambios.banco ?? actual.banco,
    titular: cambios.titular === undefined ? actual.titular : cambios.titular,
    numeroCuenta: cambios.numeroCuenta === undefined ? actual.numero_cuenta : cambios.numeroCuenta,
    imagenId: cambios.imagenId === undefined ? actual.imagen_id : cambios.imagenId,
  };
  await exigirDatosDelMetodo(pool, resultante);
  await exigirNumeroLibre(cuentas, resultante.banco, resultante.numeroCuenta, id);

  const nuevos: Record<string, unknown> = {};
  if (cambios.banco !== undefined) nuevos.banco = cambios.banco;
  if (cambios.titular !== undefined) nuevos.titular = cambios.titular;
  if (cambios.numeroCuenta !== undefined) nuevos.numero_cuenta = cambios.numeroCuenta;
  if (cambios.tipoCuenta !== undefined) nuevos.tipo_cuenta = cambios.tipoCuenta;
  if (cambios.imagenId !== undefined) nuevos.imagen_id = cambios.imagenId;
  if (cambios.nota !== undefined) nuevos.nota = cambios.nota;
  if (cambios.activo !== undefined) nuevos.activo = cambios.activo ? 1 : 0;
  if (Object.keys(nuevos).length === 0) return;
  await enTransaccion(pool, (tx) => cuentas.editar(tx, id, nuevos));
}

export async function eliminar(pool: Pool, id: string): Promise<void> {
  const cuentas = new RepositorioDeCuentasDeCobro(pool);
  if ((await cuentas.buscarPorId(id)) === null) {
    throw new ErrorDeDominio('cuenta_de_cobro.no_encontrada', 404);
  }
  await enTransaccion(pool, (tx) => cuentas.eliminar(tx, id));
}
