import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { verificarContraRelleno, verificarHash } from '../../../platform/seguridad/hash.js';
import { generarTokenOpaco, sha256Hex } from '../../../platform/seguridad/tokens.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import { normalizarUsername } from '../domain/super-admin.js';
import {
  RepositorioDeRolesDeSuperAdmin,
  RepositorioDeSesionesDeSuperAdmins,
  RepositorioDeSuperAdmins,
} from '../repository.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

export interface DatosDeIngresoDePlataforma {
  readonly usuario: string;
  readonly contrasena: string;
  readonly ip: string;
  readonly agente: string | null;
  readonly log: { warn(objeto: object, mensaje: string): void };
}

export interface SesionDePlataforma {
  acceso: string;
  refresco: string;
  usuario: { id: string; nombre: string | null; usuario: string };
  debe_cambiar_contrasena: boolean;
  permisos: string[];
}

/**
 * Login del super admin con usuario y contraseña (ADR 0004 §3). Cualquier fallo responde lo
 * mismo y gasta el mismo tiempo; los fallos se cuentan por IP y por usuario y llevan a un
 * bloqueo creciente (se responde `sesion.bloqueada` con la espera en segundos).
 */
export async function ejecutar(
  servicios: ServiciosDeSeguridad,
  datos: DatosDeIngresoDePlataforma,
  ahora: Date = new Date(),
): Promise<SesionDePlataforma> {
  const username = normalizarUsername(datos.usuario) ?? '---';
  const claves = { ip: `plataforma|${datos.ip}`, usuario: `plataforma|${username}` };

  const espera = Math.max(
    servicios.limitadorPorIp.segundosDeBloqueo(claves.ip),
    servicios.limitadorPorCuenta.segundosDeBloqueo(claves.usuario),
  );
  if (espera > 0) {
    throw new ErrorDeDominio('sesion.bloqueada', 429, { reintentar_en_segundos: espera });
  }

  const rechazar = (): never => {
    const bloqueoIp = servicios.limitadorPorIp.registrarFallo(claves.ip);
    const bloqueoUsuario = servicios.limitadorPorCuenta.registrarFallo(claves.usuario);
    if (bloqueoIp || bloqueoUsuario) {
      datos.log.warn(
        { evento: 'sesion.bloqueo', ambito: 'plataforma', ip: datos.ip },
        'login bloqueado',
      );
    }
    throw new ErrorDeDominio('sesion.credenciales_invalidas', 401);
  };

  const admin = await new RepositorioDeSuperAdmins(servicios.pool).buscarActivoPorUsername(
    username,
  );
  const valido =
    admin === null
      ? await verificarContraRelleno(datos.contrasena)
      : await verificarHash(admin.contrasena_hash, datos.contrasena);
  if (admin === null || !valido) return rechazar();

  servicios.limitadorPorIp.registrarExito(claves.ip);

  const refresco = generarTokenOpaco(32);
  const sesionId = await enTransaccion(servicios.pool, (tx) =>
    new RepositorioDeSesionesDeSuperAdmins(servicios.pool).crear(tx, {
      usuarioId: admin.id,
      refreshHash: sha256Hex(refresco),
      agente: datos.agente,
      ip: datos.ip,
      expiraAt: sumarDias(ahora, servicios.config.JWT_REFRESH_DIAS),
    }),
  );
  const acceso = await servicios.jwt.firmar({
    usuarioId: admin.id,
    cuentaId: null,
    sesionId,
    rolActivoId: null,
  });
  const permisos = await new RepositorioDeRolesDeSuperAdmin(servicios.pool).permisosDe(admin.id);

  return {
    acceso,
    refresco,
    usuario: { id: admin.id, nombre: admin.etiqueta, usuario: admin.username },
    debe_cambiar_contrasena: admin.contrasena_temporal === 1,
    permisos,
  };
}
