import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { verificarContraRelleno, verificarHash } from '../../../platform/seguridad/hash.js';
import { generarTokenOpaco, sha256Hex } from '../../../platform/seguridad/tokens.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import { calcularIndiceDePin, normalizarPin } from '../domain/pin.js';
import { decidirRolActivo } from '../domain/rol-activo.js';
import {
  RepositorioDeCuentas,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

export interface DatosDeIngreso {
  readonly pin: string;
  readonly ip: string;
  readonly agente: string | null;
  readonly log: { warn(objeto: object, mensaje: string): void };
}

export interface SesionIniciada {
  acceso: string;
  refresco: string;
  usuario: { id: string; etiqueta: string | null };
  cuenta: { id: string; codigo: string; nombre: string };
  roles: { id: string; nombre: string }[];
  rol_activo_id: string | null;
}

function rechazar(
  servicios: ServiciosDeSeguridad,
  claves: { ip: string; cuenta: string },
  log: DatosDeIngreso['log'],
): never {
  const bloqueoIp = servicios.limitadorPorIp.registrarFallo(claves.ip);
  const bloqueoCuenta = servicios.limitadorPorCuenta.registrarFallo(claves.cuenta);
  if (bloqueoIp || bloqueoCuenta) {
    // ADR 0018 §4: cada bloqueo deja rastro en el log, nunca con el PIN.
    log.warn({ evento: 'sesion.bloqueo', cuenta: claves.cuenta, ip: claves.ip }, 'login bloqueado');
  }
  throw new ErrorDeDominio('sesion.credenciales_invalidas', 401);
}

/**
 * Login por PIN (ADR 0018): con los 3 primeros caracteres se busca la cuenta y con los 4
 * restantes el usuario DENTRO de ella. Cualquier fallo responde lo mismo y gasta el mismo
 * tiempo; los fallos se cuentan por IP y por cuenta y llevan a un bloqueo creciente.
 */
export async function ejecutar(
  servicios: ServiciosDeSeguridad,
  datos: DatosDeIngreso,
  ahora: Date = new Date(),
): Promise<SesionIniciada> {
  const pin = normalizarPin(datos.pin);
  const codigo = pin?.codigoDeCuenta ?? '---';
  const claves = { ip: `${datos.ip}|${codigo}`, cuenta: codigo };

  const espera = Math.max(
    servicios.limitadorPorIp.segundosDeBloqueo(claves.ip),
    servicios.limitadorPorCuenta.segundosDeBloqueo(claves.cuenta),
  );
  if (espera > 0) {
    throw new ErrorDeDominio('sesion.bloqueada', 429, { reintentar_en_segundos: espera });
  }

  if (pin === null) {
    await verificarContraRelleno(datos.pin);
    return rechazar(servicios, claves, datos.log);
  }

  // Salto explícito del aislamiento (RepositorioDePlataforma): aún no sabemos la cuenta.
  const cuenta = await new RepositorioDeCuentas(servicios.pool).buscarActivaPorCodigo(codigo);
  if (cuenta === null) {
    await verificarContraRelleno(pin.completo);
    return rechazar(servicios, claves, datos.log);
  }

  const contexto = {
    cuentaId: cuenta.id,
    usuarioId: null,
    rolActivoId: null,
    dispositivoId: null,
    origen: 'api',
  } as const;

  return ContextoCuenta.ejecutar(contexto, async () => {
    const usuarios = new RepositorioDeUsuarios(servicios.pool);
    const indice = calcularIndiceDePin(servicios.config.PIN_PIMIENTA, cuenta.id, pin.sufijo);
    const usuario = await usuarios.buscarActivoPorIndiceDePin(indice);
    const valido =
      usuario?.pin_hash == null
        ? await verificarContraRelleno(pin.completo)
        : await verificarHash(usuario.pin_hash, pin.completo);
    if (usuario === null || !valido) return rechazar(servicios, claves, datos.log);

    servicios.limitadorPorIp.registrarExito(claves.ip);

    const roles = await new RepositorioDeRolesDeUsuario(servicios.pool).rolesDe(usuario.id);
    const rolActivoId = decidirRolActivo(
      roles.map((rol) => rol.id),
      usuario.rol_preferido_id,
    );
    const refresco = generarTokenOpaco(32);
    const sesionId = await enTransaccion(servicios.pool, (tx) =>
      new RepositorioDeSesiones(servicios.pool).crear(tx, {
        usuarioId: usuario.id,
        rolActivoId,
        refreshHash: sha256Hex(refresco),
        agente: datos.agente,
        ip: datos.ip,
        expiraAt: sumarDias(ahora, servicios.config.JWT_REFRESH_DIAS),
      }),
    );
    const acceso = await servicios.jwt.firmar({
      usuarioId: usuario.id,
      cuentaId: cuenta.id,
      sesionId,
      rolActivoId,
    });

    return {
      acceso,
      refresco,
      usuario: { id: usuario.id, etiqueta: usuario.etiqueta },
      cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
      roles: roles.map((rol) => ({ id: rol.id, nombre: rol.nombre })),
      rol_activo_id: rolActivoId,
    };
  });
}
