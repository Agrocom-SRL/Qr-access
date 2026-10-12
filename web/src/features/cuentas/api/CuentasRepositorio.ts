import type { Paginado } from '../../../shared/api/tipos';
import type { BorradorDeCuenta } from '../domain/alta';
import type {
  ConteoPorEstado,
  CuentaResumen,
  DetalleDeCuenta,
  FiltrosDeCuentas,
  SitioConPuertas,
} from '../domain/cuenta';

export interface ListadoDeCuentas extends Paginado<CuentaResumen> {
  conteos: ConteoPorEstado;
}

export interface DisponibilidadDeCodigo {
  formatoValido: boolean;
  disponible: boolean;
  /** Razón social de la cuenta que ya lo usa. */
  usadoPor: string | null;
  sugerencias: readonly string[];
}

/** Resultado del alta: el PIN en claro llega solo acá y no se guarda en ninguna caché. */
export interface CuentaCreada {
  cuenta: { id: string; codigo: string; nombre: string };
  administrador: { id: string; etiqueta: string; pin: string };
}

export interface AdministradorDeCuenta {
  id: string;
  etiqueta: string;
  pinGeneradoEn: Date | null;
  ultimoIngresoEn: Date | null;
}

export interface CuentasRepositorio {
  administradores: (cuentaId: string) => Promise<readonly AdministradorDeCuenta[]>;
  /** Sortea un PIN nuevo; llega en claro una sola vez y no se guarda en ninguna caché. */
  regenerarPin: (cuentaId: string, usuarioId: string) => Promise<string>;
  /** Cambia las 3 primeras letras del PIN de todos los usuarios de la cuenta. */
  cambiarCodigo: (cuentaId: string, codigo: string) => Promise<void>;
  listar: (filtros: FiltrosDeCuentas) => Promise<ListadoDeCuentas>;
  codigoDisponible: (codigo: string, razonSocial: string) => Promise<DisponibilidadDeCodigo>;
  crear: (borrador: BorradorDeCuenta) => Promise<CuentaCreada>;
  obtener: (id: string) => Promise<DetalleDeCuenta>;
  sitiosYPuertas: (id: string) => Promise<readonly SitioConPuertas[]>;
}
