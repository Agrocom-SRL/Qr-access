import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { crearServicioDeSuscripciones } from '../../suscripciones/contracts.js';
import { nivelDeRol, puedeCrear } from '../domain/jerarquia.js';
import { presentarUsuarios, type UsuarioListado } from '../presentacion.js';
import {
  RepositorioDeCuentas,
  RepositorioDeRolesDeUsuario,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';
import { nivelDelActor } from './nivel-del-actor.js';
import { conPinNuevo } from './pin-nuevo.js';
import { exigirRolesAsignables } from './roles-asignables.js';

export interface DatosDeNuevoUsuario {
  /** A quién se le entrega el PIN (ADR 0018 §2). */
  readonly etiqueta: string;
  /** Exactamente uno: el rol define el nivel del usuario en el árbol (ADR 0028 §2). */
  readonly rolIds: readonly string[];
  /** Los 4 caracteres del PIN si el administrador los eligió; si no, los sortea el servidor. */
  readonly sufijo?: string;
  /** Obligatoria para un Titular (su unidad nace con él) y prohibida para los demás. */
  readonly unidad?: { readonly sitioId: string; readonly nombre: string };
}

export interface UsuarioCreado extends UsuarioListado {
  /** El PIN en claro: existe solo en esta respuesta (invariante 6). */
  pin: string;
}

/**
 * Crea un usuario de la cuenta con un PIN sorteado por el servidor (HU-06, ADR 0018 §5):
 * dentro del límite `max_usuarios` del plan, con un rol que el actor pueda dar (D-19) y de un
 * nivel que le toque crear (Administrador → Titular y Guardia; Titular → Miembro, ADR 0028 §3).
 * El creado queda debajo del actor en el árbol. Un Titular nace con su unidad; un Titular puede
 * tener hasta `cuentas.max_miembros_por_titular` Miembros (ADR 0028 §6).
 */
export async function ejecutar(
  servicios: Pick<ServiciosDeSeguridad, 'pool' | 'config'>,
  principal: PrincipalUsuario,
  datos: DatosDeNuevoUsuario,
  ahora: Date = new Date(),
): Promise<UsuarioCreado> {
  const { pool } = servicios;
  const rolIds = [...new Set(datos.rolIds)];
  const roles = await exigirRolesAsignables(pool, principal, rolIds);
  const [rol] = roles;
  const nivelCreado = rol === undefined ? null : nivelDeRol(rol.nombre);
  if (!puedeCrear(await nivelDelActor(pool, principal), nivelCreado)) {
    throw new ErrorDeDominio('usuario.nivel_no_permitido', 403);
  }
  if (nivelCreado === 'titular' && datos.unidad === undefined) {
    throw new ErrorDeDominio('unidad.requerida', 422);
  }
  if (nivelCreado !== 'titular' && datos.unidad !== undefined) {
    throw new ErrorDeDominio('unidad.no_corresponde', 422);
  }

  const suscripcion = await crearServicioDeSuscripciones(pool).obtenerVigente(ahora);
  if (suscripcion === null) throw new ErrorDeDominio('suscripcion.vencida', 403);
  const usuarios = new RepositorioDeUsuarios(pool);
  if (
    suscripcion.maxUsuarios !== null &&
    (await usuarios.contarTodos()) >= suscripcion.maxUsuarios
  ) {
    throw new ErrorDeDominio('plan.limite_usuarios', 422, { maximo: suscripcion.maxUsuarios });
  }

  const cuenta = await new RepositorioDeCuentas(pool).buscarPorId(principal.cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('autenticacion.requerida', 401);
  if (
    nivelCreado === 'miembro' &&
    (await usuarios.contarDirectos(principal.usuarioId)) >= cuenta.max_miembros_por_titular
  ) {
    throw new ErrorDeDominio('plan.limite_miembros_por_titular', 422, {
      maximo: cuenta.max_miembros_por_titular,
    });
  }

  const { id, pin } = await enTransaccion(pool, async (tx) => {
    let usuarioId = '';
    const completo = await conPinNuevo(
      tx,
      cuenta,
      servicios.config.PIN_PIMIENTA,
      async (sorteo) => {
        usuarioId = await usuarios.crear(tx, {
          etiqueta: datos.etiqueta,
          superiorId: principal.usuarioId,
          pinIndice: sorteo.indice,
          pinHash: sorteo.hash,
          ahora,
        });
      },
      datos.sufijo,
    );
    const asignaciones = new RepositorioDeRolesDeUsuario(pool);
    for (const rolId of rolIds) await asignaciones.asignar(tx, usuarioId, rolId);
    if (datos.unidad !== undefined) {
      await crearServicioDeOrganizacion(pool).crearUnidad(tx, {
        sitioId: datos.unidad.sitioId,
        nombre: datos.unidad.nombre,
        titularId: usuarioId,
      });
    }
    return { id: usuarioId, pin: completo };
  });

  const fila = await usuarios.buscarPorId(id);
  if (fila === null) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  const [presentado] = await presentarUsuarios(pool, [fila]);
  if (presentado === undefined) throw new ErrorDeDominio('usuario.no_encontrado', 404);
  return { ...presentado, pin };
}
