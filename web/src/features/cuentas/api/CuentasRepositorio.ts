import type { Paginado } from '../../../shared/api/tipos';
import type { EstadoDeSuscripcion } from '../../../shared/api/estados';
import type { BorradorDeCuenta, DatosDeEmpresa } from '../domain/alta';
import type {
  ConteoPorEstado,
  CuentaResumen,
  DatosDePuerta,
  DatosDeSitio,
  DetalleDeCuenta,
  EstadisticasDeUsuarios,
  FiltrosDeCuentas,
  RamaDeAdministrador,
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

/** Un Administrador recién sumado: su PIN llega en claro una sola vez y no se guarda en ninguna caché. */
export interface AdministradorCreado {
  id: string;
  etiqueta: string;
  pin: string;
}

/** Lo que se puede cambiar al editar una cuenta (el código no, tiene su propio diálogo). */
export type CorreccionDeCuenta = Omit<DatosDeEmpresa, 'codigo'> & {
  /** Tope de Miembros por Titular (ADR 0028 §6); sin él, la cuenta conserva el que tiene. */
  maxMiembrosPorTitular?: number;
};

export interface CuentasRepositorio {
  /** Suma otro Administrador a la cuenta (solo AGROCOM, ADR 0028). */
  crearAdministrador: (
    cuentaId: string,
    datos: { etiqueta: string; sufijo?: string },
  ) => Promise<AdministradorCreado>;
  /** Inactivos, ruidosos y Titulares cerca del tope de la cuenta, con el cupo de cada rama. */
  estadisticasDeUsuarios: (cuentaId: string) => Promise<EstadisticasDeUsuarios>;
  /** El árbol de la cuenta: cada Administrador con sus Guardias y Titulares. */
  jerarquia: (cuentaId: string) => Promise<readonly RamaDeAdministrador[]>;
  /** Mueve un Guardia o un Titular (con su unidad y sus Miembros) a otro Administrador. */
  reasignar: (cuentaId: string, usuarioId: string, administradorId: string) => Promise<void>;
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
  editar: (id: string, datos: CorreccionDeCuenta) => Promise<void>;
  /** Da de baja la cuenta; hay que repetir su código para confirmar. */
  eliminar: (id: string, codigo: string) => Promise<void>;
  /** Restringe la cuenta: no genera QR nuevos, pero lo ya generado abre. El motivo es obligatorio. */
  restringir: (id: string, motivo: string) => Promise<void>;
  /** Suspende la cuenta: cierra todas las sesiones y anula los QR vigentes. El motivo es obligatorio. */
  suspender: (id: string, motivo: string) => Promise<void>;
  /** Vuelve la cuenta a activa. */
  reactivar: (id: string) => Promise<void>;
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
