import { describe, expect, it } from 'vitest';
import { estadoDelQr } from '../../src/modules/accesos/domain/estado-qr.js';
import {
  extraerToken,
  generarTokenQr,
  hashDeToken,
  textoDeQr,
} from '../../src/modules/accesos/domain/token-qr.js';
import {
  decidirAntesDeConsumir,
  motivoTrasConsumoFallido,
  type EntradaDeDecision,
} from '../../src/modules/accesos/domain/validacion.js';
import { finDelDiaLocal, vencimientoMaximo } from '../../src/modules/accesos/domain/vencimiento.js';
import {
  calcularIndiceDePin,
  generarSufijoDePin,
  normalizarPin,
} from '../../src/modules/seguridad/domain/pin.js';
import { decidirRolActivo } from '../../src/modules/seguridad/domain/rol-activo.js';

describe('PIN (ADR 0018)', () => {
  it('normaliza a mayúsculas y sin espacios', () => {
    expect(normalizarPin(' agr7k2q ')).toEqual({
      codigoDeCuenta: 'AGR',
      sufijo: '7K2Q',
      completo: 'AGR7K2Q',
    });
    expect(normalizarPin('A G R 7 K 2 Q')?.completo).toBe('AGR7K2Q');
  });

  it.each(['', 'AGR7K2', 'AGR7K2QQ', '1GR7K2Q', 'AÑR7K2Q', 'AGR-7K2', 'ıGR7K2Q', 'AGR7K2Q;'])(
    'rechaza %j',
    (entrada) => {
      expect(normalizarPin(entrada)).toBeNull();
    },
  );

  it('el índice depende de la cuenta y de la pimienta', () => {
    const pimienta = 'p'.repeat(32);
    const indice = calcularIndiceDePin(pimienta, '1', '7K2Q');
    expect(indice).toMatch(/^[0-9a-f]{64}$/);
    expect(calcularIndiceDePin(pimienta, '2', '7K2Q')).not.toBe(indice);
    expect(calcularIndiceDePin('q'.repeat(32), '1', '7K2Q')).not.toBe(indice);
    expect(calcularIndiceDePin(pimienta, '1', '7K2Q')).toBe(indice);
  });

  it('genera sufijos de 4 caracteres A-Z y 0-9', () => {
    for (let i = 0; i < 200; i += 1) expect(generarSufijoDePin()).toMatch(/^[A-Z0-9]{4}$/);
  });
});

describe('rol activo', () => {
  it('el único rol; el preferido si lo sigue teniendo; si no, ninguno', () => {
    expect(decidirRolActivo(['5'], null)).toBe('5');
    expect(decidirRolActivo(['5', '6'], '6')).toBe('6');
    expect(decidirRolActivo(['5', '6'], '7')).toBeNull();
    expect(decidirRolActivo(['5', '6'], null)).toBeNull();
    expect(decidirRolActivo([], '6')).toBeNull();
  });
});

describe('token del QR (ADR 0008)', () => {
  it('es de 128 bits, único y se arma como AQ1.<token>', () => {
    const token = generarTokenQr();
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(generarTokenQr()).not.toBe(token);
    expect(textoDeQr(token)).toBe(`AQ1.${token}`);
    expect(extraerToken(`AQ1.${token}`)).toBe(token);
  });

  it.each([
    '',
    'AQ1.',
    'AQ1.corto',
    `aq1.${'a'.repeat(22)}`,
    `AQ1.${'a'.repeat(21)}`,
    `AQ1.${'a'.repeat(23)}`,
    `AQ1.${'a'.repeat(21)}=`,
    ` AQ1.${'a'.repeat(22)}`,
  ])('no acepta %j', (texto) => {
    expect(extraerToken(texto)).toBeNull();
  });

  it('el hash es SHA-256 en hex y no revela el token', () => {
    const token = generarTokenQr();
    expect(hashDeToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeToken(token)).not.toContain(token);
    expect(hashDeToken(token)).toBe(hashDeToken(token));
  });
});

describe('estado del QR', () => {
  const ahora = new Date('2026-10-09T12:00:00Z');
  const futuro = new Date('2026-10-09T13:00:00Z');
  const pasado = new Date('2026-10-09T11:00:00Z');

  it('anulado > usado > vencido > vigente', () => {
    expect(estadoDelQr({ anuladoAt: null, usadoAt: null, venceAt: futuro }, ahora)).toBe('vigente');
    expect(estadoDelQr({ anuladoAt: null, usadoAt: null, venceAt: pasado }, ahora)).toBe('vencido');
    expect(estadoDelQr({ anuladoAt: null, usadoAt: pasado, venceAt: pasado }, ahora)).toBe('usado');
    expect(estadoDelQr({ anuladoAt: pasado, usadoAt: pasado, venceAt: pasado }, ahora)).toBe(
      'anulado',
    );
    expect(estadoDelQr({ anuladoAt: null, usadoAt: null, venceAt: ahora }, ahora)).toBe('vencido');
  });
});

describe('fin del día local (RF-05, invariante 7)', () => {
  it('La Paz (UTC-4): el día termina a las 04:00 UTC del día siguiente', () => {
    expect(finDelDiaLocal(new Date('2026-10-09T15:30:00Z'), 'America/La_Paz').toISOString()).toBe(
      '2026-10-10T04:00:00.000Z',
    );
  });

  it('cerca de la medianoche local cuenta el día local, no el de UTC', () => {
    // 02:00 UTC del 10 sigue siendo el 9 en La Paz (22:00)
    expect(finDelDiaLocal(new Date('2026-10-10T02:00:00Z'), 'America/La_Paz').toISOString()).toBe(
      '2026-10-10T04:00:00.000Z',
    );
    // 05:00 UTC del 10 ya es el 10 en La Paz (01:00)
    expect(finDelDiaLocal(new Date('2026-10-10T05:00:00Z'), 'America/La_Paz').toISOString()).toBe(
      '2026-10-11T04:00:00.000Z',
    );
  });

  it('respeta el horario de verano de otras zonas', () => {
    // Nueva York, fin del día antes del cambio a horario estándar (2026-11-01): UTC-4
    expect(finDelDiaLocal(new Date('2026-10-31T15:00:00Z'), 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
    // El día del cambio dura 25 h: la medianoche siguiente ya es UTC-5
    expect(finDelDiaLocal(new Date('2026-11-01T15:00:00Z'), 'America/New_York').toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });

  it('con varias zonas toma el fin de día más próximo y el plan lo puede recortar', () => {
    const ahora = new Date('2026-10-09T12:00:00Z');
    expect(
      vencimientoMaximo({
        ahora,
        zonasHorarias: ['America/La_Paz', 'Asia/Tokyo'],
        maxVigenciaHoras: null,
      }).toISOString(),
    ).toBe('2026-10-09T15:00:00.000Z'); // en Tokio el día termina a las 15:00 UTC
    expect(
      vencimientoMaximo({
        ahora,
        zonasHorarias: ['America/La_Paz'],
        maxVigenciaHoras: 2,
      }).toISOString(),
    ).toBe('2026-10-09T14:00:00.000Z');
    expect(
      vencimientoMaximo({ ahora, zonasHorarias: [], maxVigenciaHoras: null }).toISOString(),
    ).toBe('2026-10-10T04:00:00.000Z');
  });
});

describe('decisión de validación (pasos 3 a 6)', () => {
  const ahora = new Date('2026-10-09T12:00:00Z');
  const base: EntradaDeDecision = {
    qr: {
      anuladoAt: null,
      venceAt: new Date('2026-10-09T13:00:00Z'),
      puertaIds: ['1', '2'],
      emisorActivo: true,
    },
    puertaDelDispositivoId: '2',
    ahora,
    suscripcionVigente: true,
  };

  it('sin objeciones deja pasar al consumo', () => {
    expect(decidirAntesDeConsumir(base)).toBeNull();
  });

  it('cada objeción da su motivo', () => {
    expect(decidirAntesDeConsumir({ ...base, qr: { ...base.qr, anuladoAt: ahora } })).toBe(
      'qr.anulado',
    );
    expect(decidirAntesDeConsumir({ ...base, qr: { ...base.qr, emisorActivo: false } })).toBe(
      'qr.anulado',
    );
    expect(decidirAntesDeConsumir({ ...base, qr: { ...base.qr, venceAt: ahora } })).toBe(
      'qr.vencido',
    );
    expect(decidirAntesDeConsumir({ ...base, puertaDelDispositivoId: '3' })).toBe('qr.otra_puerta');
    expect(decidirAntesDeConsumir({ ...base, suscripcionVigente: false })).toBe(
      'suscripcion.vencida',
    );
  });

  it('respeta el orden del ADR: anulado antes que vencido, vencido antes que otra puerta, otra puerta antes que suscripción', () => {
    const todoMal: EntradaDeDecision = {
      qr: { anuladoAt: ahora, venceAt: ahora, puertaIds: [], emisorActivo: true },
      puertaDelDispositivoId: '9',
      ahora,
      suscripcionVigente: false,
    };
    expect(decidirAntesDeConsumir(todoMal)).toBe('qr.anulado');
    expect(decidirAntesDeConsumir({ ...todoMal, qr: { ...todoMal.qr, anuladoAt: null } })).toBe(
      'qr.vencido',
    );
    expect(
      decidirAntesDeConsumir({
        ...todoMal,
        qr: { ...todoMal.qr, anuladoAt: null, venceAt: new Date('2026-10-10T00:00:00Z') },
      }),
    ).toBe('qr.otra_puerta');
  });

  it('si el consumo falla, rechaza siempre: nunca abre', () => {
    const futuro = new Date('2026-10-10T00:00:00Z');
    expect(motivoTrasConsumoFallido(null, ahora)).toBe('qr.desconocido');
    expect(
      motivoTrasConsumoFallido({ anuladoAt: ahora, usadoAt: null, venceAt: futuro }, ahora),
    ).toBe('qr.anulado');
    expect(
      motivoTrasConsumoFallido({ anuladoAt: null, usadoAt: ahora, venceAt: futuro }, ahora),
    ).toBe('qr.usado');
    expect(
      motivoTrasConsumoFallido({ anuladoAt: null, usadoAt: null, venceAt: ahora }, ahora),
    ).toBe('qr.vencido');
    expect(
      motivoTrasConsumoFallido({ anuladoAt: null, usadoAt: null, venceAt: futuro }, ahora),
    ).toBe('qr.usado');
  });
});
