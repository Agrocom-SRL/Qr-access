import type { Pool } from 'mysql2/promise';
import type { Config } from '../../config.js';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { crearEmisorDeJwt, type EmisorDeJwt } from '../../platform/seguridad/jwt.js';
import { LimitadorDeIntentos } from '../../platform/seguridad/limitador-de-intentos.js';

/** Fallos seguidos que bloquean a una IP para un código de cuenta (ADR 0018 §4). */
export const FALLOS_POR_IP = 5;
/** Fallos que bloquean los intentos contra una cuenta, vengan de donde vengan. */
export const FALLOS_POR_CUENTA = 30;

export interface ServiciosDeSeguridad {
  readonly pool: Pool;
  readonly config: Config;
  readonly jwt: EmisorDeJwt;
  readonly limitadorPorIp: LimitadorDeIntentos;
  readonly limitadorPorCuenta: LimitadorDeIntentos;
}

/** Los límites son estado en memoria: una instancia por app, para que los tests no se contaminen. */
export function crearServiciosDeSeguridad({
  pool,
  config,
}: DependenciasDeModulo): ServiciosDeSeguridad {
  return {
    pool,
    config,
    jwt: crearEmisorDeJwt(config.JWT_SECRETO, config.JWT_ACCESO_MINUTOS),
    limitadorPorIp: new LimitadorDeIntentos({
      maxFallos: FALLOS_POR_IP,
      bloqueoBaseSegundos: 60,
      bloqueoMaximoSegundos: 3600,
    }),
    limitadorPorCuenta: new LimitadorDeIntentos({
      maxFallos: FALLOS_POR_CUENTA,
      bloqueoBaseSegundos: 60,
      bloqueoMaximoSegundos: 3600,
    }),
  };
}
