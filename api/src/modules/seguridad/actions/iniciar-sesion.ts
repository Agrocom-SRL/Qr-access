import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccionConReintentos } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { verificarContraRelleno, verificarHash } from '../../../platform/seguridad/hash.js';
import { generarTokenOpaco, sha256Hex } from '../../../platform/seguridad/tokens.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import { type EstadoEfectivo } from '../domain/estado.js';
import { calcularIndiceDePin, normalizarPin, secretoDePin } from '../domain/pin.js';
import { rolUnico } from '../domain/rol-unico.js';
import { nombreDeDispositivoLimpio, type OrigenDeSesion } from '../domain/sesion.js';
import { cerrarLasQueSobran } from '../apertura-de-sesion.js';
import {
  RepositorioDeCuentas,
  RepositorioDeRolesDeUsuario,
  RepositorioDeSesiones,
  RepositorioDeUsuarios,
} from '../repository.js';
import { crearServicioDeUsuarios } from '../contracts.js';
import type { ServiciosDeSeguridad } from '../servicios.js';

export interface DatosDeIngreso extends OrigenDeSesion {
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
 * Suspendido no entra (se le dice por qué, ya con el PIN verificado); eliminado, ni siquiera: un superior
 * eliminado deja al usuario sin dueño y falla cerrado, como si el PIN no sirviera. Restringido sí entra.
 */
function exigirQuePuedaIngresar(efectivo: EstadoEfectivo, rechazar: () => never): void {
  if (efectivo.estado === 'eliminado') rechazar();
  if (efectivo.estado === 'suspendido') {
    throw new ErrorDeDominio(
      efectivo.origen === 'cuenta' ? 'sesion.cuenta_suspendida' : 'sesion.usuario_suspendido',
      403,
    );
  }
}

/**
 * Login por PIN (ADR 0018): con los 3 primeros caracteres se busca la cuenta y con los 4
 * restantes el usuario DENTRO de ella. Cualquier fallo responde lo mismo y gasta el mismo
 * tiempo; los fallos se cuentan por IP y por cuenta y llevan a un bloqueo creciente.
 *
 * Suspendido (él, un superior o su cuenta, ADR 0031 §0) no entra, pero solo se le dice DESPUÉS de
 * verificar el PIN, con `sesion.usuario_suspendido` o `sesion.cuenta_suspendida`: así un tercero no
 * descubre qué cuentas o usuarios existen. Restringido sí entra (conserva sesión y consulta).
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

  // Salto explícito del aislamiento (RepositorioDePlataforma): aún no sabemos la cuenta. Se trae en
  // cualquier estado: la suspensión se informa recién con el PIN verificado.
  const cuenta = await new RepositorioDeCuentas(servicios.pool).buscarPorCodigo(codigo);
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
    const servicioDeUsuarios = crearServicioDeUsuarios(servicios.pool);
    const indice = calcularIndiceDePin(servicios.config.PIN_PIMIENTA, cuenta.id, pin.sufijo);
    const usuario = await usuarios.buscarPorIndiceDePin(indice);
    const valido =
      usuario?.pin_hash == null
        ? await verificarContraRelleno(pin.completo)
        : await verificarHash(usuario.pin_hash, secretoDePin(cuenta.id, pin.sufijo));
    if (usuario === null || !valido) return rechazar(servicios, claves, datos.log);

    servicios.limitadorPorIp.registrarExito(claves.ip);

    // Lectura previa, sin bloqueo: solo para responder rápido. La decisión firme se toma dentro de la transacción.
    const efectivo = await servicioDeUsuarios.estadoEfectivoDe(usuario.id);
    exigirQuePuedaIngresar(efectivo, () => rechazar(servicios, claves, datos.log));

    const roles = await new RepositorioDeRolesDeUsuario(servicios.pool).rolesDe(usuario.id);
    const rolActivoId = rolUnico(roles.map((rol) => rol.id));
    const refresco = generarTokenOpaco(32);
    const instalacionId = datos.instalacionId ?? null;
    // Con el PIN ya verificado el autor de lo que sigue es este usuario: sin esto, los cierres por tope
    // (misma_instalacion, limite_*) quedarían en la bitácora sin autor.
    const sesionId = await ContextoCuenta.ejecutar({ ...contexto, usuarioId: usuario.id }, () =>
      enTransaccionConReintentos(servicios.pool, async (tx) => {
        // Bloquea cuenta y cadena del usuario y relee su estado AHORA: una suspensión confirmada entre la
        // lectura previa y este punto impide que nazca una sesión viva para un suspendido (invariante de
        // ADR 0031 §0). Es lo primero de la transacción: la foto de lo que sigue es posterior al bloqueo.
        const vigente = await servicioDeUsuarios.estadoEfectivoBloqueando(tx, usuario.id);
        exigirQuePuedaIngresar(vigente, () => rechazar(servicios, claves, datos.log));
        const sesiones = new RepositorioDeSesiones(servicios.pool);
        await cerrarLasQueSobran(
          sesiones,
          tx,
          { usuarioId: usuario.id, instalacionId },
          {
            maxPorUsuario: servicios.config.SESIONES_MAX_POR_USUARIO,
            maxPorInstalacion: servicios.config.SESIONES_MAX_POR_INSTALACION,
          },
          ahora,
        );
        return sesiones.crear(tx, {
          usuarioId: usuario.id,
          rolActivoId,
          refreshHash: sha256Hex(refresco),
          agente: datos.agente,
          ip: datos.ip,
          expiraAt: sumarDias(ahora, servicios.config.JWT_REFRESH_DIAS),
          instalacionId,
          plataforma: datos.plataforma ?? null,
          nombreDeDispositivo: nombreDeDispositivoLimpio(datos.dispositivo),
          ahora,
        });
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
