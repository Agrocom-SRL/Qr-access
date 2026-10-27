import { describe, expect, it } from 'vitest';
import { armarCsv, celdaCsv } from '../../src/modules/accesos/domain/csv.js';
import {
  resumirExportacion,
  TOPE_DE_FILAS_EXPORTABLES,
  tramoDe,
} from '../../src/modules/accesos/domain/exportacion.js';
import {
  agrupacionDePropuesta,
  claveDeGeneracionRuidosa,
  normalizarEvidencia,
  proponerAccion,
  puedeAplicarseSola,
  type EntradaDeReincidencia,
} from '../../src/modules/incidentes/domain/incidente.js';

const base: EntradaDeReincidencia = {
  tipoConfirmado: 'uso_masivo',
  confirmadosEnVentana: 1,
  minimo: 3,
  estadoPropio: 'activo',
};

describe('proponerAccion: de «caso raro» a baja (ADR 0033 §4.3)', () => {
  it('un incidente aislado nunca limita nada', () => {
    expect(proponerAccion(base)).toBeNull();
    expect(proponerAccion({ ...base, confirmadosEnVentana: 2 })).toBeNull();
  });

  it('al cruzar el umbral propone restringir (nivel leve)', () => {
    expect(proponerAccion({ ...base, confirmadosEnVentana: 3 })).toBe('restringir');
    expect(proponerAccion({ ...base, confirmadosEnVentana: 7 })).toBe('restringir');
  });

  it('nueva reincidencia estando restringido propone suspender', () => {
    expect(proponerAccion({ ...base, confirmadosEnVentana: 4, estadoPropio: 'restringido' })).toBe(
      'suspender',
    );
  });

  it('restringido pero sin reincidencia no propone nada', () => {
    expect(
      proponerAccion({ ...base, confirmadosEnVentana: 1, estadoPropio: 'restringido' }),
    ).toBeNull();
  });

  it('perdida_o_robo confirmado propone suspender y anular QR de inmediato, sin esperar el umbral', () => {
    expect(proponerAccion({ ...base, tipoConfirmado: 'perdida_o_robo' })).toBe(
      'suspender_y_anular',
    );
    expect(
      proponerAccion({ ...base, tipoConfirmado: 'perdida_o_robo', estadoPropio: 'restringido' }),
    ).toBe('suspender_y_anular');
  });

  it('a quien ya está suspendido no hay nada más grave que proponerle', () => {
    expect(
      proponerAccion({ ...base, confirmadosEnVentana: 9, estadoPropio: 'suspendido' }),
    ).toBeNull();
    expect(
      proponerAccion({ ...base, tipoConfirmado: 'perdida_o_robo', estadoPropio: 'suspendido' }),
    ).toBeNull();
  });
});

describe('puedeAplicarseSola: solo el nivel leve, y solo si la cuenta lo habilitó', () => {
  it('con la restricción automática apagada nada se aplica solo', () => {
    expect(puedeAplicarseSola('restringir', false, 'miembro')).toBe(false);
  });

  it('encendida, solo restringir', () => {
    expect(puedeAplicarseSola('restringir', true, 'miembro')).toBe(true);
    expect(puedeAplicarseSola('restringir', true, 'titular')).toBe(true);
    expect(puedeAplicarseSola('suspender', true, 'miembro')).toBe(false);
    expect(puedeAplicarseSola('suspender_y_anular', true, 'miembro')).toBe(false);
  });

  it('nunca a un Administrador: arrastraría a toda su rama', () => {
    expect(puedeAplicarseSola('restringir', true, 'administrador')).toBe(false);
  });
});

describe('piezas del incidente', () => {
  it('la evidencia se completa, sin repetidos, y no admite otras claves', () => {
    expect(normalizarEvidencia(undefined)).toEqual({
      qr_ids: [],
      evento_acceso_ids: [],
      evento_limite_ids: [],
    });
    expect(normalizarEvidencia({ qr_ids: ['1', '1', '2'] })).toEqual({
      qr_ids: ['1', '2'],
      evento_acceso_ids: [],
      evento_limite_ids: [],
    });
  });

  it('la clave de generación ruidosa es una por usuario y día UTC', () => {
    const manana = claveDeGeneracionRuidosa('7', new Date('2026-11-03T23:59:00Z'));
    expect(manana).toBe('generacion_ruidosa:7:2026-11-03');
    expect(claveDeGeneracionRuidosa('7', new Date('2026-11-04T00:01:00Z'))).not.toBe(manana);
    expect(agrupacionDePropuesta('7', 'restringir')).not.toBe(
      agrupacionDePropuesta('7', 'suspender'),
    );
  });
});

describe('CSV seguro (ADR 0033 §3)', () => {
  it('neutraliza las fórmulas: =, +, -, @ y el tabulador o retorno de carro al inicio', () => {
    expect(celdaCsv('=1+1')).toBe("'=1+1");
    expect(celdaCsv('+54')).toBe("'+54");
    expect(celdaCsv('-2+3')).toBe("'-2+3");
    expect(celdaCsv('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(celdaCsv('\t=x')).toBe("'\t=x");
    expect(celdaCsv('\r=x')).toContain("'");
    // Las variantes de ancho completo y con espacios delante también.
    expect(celdaCsv('＝1')).toBe("'＝1");
    expect(celdaCsv('  =1')).toBe("'  =1");
  });

  it('el HYPERLINK y los comandos de DDE quedan inertes', () => {
    const maligna = '=HYPERLINK("http://x.test","clic")';
    const celda = celdaCsv(maligna);
    expect(celda.startsWith('"\'=')).toBe(true);
    expect(celdaCsv("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
  });

  it('no toca lo que no es fórmula ni un número real', () => {
    expect(celdaCsv('Ana')).toBe('Ana');
    expect(celdaCsv('a=b')).toBe('a=b');
    expect(celdaCsv(-5)).toBe('-5');
    expect(celdaCsv(0)).toBe('0');
    expect(celdaCsv(true)).toBe('1');
    expect(celdaCsv(false)).toBe('0');
    expect(celdaCsv(null)).toBe('');
    expect(celdaCsv(undefined)).toBe('');
    expect(celdaCsv(new Date('2026-11-02T10:00:00.000Z'))).toBe('2026-11-02T10:00:00.000Z');
  });

  it('encierra y duplica las comillas; una coma o un salto no corren las columnas ni suman filas', () => {
    expect(celdaCsv('a,b')).toBe('"a,b"');
    expect(celdaCsv('di "hola"')).toBe('"di ""hola"""');
    expect(celdaCsv('uno\ndos')).toBe('"uno\ndos"');
    const csv = armarCsv(['a', 'b'], [['x,y', 'z\r\nw']]);
    expect(csv).toBe('a,b\r\n"x,y","z\r\nw"\r\n');
  });

  it('arma encabezado y filas con \\r\\n y un salto final', () => {
    expect(
      armarCsv(
        ['id', 'nombre'],
        [
          ['1', 'Ana'],
          ['2', '=2+2'],
        ],
      ),
    ).toBe("id,nombre\r\n1,Ana\r\n2,'=2+2\r\n");
    expect(armarCsv(['id'], [])).toBe('id\r\n');
  });
});

describe('tope de filas de la exportación', () => {
  it('la primera página empieza en 0 y la última se acorta para no pasar del tope', () => {
    expect(tramoDe(1, 500)).toEqual({ limite: 500, desplazamiento: 0 });
    expect(tramoDe(20, 500)).toEqual({ limite: 500, desplazamiento: 9_500 });
    expect(tramoDe(11, 1000)).toBeNull();
    expect(tramoDe(10, 1000)).toEqual({ limite: 1000, desplazamiento: 9_000 });
    // 10000 no es múltiplo de 3000: la 4.ª página trae solo lo que falta para el tope.
    expect(tramoDe(4, 3000)).toEqual({ limite: 1_000, desplazamiento: 9_000 });
    expect(tramoDe(5, 3000)).toBeNull();
  });

  it('resume el total exportable, si se truncó y si hay más páginas', () => {
    const tramo = { limite: 500, desplazamiento: 0 };
    expect(resumirExportacion(120, tramo, 120)).toEqual({
      total: 120,
      truncado: false,
      hayMas: false,
    });
    expect(resumirExportacion(900, tramo, 500)).toEqual({
      total: 900,
      truncado: false,
      hayMas: true,
    });
    const ultima = { limite: 500, desplazamiento: TOPE_DE_FILAS_EXPORTABLES - 500 };
    expect(resumirExportacion(50_000, ultima, 500)).toEqual({
      total: TOPE_DE_FILAS_EXPORTABLES,
      truncado: true,
      hayMas: false,
    });
  });
});
