import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeDispositivos } from '../../dispositivos/contracts.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import {
  crearServicioDeSuscripcionesDePlataforma,
  type EstadoDeSuscripcion,
} from '../../suscripciones/contracts.js';
import {
  RepositorioDeConteoDeUsuarios,
  RepositorioDeCuentasDePlataforma,
  RepositorioDeDatosDeEmpresa,
  RepositorioDeRolesDeUsuario,
} from '../repository.js';

export interface DetalleDeCuenta {
  cuenta: { id: string; codigo: string; nombre: string; activa: boolean; cliente_desde: string };
  empresa: {
    nit: string;
    ciudad: string;
    contacto: string;
    telefono: string;
    correo: string | null;
  } | null;
  suscripcion: {
    id: string;
    plan: { id: string; nombre: string; cupo_usuarios: number | null; precio_anual: number };
    desde: string;
    hasta: string;
    estado: EstadoDeSuscripcion;
    dias_restantes: number;
  } | null;
  uso: {
    usuarios_activos: number;
    sitios: number;
    puertas: number;
    dispositivos_sin_conexion: number;
    administradores: number;
  };
}

/**
 * La ficha de una cuenta para el super admin (A05a). Lee los datos de la cuenta entrando en
 * su contexto (ADR 0004 §7): sitios, puertas, dispositivos y administradores se consultan con
 * los repositorios de cuenta de cada módulo, nunca con SQL ajeno.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  ahora: Date = new Date(),
): Promise<DetalleDeCuenta> {
  const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);

  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const [empresa, suscripcion, estructura, sinConexion, administradores, usuarios] =
      await Promise.all([
        new RepositorioDeDatosDeEmpresa(pool).buscar(),
        crearServicioDeSuscripcionesDePlataforma(pool).deLaCuentaDelContexto(ahora),
        crearServicioDeOrganizacion(pool).contarSitiosYPuertas(),
        crearServicioDeDispositivos(pool).contarSinConexion(ahora),
        new RepositorioDeRolesDeUsuario(pool).contarAdministradores(),
        new RepositorioDeConteoDeUsuarios(pool).activosPorCuenta([cuenta.id]),
      ]);
    return {
      cuenta: {
        id: cuenta.id,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        activa: cuenta.activo === 1,
        cliente_desde: cuenta.created_at.toISOString(),
      },
      empresa:
        empresa === null
          ? null
          : {
              nit: empresa.nit,
              ciudad: empresa.ciudad,
              contacto: empresa.contacto_nombre,
              telefono: empresa.contacto_telefono,
              correo: empresa.contacto_correo,
            },
      suscripcion:
        suscripcion === null
          ? null
          : {
              id: suscripcion.id,
              plan: {
                id: suscripcion.plan.id,
                nombre: suscripcion.plan.nombre,
                cupo_usuarios: suscripcion.plan.cupoUsuarios,
                precio_anual: suscripcion.plan.precioAnual,
              },
              desde: suscripcion.desde.toISOString(),
              hasta: suscripcion.hasta.toISOString(),
              estado: suscripcion.estado,
              dias_restantes: suscripcion.diasRestantes,
            },
      uso: {
        usuarios_activos: usuarios.get(cuenta.id) ?? 0,
        sitios: estructura.sitios,
        puertas: estructura.puertas,
        dispositivos_sin_conexion: sinConexion,
        administradores,
      },
    };
  });
}
