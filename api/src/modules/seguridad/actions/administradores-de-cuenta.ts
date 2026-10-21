import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { aIsoONulo } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import { armarJerarquia, nivelDeRol } from '../domain/jerarquia.js';
import {
  RepositorioDeCuentasDePlataforma,
  RepositorioDeRoles,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { conPinNuevo } from './pin-nuevo.js';
import { regenerarPinDeUsuario, type PinGenerado } from './regenerar-pin.js';

export interface AdministradorDeCuenta {
  id: string;
  etiqueta: string | null;
  pin_generado_at: string | null;
  ultimo_ingreso_at: string | null;
}

async function cuentaODeLaPlataforma(pool: Pool, cuentaId: string) {
  const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  return cuenta;
}

/** Los administradores activos de una cuenta (A05a): a ellos AGROCOM les regenera el PIN si lo olvidan. */
export async function listar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
): Promise<AdministradorDeCuenta[]> {
  const cuenta = await cuentaODeLaPlataforma(pool, cuentaId);
  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const ids = await new RepositorioDeRolesDeUsuario(pool).idsDeAdministradores();
    const [usuarios, ingresos] = await Promise.all([
      new RepositorioDeUsuarios(pool).buscarPorIds(ids),
      new RepositorioDeSesiones(pool).ultimoIngresoDe(ids),
    ]);
    return usuarios.map((usuario) => ({
      id: usuario.id,
      etiqueta: usuario.etiqueta,
      pin_generado_at: aIsoONulo(usuario.pin_generado_at),
      ultimo_ingreso_at: aIsoONulo(ingresos.get(usuario.id) ?? null),
    }));
  });
}

/**
 * Regenera el PIN de un administrador de la cuenta. AGROCOM solo genera y restablece el PIN de los
 * administradores; ellos crean y regeneran los de sus usuarios (ADR 0023). Nadie conoce el PIN
 * anterior: el nuevo se muestra una sola vez y el anterior y sus sesiones dejan de servir.
 */
export async function regenerarPin(
  servicios: Pick<ServiciosDeSeguridad, 'pool' | 'config'>,
  principal: PrincipalPlataforma,
  cuentaId: string,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<PinGenerado> {
  const cuenta = await cuentaODeLaPlataforma(servicios.pool, cuentaId);
  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const administradores = await new RepositorioDeRolesDeUsuario(
      servicios.pool,
    ).idsDeAdministradores();
    // Un usuario que no es administrador de ESTA cuenta no existe para este endpoint.
    if (!administradores.includes(usuarioId))
      throw new ErrorDeDominio('usuario.no_encontrado', 404);
    return regenerarPinDeUsuario(servicios, cuenta, usuarioId, ahora);
  });
}

export interface AdministradorCreado {
  id: string;
  etiqueta: string;
  /** El PIN en claro existe solo en esta respuesta (invariante 6, ADR 0018 §3). */
  pin: string;
}

/**
 * Suma otro Administrador a una cuenta (ADR 0028 §1: una cuenta puede tener varios). Solo AGROCOM
 * crea Administradores. Cuenta en el cupo del plan como cualquier usuario, con un PIN sorteado (o
 * el sufijo elegido) que se muestra una sola vez; queda como raíz de su propia rama.
 */
export async function crear(
  servicios: Pick<ServiciosDeSeguridad, 'pool' | 'config'>,
  principal: PrincipalPlataforma,
  cuentaId: string,
  datos: { etiqueta: string; sufijo?: string },
  ahora: Date = new Date(),
): Promise<AdministradorCreado> {
  const { pool, config } = servicios;
  const cuenta = await cuentaODeLaPlataforma(pool, cuentaId);
  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const suscripcion = await crearServicioDeSuscripciones(pool).obtenerVigente(ahora);
    if (suscripcion === null) throw new ErrorDeDominio('suscripcion.vencida', 403);
    const usuarios = new RepositorioDeUsuarios(pool);
    if (
      suscripcion.maxUsuarios !== null &&
      (await usuarios.contarTodos()) >= suscripcion.maxUsuarios
    ) {
      throw new ErrorDeDominio('plan.limite_usuarios', 422, { maximo: suscripcion.maxUsuarios });
    }
    const rol = await new RepositorioDeRoles(pool).buscarActivoPorNombre('Administrador');
    if (rol === null) throw new ErrorDeDominio('rol.no_encontrado', 404);

    return enTransaccion(pool, async (tx) => {
      let id = '';
      const pin = await conPinNuevo(
        tx,
        cuenta,
        config.PIN_PIMIENTA,
        async (sorteo) => {
          id = await usuarios.crear(tx, {
            etiqueta: datos.etiqueta,
            superiorId: null,
            pinIndice: sorteo.indice,
            pinHash: sorteo.hash,
            ahora,
          });
        },
        datos.sufijo,
      );
      await new RepositorioDeRolesDeUsuario(pool).asignar(tx, id, rol.id);
      return { id, etiqueta: datos.etiqueta, pin };
    });
  });
}

export interface JerarquiaDeCuenta {
  administradores: {
    id: string;
    etiqueta: string | null;
    guardias: { id: string; etiqueta: string | null }[];
    titulares: { id: string; etiqueta: string | null; unidad: string | null; miembros: number }[];
  }[];
}

/**
 * El árbol de la cuenta para la ficha de AGROCOM (ADR 0028 §6): cada Administrador con sus Guardias
 * y Titulares. Sirve para ver cómo está armada la cuenta y para elegir qué reasignar.
 */
export async function verJerarquia(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
): Promise<JerarquiaDeCuenta> {
  const cuenta = await cuentaODeLaPlataforma(pool, cuentaId);
  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const filas = await new RepositorioDeUsuarios(pool).listarTodos();
    const ids = filas.map((fila) => fila.id);
    const [roles, unidades] = await Promise.all([
      new RepositorioDeRolesDeUsuario(pool).rolesDeVarios(ids),
      crearServicioDeOrganizacion(pool).unidadesDeTitulares(ids),
    ]);
    const arbol = armarJerarquia(
      filas.map((fila) => {
        const [rol] = roles.get(fila.id) ?? [];
        return {
          id: fila.id,
          etiqueta: fila.etiqueta,
          superiorId: fila.superior_id,
          nivel: rol === undefined ? null : nivelDeRol(rol.nombre),
        };
      }),
    );
    return {
      administradores: arbol.map((rama) => ({
        id: rama.id,
        etiqueta: rama.etiqueta,
        guardias: [...rama.guardias],
        titulares: rama.titulares.map((titular) => ({
          ...titular,
          unidad: unidades.get(titular.id)?.nombre ?? null,
        })),
      })),
    };
  });
}

/**
 * Mueve un Guardia o un Titular a otro Administrador de la misma cuenta (ADR 0028 §7). Es una
 * operación solo de AGROCOM: un Administrador nunca abre un camino hacia la rama de otro. Los
 * Miembros siguen a su Titular y la unidad con él; el cupo no cambia. Queda en la bitácora con el
 * super admin como autor (antes y después del vínculo superior).
 */
export async function reasignar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  datos: { usuarioId: string; administradorId: string },
): Promise<void> {
  const cuenta = await cuentaODeLaPlataforma(pool, cuentaId);
  await ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const usuarios = new RepositorioDeUsuarios(pool);
    const roles = new RepositorioDeRolesDeUsuario(pool);
    const usuario = await usuarios.buscarPorId(datos.usuarioId);
    if (usuario === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
    const administradores = await roles.idsDeAdministradores();
    if (!administradores.includes(datos.administradorId)) {
      throw new ErrorDeDominio('administrador.no_encontrado', 404);
    }
    const [rol] = await roles.rolesDe(usuario.id);
    const nivel = rol === undefined ? null : nivelDeRol(rol.nombre);
    // Solo un Guardia o un Titular se reasigna; un Miembro sigue a su Titular, no cambia de uno a otro.
    if (nivel !== 'guardia' && nivel !== 'titular') {
      throw new ErrorDeDominio('reasignacion.nivel_invalido', 422);
    }
    if (usuario.superior_id === datos.administradorId) {
      throw new ErrorDeDominio('reasignacion.mismo_administrador', 422);
    }
    await enTransaccion(pool, (tx) =>
      usuarios.cambiarSuperior(tx, usuario.id, datos.administradorId),
    );
  });
}
