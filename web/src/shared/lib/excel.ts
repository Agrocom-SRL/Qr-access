import type { Workbook } from 'exceljs';
import { color } from '../../theme/theme';

export type CeldaExcel = string | number | Date | null;

export interface ColumnaExcel {
  encabezado: string;
  /** Formato de número de Excel (`#,##0.00`, `dd/mm/yyyy`); sin él, se deja como viene. */
  formato?: string;
  alineacion?: 'left' | 'center' | 'right';
}

export interface DefinicionDeLibro {
  hoja: string;
  columnas: readonly ColumnaExcel[];
  filas: readonly (readonly CeldaExcel[])[];
}

/** Tamaño de la letra del libro: más grande que el 11 que trae Excel por defecto. */
export const TAMANO_DE_FUENTE = 13;
const ANCHO_MINIMO = 12;
const ANCHO_MAXIMO = 48;
/** Excel mide el ancho en caracteres; la letra grande necesita un poco más de aire. */
const MARGEN_DE_ANCHO = 4;

/** Un color `#rrggbb` del tema en el ARGB que pide Excel (`FFrrggbb`). */
function argb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

function textoDe(celda: CeldaExcel): string {
  if (celda === null) return '';
  if (celda instanceof Date) return 'dd/mm/aaaa';
  return String(celda);
}

/** El ancho de cada columna sale de su contenido más largo (encabezado incluido), entre un mínimo y un tope. */
export function anchosDeColumnas(def: DefinicionDeLibro): number[] {
  return def.columnas.map((columna, i) => {
    const mayor = Math.max(
      columna.encabezado.length,
      ...def.filas.map((fila) => textoDe(fila[i] ?? null).length),
    );
    return Math.min(ANCHO_MAXIMO, Math.max(ANCHO_MINIMO, mayor + MARGEN_DE_ANCHO));
  });
}

/**
 * Arma el libro de Excel: cabeceras en el verde de la marca con letra blanca en negrita, letra de
 * 13 en todo el libro, ancho por columna según su contenido, filas alternadas en verde suave,
 * encabezado fijo y filtros. Se importa `exceljs` al usarlo para no cargarlo con el resto del panel.
 */
export async function construirLibro(def: DefinicionDeLibro): Promise<Workbook> {
  const { Workbook: LibroDeExcel } = await import('exceljs');
  const libro = new LibroDeExcel();
  const hoja = libro.addWorksheet(def.hoja, { views: [{ state: 'frozen', ySplit: 1 }] });
  const anchos = anchosDeColumnas(def);
  const claro = color.claro;

  hoja.columns = def.columnas.map((columna, i) => ({
    header: columna.encabezado,
    key: `c${String(i)}`,
    width: anchos[i] ?? ANCHO_MINIMO,
    style: {
      font: { name: 'Calibri', size: TAMANO_DE_FUENTE },
      alignment: { vertical: 'middle', horizontal: columna.alineacion ?? 'left' },
      ...(columna.formato ? { numFmt: columna.formato } : {}),
    },
  }));
  for (const [n, fila] of def.filas.entries()) {
    const agregada = hoja.addRow([...fila]);
    agregada.height = 24;
    if (n % 2 === 1) {
      agregada.eachCell((celda) => {
        celda.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: argb(claro.primarioSuave) },
        };
      });
    }
  }

  const cabecera = hoja.getRow(1);
  cabecera.height = 30;
  cabecera.eachCell((celda, i) => {
    celda.font = {
      name: 'Calibri',
      size: TAMANO_DE_FUENTE,
      bold: true,
      color: { argb: argb(claro.sobrePrimario) },
    };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(claro.primario) } };
    celda.alignment = {
      vertical: 'middle',
      horizontal: def.columnas[i - 1]?.alineacion ?? 'left',
    };
  });
  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: def.columnas.length },
  };
  return libro;
}

/** Baja el libro como `.xlsx`; sin `URL.createObjectURL` (tests, navegadores raros) no hace nada. */
export async function descargarExcel(nombre: string, def: DefinicionDeLibro): Promise<void> {
  if (typeof URL.createObjectURL !== 'function') return;
  const libro = await construirLibro(def);
  const bytes = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
