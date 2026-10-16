import { describe, expect, it } from 'vitest';
import { cargarConfig, ConfiguracionInvalida } from '../../src/config.js';

const SECRETO = 'x'.repeat(40);

describe('cargarConfig', () => {
  it('falla al arrancar si falta una variable, nombrándola sin mostrar valores', () => {
    const sinHost = {
      DB_DATABASE: 'x',
      DB_USERNAME: 'u',
      DB_PASSWORD: 'clave-secreta',
      JWT_SECRETO: SECRETO,
      PIN_PIMIENTA: SECRETO,
    };
    expect(() => cargarConfig(sinHost)).toThrow(ConfiguracionInvalida);
    expect(() => cargarConfig(sinHost)).toThrow(/DB_HOST/);
    try {
      cargarConfig({ ...sinHost, API_PORT: 'no-es-numero' });
    } catch (error) {
      expect(String(error)).not.toContain('clave-secreta');
      expect(String(error)).not.toContain('no-es-numero');
    }
  });

  it('aplica los valores por defecto', () => {
    const config = cargarConfig({
      DB_HOST: 'db',
      DB_DATABASE: 'x',
      DB_USERNAME: 'u',
      DB_PASSWORD: '',
      JWT_SECRETO: SECRETO,
      PIN_PIMIENTA: SECRETO,
    });
    expect(config).toMatchObject({
      API_PORT: 3000,
      DB_PORT: 3306,
      NODE_ENV: 'development',
      JWT_ACCESO_MINUTOS: 15,
      TRUST_PROXY: false,
    });
  });

  it('exige el secreto del JWT y la pimienta del PIN, sin mostrar su valor', () => {
    const base = { DB_HOST: 'db', DB_DATABASE: 'x', DB_USERNAME: 'u', DB_PASSWORD: '' };
    expect(() => cargarConfig(base)).toThrow(/JWT_SECRETO/);
    expect(() => cargarConfig({ ...base, JWT_SECRETO: 'corto', PIN_PIMIENTA: SECRETO })).toThrow(
      /JWT_SECRETO/,
    );
    expect(() => cargarConfig({ ...base, JWT_SECRETO: SECRETO })).toThrow(/PIN_PIMIENTA/);
  });
});
