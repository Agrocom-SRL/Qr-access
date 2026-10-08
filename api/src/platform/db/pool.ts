import mysql, { type Pool } from 'mysql2/promise';

export interface OpcionesBase {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

/**
 * Pool de mysql2 con las reglas de ADR 0002: placeholders `?` (sin nombrados ni varias
 * sentencias por llamada), fechas en UTC y BIGINT/DECIMAL como string.
 */
export function crearPool(opciones: OpcionesBase): Pool {
  return mysql.createPool({
    ...opciones,
    charset: 'utf8mb4_0900_ai_ci',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    namedPlaceholders: false,
    multipleStatements: false,
    connectionLimit: 10,
  });
}
