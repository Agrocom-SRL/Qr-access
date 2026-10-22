import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { bajarComprobante, subirComprobante } from '../../../shared/api/comprobantes';
import type {
  CuentaDeCobro,
  FormularioDeCuentaDeCobro,
  MetodoDeCobro,
  TipoDeCuenta,
} from '../domain/cuentaDeCobro';
import type { CobroRepositorio } from './CobroRepositorio';

interface CuentaDeCobroDto {
  id: string;
  metodo: MetodoDeCobro;
  banco: string;
  titular: string | null;
  numero_cuenta: string | null;
  tipo_cuenta: TipoDeCuenta | null;
  imagen_id: string | null;
  nota: string | null;
  activo: boolean;
}

export function cuentaDeCobroDesdeDto(dto: CuentaDeCobroDto): CuentaDeCobro {
  return {
    id: dto.id,
    metodo: dto.metodo,
    banco: dto.banco,
    titular: dto.titular,
    numeroCuenta: dto.numero_cuenta,
    tipoCuenta: dto.tipo_cuenta,
    imagenId: dto.imagen_id,
    nota: dto.nota,
    activo: dto.activo,
  };
}

/** Lo que cada método guarda: una cuenta bancaria no lleva imagen y un QR no lleva titular ni número. */
function camposDelMetodo(datos: FormularioDeCuentaDeCobro, imagenId: string | null) {
  return datos.metodo === 'transferencia'
    ? {
        titular: datos.titular.trim(),
        numero_cuenta: datos.numeroCuenta.trim(),
        tipo_cuenta: datos.tipoCuenta === '' ? null : datos.tipoCuenta,
      }
    : { imagen_id: imagenId };
}

/** Endpoints `/plataforma/cuentas-de-cobro` (módulo `suscripciones` de la API). */
export function crearCobroHttp(cliente: ClienteHttp): CobroRepositorio {
  const imagenDe = async (datos: FormularioDeCuentaDeCobro) =>
    datos.metodo === 'qr' && datos.imagen
      ? await subirComprobante(cliente, datos.imagen)
      : datos.imagenActualId;

  return {
    async listar() {
      const dto = await cliente.solicitar<{ datos: CuentaDeCobroDto[] }>({
        metodo: 'GET',
        ruta: '/plataforma/cuentas-de-cobro',
      });
      return dto.datos.map(cuentaDeCobroDesdeDto);
    },
    async crear(datos) {
      const imagenId = await imagenDe(datos);
      await cliente.solicitar({
        metodo: 'POST',
        ruta: '/plataforma/cuentas-de-cobro',
        cuerpo: {
          metodo: datos.metodo,
          banco: datos.banco.trim(),
          nota: datos.nota.trim(),
          ...(datos.metodo === 'qr' && imagenId !== null ? { imagen_id: imagenId } : {}),
          ...(datos.metodo === 'transferencia' ? camposDelMetodo(datos, null) : {}),
        },
      });
    },
    async editar(id, datos) {
      const imagenId = await imagenDe(datos);
      await cliente.solicitar({
        metodo: 'PATCH',
        ruta: `/plataforma/cuentas-de-cobro/${id}`,
        cuerpo: {
          banco: datos.banco.trim(),
          nota: datos.nota.trim(),
          ...camposDelMetodo(datos, imagenId),
        },
      });
    },
    async cambiarActivo(id, activo) {
      await cliente.solicitar({
        metodo: 'PATCH',
        ruta: `/plataforma/cuentas-de-cobro/${id}`,
        cuerpo: { activo },
      });
    },
    async eliminar(id) {
      await cliente.solicitar({ metodo: 'DELETE', ruta: `/plataforma/cuentas-de-cobro/${id}` });
    },
    verImagen: (imagenId) => bajarComprobante(cliente, imagenId),
  };
}
