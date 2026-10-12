/** Tipos de la bitácora de la plataforma (A10, A05d). El `codigo` identifica el tipo de evento y se traduce. */

export type AccionBitacora = 'creado' | 'actualizado' | 'eliminado' | 'restaurado';
export const ACCIONES: readonly AccionBitacora[] = [
  'creado',
  'actualizado',
  'eliminado',
  'restaurado',
];

export type CanalBitacora = 'panel' | 'app' | 'automatico' | 'dispositivo';
export type ValoresDeEvento = Readonly<Record<string, string | number | boolean | null>>;

export interface EventoBitacora {
  id: string;
  ocurridoEn: Date;
  usuario: { id: string; nombre: string } | null;
  cuenta: { id: string; codigo: string } | null;
  accion: AccionBitacora;
  codigo: string;
  canal: CanalBitacora;
  antes: ValoresDeEvento | null;
  despues: ValoresDeEvento | null;
}

export interface FiltrosDeBitacora {
  cuentaId: string | null;
  accion: AccionBitacora | null;
  /** `aaaa-mm-dd`, o vacío. */
  desde: string;
  hasta: string;
  pagina: number;
}

export const POR_PAGINA_DE_BITACORA = 10;

export interface OpcionDeCuenta {
  id: string;
  codigo: string;
  nombre: string;
}
