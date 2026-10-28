import { crearContexto } from '../../../shared/lib/crearContexto';
import type { ExportacionesRepositorio } from '../api/ExportacionesRepositorio';

export const [ProveedorExportaciones, useExportacionesRepositorio] =
  crearContexto<ExportacionesRepositorio>('ExportacionesRepositorio');
