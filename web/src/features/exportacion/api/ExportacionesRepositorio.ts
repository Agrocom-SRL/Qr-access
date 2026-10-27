import type {
  FiltrosDeExportacion,
  PaginaDeExportacion,
  RecursoExportable,
} from '../domain/exportacion';

/** Lo que `application` necesita para bajar una página de datos de una cuenta (solo super admin). */
export interface ExportacionesRepositorio {
  pagina: (
    cuentaId: string,
    recurso: RecursoExportable,
    pedido: { pagina: number; filtros: FiltrosDeExportacion },
  ) => Promise<PaginaDeExportacion>;
}
