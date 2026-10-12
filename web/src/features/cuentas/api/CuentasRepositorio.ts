import type { Paginado } from '../../../shared/api/tipos';
import type { EstadoDeSuscripcion } from '../../../shared/api/estados';
import type { BorradorDeCuenta, DatosDeEmpresa } from '../domain/alta';
import type {
  ConteoPorEstado,
  CuentaResumen,
  DatosDePuerta,
  DatosDeSitio,
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
  /** `pendientePago` si no se registró el primer pago al crearla. */
  estado: EstadoDeSuscripcion;
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
  /** Corrige la razón social y los datos de la empresa y su persona responsable (no el código). */
  editar: (id: string, datos: Omit<DatosDeEmpresa, 'codigo'>) => Promise<void>;
  /** Da de baja la cuenta; hay que repetir su código para confirmar. */
  eliminar: (id: string, codigo: string) => Promise<void>;
  sitiosYPuertas: (id: string) => Promise<readonly SitioConPuertas[]>;
  crearSitio: (cuentaId: string, datos: DatosDeSitio) => Promise<void>;
  editarSitio: (
    cuentaId: string,
    sitioId: string,
    cambios: Partial<DatosDeSitio> & { activo?: boolean },
  ) => Promise<void>;
  eliminarSitio: (cuentaId: string, sitioId: string) => Promise<void>;
  crearPuerta: (cuentaId: string, sitioId: string, datos: DatosDePuerta) => Promise<void>;
  editarPuerta: (
    cuentaId: string,
    puertaId: string,
    cambios: Partial<DatosDePuerta> & { activa?: boolean },
  ) => Promise<void>;
  eliminarPuerta: (cuentaId: string, puertaId: string) => Promise<void>;
}
