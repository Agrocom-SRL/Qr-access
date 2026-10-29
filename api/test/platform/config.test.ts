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
      QR_IDEMPOTENCIA_CLAVE: SECRETO,
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
      QR_IDEMPOTENCIA_CLAVE: SECRETO,
    });
    expect(config).toMatchObject({
      API_PORT: 3000,
      DB_PORT: 3306,
      NODE_ENV: 'development',
      JWT_ACCESO_MINUTOS: 15,
      TRUST_PROXY: 1,
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

  it('exige el secreto propio de la idempotencia de QR, de 32 caracteres o más', () => {
    const base = {
      DB_HOST: 'db',
      DB_DATABASE: 'x',
      DB_USERNAME: 'u',
      DB_PASSWORD: '',
      JWT_SECRETO: SECRETO,
      PIN_PIMIENTA: SECRETO,
    };
    expect(() => cargarConfig(base)).toThrow(/QR_IDEMPOTENCIA_CLAVE/);
    expect(() => cargarConfig({ ...base, QR_IDEMPOTENCIA_CLAVE: 'corto' })).toThrow(
      /QR_IDEMPOTENCIA_CLAVE/,
    );
    expect(cargarConfig({ ...base, QR_IDEMPOTENCIA_CLAVE: SECRETO }).QR_IDEMPOTENCIA_CLAVE).toBe(
      SECRETO,
    );
  });

  describe('límites, pools y tiempos (ADR 0030 §3, ADR 0032 §1)', () => {
    const base = {
      DB_HOST: 'db',
      DB_DATABASE: 'x',
      DB_USERNAME: 'u',
      DB_PASSWORD: '',
      JWT_SECRETO: SECRETO,
      PIN_PIMIENTA: SECRETO,
      QR_IDEMPOTENCIA_CLAVE: SECRETO,
    };

    it('trae los valores por defecto de los ADR', () => {
      expect(cargarConfig(base)).toMatchObject({
        DB_POOL_DISPOSITIVOS: 4,
        DB_POOL_APP: 6,
        DB_CONSULTA_MS_DISPOSITIVOS: 1500,
        PETICION_MS_DISPOSITIVOS: 2500,
        LIMITE_GENERAR_QR_POR_MINUTO: 10,
      });
    });

    it('exige consulta < petición < espera del firmware (3 s) y no arranca si se rompe', () => {
      expect(() => cargarConfig({ ...base, PETICION_MS_DISPOSITIVOS: '3000' })).toThrow(
        /PETICION_MS_DISPOSITIVOS/,
      );
      expect(() => cargarConfig({ ...base, DB_CONSULTA_MS_DISPOSITIVOS: '2500' })).toThrow(
        /DB_CONSULTA_MS_DISPOSITIVOS/,
      );
      expect(() => cargarConfig({ ...base, DB_ESPERA_MS_DISPOSITIVOS: '2600' })).toThrow(
        /DB_ESPERA_MS_DISPOSITIVOS/,
      );
    });

    it('el presupuesto de UN intento (espera + consulta) cabe en la petición, también en la app', () => {
      expect(() =>
        cargarConfig({
          ...base,
          DB_ESPERA_MS_DISPOSITIVOS: '1200',
          DB_CONSULTA_MS_DISPOSITIVOS: '1300',
        }),
      ).toThrow(/DB_ESPERA_MS_DISPOSITIVOS\+DB_CONSULTA_MS_DISPOSITIVOS/);
      expect(() => cargarConfig({ ...base, DB_CONSULTA_MS_APP: '15000' })).toThrow(
        /DB_CONSULTA_MS_APP/,
      );
      expect(() => cargarConfig({ ...base, DB_ESPERA_MS_APP: '15000' })).toThrow(
        /DB_ESPERA_MS_APP/,
      );
      expect(() =>
        cargarConfig({ ...base, DB_ESPERA_MS_APP: '8000', DB_CONSULTA_MS_APP: '8000' }),
      ).toThrow(/DB_ESPERA_MS_APP\+DB_CONSULTA_MS_APP/);
    });

    it('la petición larga de órdenes tiene su propio plazo y no rompe la regla de las demás rutas (ADR 0035 §2)', () => {
      expect(cargarConfig(base)).toMatchObject({
        ORDENES_ESPERA_MS: 20000,
        ORDENES_SONDEO_MS: 3000,
        PETICION_MS_ORDENES: 25000,
        // Las demás rutas del dispositivo conservan su tope de 2,5 s.
        PETICION_MS_DISPOSITIVOS: 2500,
      });
      // La regla `petición < 3 s` sigue valiendo para ellas aunque la de órdenes sea mucho mayor.
      expect(() => cargarConfig({ ...base, PETICION_MS_DISPOSITIVOS: '3000' })).toThrow(
        /PETICION_MS_DISPOSITIVOS/,
      );
    });

    it('espera de órdenes + la última consulta < petición de órdenes < espera del firmware (30 s)', () => {
      // La espera iguala o pasa la petición: la API cortaría la espera antes de poder contestar 204.
      expect(() => cargarConfig({ ...base, ORDENES_ESPERA_MS: '25000' })).toThrow(
        /ORDENES_ESPERA_MS\+PETICION_MS_ORDENES/,
      );
      // No cabe la espera más la última consulta con su espera por conexión (500 + 1500 ms).
      expect(() => cargarConfig({ ...base, ORDENES_ESPERA_MS: '23500' })).toThrow(
        /ORDENES_ESPERA_MS\+PETICION_MS_ORDENES/,
      );
      expect(() => cargarConfig({ ...base, PETICION_MS_ORDENES: '30000' })).toThrow(
        /PETICION_MS_ORDENES/,
      );
      expect(
        cargarConfig({
          ...base,
          ORDENES_ESPERA_MS: '600',
          PETICION_MS_ORDENES: '2000',
          DB_ESPERA_MS_DISPOSITIVOS: '100',
          DB_CONSULTA_MS_DISPOSITIVOS: '300',
        }),
      ).toMatchObject({ ORDENES_ESPERA_MS: 600, PETICION_MS_ORDENES: 2000 });
    });

    it('impone mínimos razonables', () => {
      expect(() => cargarConfig({ ...base, DB_POOL_DISPOSITIVOS: '1' })).toThrow(
        /DB_POOL_DISPOSITIVOS/,
      );
      expect(() => cargarConfig({ ...base, DB_POOL_APP: '1' })).toThrow(/DB_POOL_APP/);
      expect(() => cargarConfig({ ...base, PETICION_MS_DISPOSITIVOS: '400' })).toThrow(
        /PETICION_MS_DISPOSITIVOS/,
      );
      expect(() => cargarConfig({ ...base, LIMITE_VALIDACION_POR_MINUTO: '59' })).toThrow(
        /LIMITE_VALIDACION_POR_MINUTO/,
      );
      expect(() => cargarConfig({ ...base, LIMITE_FALLOS_AUTENTICACION_POR_MINUTO: '4' })).toThrow(
        /LIMITE_FALLOS_AUTENTICACION_POR_MINUTO/,
      );
      expect(cargarConfig({ ...base, LIMITE_VALIDACION_POR_MINUTO: '60' })).toMatchObject({
        LIMITE_VALIDACION_POR_MINUTO: 60,
      });
    });

    it('rechaza un límite que no es un entero positivo', () => {
      expect(() => cargarConfig({ ...base, LIMITE_LOGIN_POR_MINUTO: '0' })).toThrow(
        /LIMITE_LOGIN_POR_MINUTO/,
      );
    });
  });

  describe('TRUST_PROXY: saltos o redes, nunca un booleano a secas', () => {
    const base = {
      DB_HOST: 'db',
      DB_DATABASE: 'x',
      DB_USERNAME: 'u',
      DB_PASSWORD: '',
      JWT_SECRETO: SECRETO,
      PIN_PIMIENTA: SECRETO,
      QR_IDEMPOTENCIA_CLAVE: SECRETO,
    };
    const proxy = (valor: string) => cargarConfig({ ...base, TRUST_PROXY: valor }).TRUST_PROXY;

    it('por omisión confía en un salto', () => {
      expect(cargarConfig(base).TRUST_PROXY).toBe(1);
    });

    it('acepta un número de saltos, 0/false (sin proxy) y listas de IP/CIDR', () => {
      expect(proxy('2')).toBe(2);
      expect(proxy('0')).toBe(false);
      expect(proxy('false')).toBe(false);
      expect(proxy('10.0.0.0/8, 192.168.100.249')).toEqual(['10.0.0.0/8', '192.168.100.249']);
      expect(proxy('::1,uniquelocal')).toEqual(['::1', 'uniquelocal']);
    });

    it('rechaza `true`, demasiados saltos y redes mal formadas', () => {
      for (const invalido of [
        'true',
        '6',
        '-1',
        '1.5',
        'si',
        '10.0.0.0/33',
        '999.1.1.1',
        '1.1.1.1/',
        ',',
      ]) {
        expect(() => proxy(invalido), invalido).toThrow(/TRUST_PROXY/);
      }
    });
  });
});
