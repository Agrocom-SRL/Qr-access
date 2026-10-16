import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { inicioDelDia, sumarMeses } from '../../../platform/tiempo/fechas.js';
import {
  crearServicioDeSuscripcionesDePlataforma,
  type EstadoDeSuscripcion,
} from '../../suscripciones/contracts.js';
import { normalizarCodigoDeCuenta } from '../domain/cuentas.js';
import { ROLES_BASE } from '../domain/roles-base.js';
import {
  RepositorioDeCuentasDePlataforma,
  RepositorioDeDatosDeEmpresa,
  RepositorioDePermisos,
  RepositorioDeRolesDeUsuario,
  RepositorioDeRolPermisos,
  RepositorioDeRoles,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { conPinNuevo } from './pin-nuevo.js';

export interface DatosDeNuevaCuenta {
  readonly razonSocial: string;
  readonly codigo: string;
  readonly nit: string;
  readonly ciudad: string;
  readonly contactoNombre: string;
  readonly contactoTelefono: string;
  readonly contactoCorreo: string | null;
  readonly planId: string;
  /** `aaaa-mm-dd`: el día de inicio, en la zona de la plataforma. */
  readonly inicio: string;
  readonly administradorNombre: string;
  /** El primer pago, si ya se cobró: la cuenta nace activa. Sin él, nace pendiente de pago. */
  readonly pago?: {
    readonly monto: number;
    readonly fechaPago: string;
    readonly medio: 'transferencia' | 'deposito' | 'efectivo';
    readonly referencia: string;
    readonly banco?: string | undefined;
    readonly cuentaDestino?: string | undefined;
    readonly comprobanteId?: string | undefined;
  };
}

export interface CuentaCreada {
  cuenta: { id: string; codigo: string; nombre: string };
  /** El PIN en claro existe solo en esta respuesta (invariante 6, ADR 0018 §3). */
  administrador: { id: string; etiqueta: string; pin: string };
  suscripcion: { desde: string; hasta: string; estado: EstadoDeSuscripcion };
}

/**
 * Alta de una cuenta cliente (HU-01), todo o nada en una transacción: la cuenta con su código
 * inmutable, los datos de la empresa, los tres roles base, su suscripción de 12 meses y el primer
 * administrador con un PIN sorteado por el servidor. Se firma con el usuario del super admin.
 * Sin `pago`, la suscripción queda pendiente de su primer pago: la cuenta existe, el administrador
 * tiene su PIN, pero nada abre hasta registrar el pago de alta (cobranza).
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool' | 'config'>,
  principal: PrincipalPlataforma,
  datos: DatosDeNuevaCuenta,
): Promise<CuentaCreada> {
  const { pool, config } = servicios;
  const codigo = normalizarCodigoDeCuenta(datos.codigo);
  if (codigo === null) throw new ErrorDeDominio('cuenta.codigo_invalido', 422);

  const cuentas = new RepositorioDeCuentasDePlataforma(pool);
  const existente = await cuentas.buscarPorCodigo(codigo);
  if (existente !== null) {
    throw new ErrorDeDominio('cuenta.codigo_existente', 409, { cuenta: existente.nombre });
  }
  const suscripciones = crearServicioDeSuscripcionesDePlataforma(pool);
  if ((await suscripciones.buscarPlan(datos.planId)) === null) {
    throw new ErrorDeDominio('plan.no_encontrado', 404);
  }
  const desde = inicioDelDia(datos.inicio);
  const hasta = sumarMeses(desde, 12);
  const permisos = await new RepositorioDePermisos(pool).deAmbitoCuenta();

  return enTransaccion(pool, async (tx) => {
    const cuentaId = await cuentas.crear(tx, { nombre: datos.razonSocial, codigo });

    // Desde acá se opera DENTRO de la cuenta nueva: cada repositorio de cuenta filtra por ella.
    return ContextoCuenta.comoPlataformaEn(cuentaId, principal.usuarioId, async () => {
      await new RepositorioDeDatosDeEmpresa(pool).crear(tx, {
        nit: datos.nit,
        ciudad: datos.ciudad,
        contactoNombre: datos.contactoNombre,
        contactoTelefono: datos.contactoTelefono,
        contactoCorreo: datos.contactoCorreo,
      });

      const roles = new RepositorioDeRoles(pool);
      const rolPermisos = new RepositorioDeRolPermisos(pool);
      let rolAdministradorId = '';
      for (const base of ROLES_BASE) {
        const rolId = await roles.crear(tx, { nombre: base.nombre, protegido: base.protegido });
        if (base.protegido) rolAdministradorId = rolId;
        const codigos = base.permisos ?? [...permisos.keys()];
        for (const permiso of codigos) {
          const permisoId = permisos.get(permiso);
          if (permisoId !== undefined) await rolPermisos.asignar(tx, rolId, permisoId);
        }
      }

      const usuarios = new RepositorioDeUsuarios(pool);
      let administradorId = '';
      const pin = await conPinNuevo(
        tx,
        { id: cuentaId, codigo },
        config.PIN_PIMIENTA,
        async (sorteo) => {
          administradorId = await usuarios.crear(tx, {
            etiqueta: datos.administradorNombre,
            pinIndice: sorteo.indice,
            pinHash: sorteo.hash,
            ahora: new Date(),
          });
        },
      );
      await new RepositorioDeRolesDeUsuario(pool).asignar(tx, administradorId, rolAdministradorId);
      await suscripciones.crear(tx, {
        planId: datos.planId,
        desde,
        hasta,
        ...(datos.pago === undefined ? {} : { pago: datos.pago }),
      });

      return {
        cuenta: { id: cuentaId, codigo, nombre: datos.razonSocial },
        administrador: { id: administradorId, etiqueta: datos.administradorNombre, pin },
        suscripcion: {
          desde: desde.toISOString(),
          hasta: hasta.toISOString(),
          estado: datos.pago === undefined ? 'pendiente_pago' : 'activa',
        },
      };
    });
  });
}
