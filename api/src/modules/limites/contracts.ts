import type { Pool } from 'mysql2/promise';
import { enTransaccion, type Transaccion } from '../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../platform/errores/error-de-dominio.js';
import {
  CLAVES,
  CLAVES_DE_APERTURA,
  CLAVES_DE_INCIDENTE,
  CLAVES_DE_MANUAL,
  CLAVES_DE_PLACA,
  CLAVES_DE_SENAL,
  valorEfectivo,
  type ClaveDeLimite,
  type ClaveDeApertura,
  type ClaveDeManual,
  type ClaveDePlaca,
} from './domain/claves.js';
import {
  RepositorioDeConfiguracion,
  RepositorioDeEventosDeLimite,
  RepositorioDeEventosDeLimiteDeTodas,
  RepositorioDeExcepciones,
  RepositorioDeExcepcionesDeTodas,
  RepositorioDeMarcasDeBolsaDeTodas,
  type TipoDeEventoDeLimite,
} from './repository.js';

/** Los topes que rigen para un usuario en este momento (ADR 0030 §2, ADR 0031 §9). */
export interface TopesDeGeneracion {
  /** QR que un usuario puede generar por día. */
  readonly topeDiario: number;
  /** QR vigentes sin usar que un usuario puede tener a la vez. */
  readonly topePendientes: number;
  /** Reemplazos de su QR propio sin uso por día (ADR 0030 §2.1). */
  readonly reemplazosSinUsoPorDia: number;
  /** Segundos de espera entre un reemplazo sin uso y el siguiente. */
  readonly esperaReemplazoSegundos: number;
  /** Puertas que puede abrir un solo QR. */
  readonly maxPuertasPorQr: number;
  /** QR que su cuenta puede generar por mes antes de que se avise (no corta). */
  readonly bolsaMensual: number;
  /** Porcentaje de la bolsa en que se avisa al propietario y a AGROCOM. */
  readonly bolsaAvisoPorcentaje: number;
}

/** Lo que el plan de la cuenta fija sobre estos topes; `null` = no lo fija y rige el valor general. */
export interface TopesDelPlan {
  readonly bolsaQrMensual: number | null;
  readonly maxPuertasPorQr: number | null;
}

/** Un rechazo por tope de generación, para dejarlo registrado (ADR 0030 §7). */
export interface RechazoDeGeneracion {
  readonly usuarioId: string;
  readonly tipo: 'qr.limite_diario' | 'qr.limite_pendientes' | 'qr.limite_propios_sin_uso';
  readonly valor: number;
  readonly tope: number;
  readonly ahora: Date;
}

/** Una marca de la bolsa mensual; `claveUnica` evita repetirla el mismo día (o el mismo mes). */
export interface MarcaDeBolsa {
  readonly tipo: 'bolsa.aviso' | 'bolsa.superada';
  readonly usuarioId: string;
  readonly valor: number;
  readonly tope: number;
  readonly claveUnica: string;
  readonly ahora: Date;
}

/** Los topes de la apertura manual que rigen para un usuario (ADR 0035 §7). */
export interface TopesDeAperturaManual {
  /** Segundos mínimos entre dos órdenes del mismo usuario sobre la misma puerta. */
  readonly enfriamientoSegundos: number;
  /** Órdenes que puede pedir por día local del sitio. */
  readonly topeDiario: number;
}

export interface ServicioDeLimites {
  /**
   * Los topes del usuario en la cuenta del contexto. Por cada clave rige, en este orden, la excepción del
   * usuario, la de su cuenta, lo que fija su plan (bolsa y puertas por QR) y el valor general de la
   * plataforma. Si el general de alguna clave falta, falla (cerrado): sin topes no se genera.
   */
  topesDe(usuarioId: string, plan: TopesDelPlan): Promise<TopesDeGeneracion>;
  /**
   * Los topes de la apertura manual del usuario en la cuenta del contexto, con la misma precedencia que los de
   * generación (excepción del usuario, de su cuenta, valor general). Falla cerrado si falta el valor general: sin
   * topes no se ordena abrir. Estos topes no tocan la validación de un QR.
   */
  topesDeAperturaManual(usuarioId: string): Promise<TopesDeAperturaManual>;
  /** Cuántos reemplazos sin uso hizo el usuario desde `desde` y cuándo fue el último. */
  reemplazosSinUso(
    tx: Transaccion,
    usuarioId: string,
    desde: Date,
  ): Promise<{ total: number; ultimo: Date | null }>;
  /** Anota que el usuario reemplazó su QR propio sin que se hubiera usado. */
  registrarReemplazoSinUso(tx: Transaccion, usuarioId: string, ahora: Date): Promise<void>;
  /**
   * Deja registrado un rechazo por tope. Va en su propia transacción: la generación rechazada ya se
   * deshizo y el rastro del rechazo tiene que sobrevivirle.
   */
  registrarRechazo(rechazo: RechazoDeGeneracion): Promise<void>;
  /** Registra una marca de la bolsa si no estaba ya; `true` si es nueva (ahí corresponde avisar). */
  marcarBolsa(tx: Transaccion, marca: MarcaDeBolsa): Promise<boolean>;
}

/**
 * El valor efectivo de una clave para un usuario: excepción del usuario, de su cuenta, lo que fija el plan y el valor
 * general. Falla cerrado (503 con código estable, ADR 0033: el nombre de la clave no sale) si el general no existe.
 */
async function valoresDe(
  pool: Pool,
  usuarioId: string,
): Promise<(clave: ClaveDeLimite | ClaveDeManual, dePlan?: number | null) => number> {
  const [generales, excepciones] = await Promise.all([
    new RepositorioDeConfiguracion(pool).listar(),
    new RepositorioDeExcepciones(pool).deUsuarioYDeCuenta(usuarioId),
  ]);
  const general = new Map(generales.map((fila) => [fila.clave, fila.valor]));
  return (clave, dePlan = null) => {
    const base = general.get(clave);
    if (base === undefined) throw new ErrorDeDominio('limite.configuracion_incompleta', 503);
    const deLaClave = excepciones.filter((fila) => fila.clave === clave);
    return valorEfectivo({
      deUsuario: deLaClave.find((fila) => fila.usuario_id === usuarioId)?.valor ?? null,
      deCuenta: deLaClave.find((fila) => fila.usuario_id === null)?.valor ?? null,
      dePlan,
      global: base,
    });
  };
}

export function crearServicioDeLimites(pool: Pool): ServicioDeLimites {
  const eventos = new RepositorioDeEventosDeLimite(pool);
  const evento = (tipo: TipoDeEventoDeLimite, datos: Omit<RechazoDeGeneracion, 'tipo'>) => ({
    usuarioId: datos.usuarioId,
    tipo,
    valor: datos.valor,
    tope: datos.tope,
    claveUnica: null,
    ocurridoAt: datos.ahora,
  });
  return {
    async topesDe(usuarioId, plan) {
      const valor = await valoresDe(pool, usuarioId);
      return {
        topeDiario: valor(CLAVES.topeDiario),
        topePendientes: valor(CLAVES.topePendientes),
        reemplazosSinUsoPorDia: valor(CLAVES.reemplazosSinUsoPorDia),
        esperaReemplazoSegundos: valor(CLAVES.esperaReemplazoSegundos),
        maxPuertasPorQr: valor(CLAVES.maxPuertasPorQr, plan.maxPuertasPorQr),
        bolsaMensual: valor(CLAVES.bolsaMensual, plan.bolsaQrMensual),
        bolsaAvisoPorcentaje: valor(CLAVES.bolsaAvisoPorcentaje),
      };
    },
    async topesDeAperturaManual(usuarioId) {
      const valor = await valoresDe(pool, usuarioId);
      return {
        enfriamientoSegundos: valor(CLAVES_DE_MANUAL.enfriamientoSegundos),
        topeDiario: valor(CLAVES_DE_MANUAL.topeDiario),
      };
    },
    reemplazosSinUso: (tx, usuarioId, desde) =>
      eventos.resumirDeUsuario(usuarioId, 'qr.reemplazo_sin_uso', desde, tx),
    async registrarReemplazoSinUso(tx, usuarioId, ahora) {
      await eventos.registrar(tx, {
        usuarioId,
        tipo: 'qr.reemplazo_sin_uso',
        valor: null,
        tope: null,
        claveUnica: null,
        ocurridoAt: ahora,
      });
    },
    async registrarRechazo(rechazo) {
      await enTransaccion(pool, async (tx) => {
        await eventos.registrar(tx, evento(rechazo.tipo, rechazo));
      });
    },
    marcarBolsa: (tx, marca) =>
      eventos.registrarUnica(tx, {
        usuarioId: marca.usuarioId,
        tipo: marca.tipo,
        valor: marca.valor,
        tope: marca.tope,
        claveUnica: marca.claveUnica,
        ocurridoAt: marca.ahora,
      }),
  };
}

/** Los umbrales con que se juzga si una placa dejó de reportar (ADR 0031 §18). */
export interface UmbralesDePlacaConfigurados {
  /** Sin latido por este tiempo: caída sostenida (aviso a AGROCOM y al propietario). */
  readonly caidaMinutos: number;
  /** Sin latido por este tiempo: desaparecida (aviso a AGROCOM). */
  readonly desaparecidaMinutos: number;
  /** Cuánto debe sostenerse la racha de latidos (o de lector respondiendo) para dar por recuperada una placa. */
  readonly recuperacionMinutos: number;
  /** Cuánto debe llevar el lector sin responder para avisar. */
  readonly lectorMinutos: number;
  /** Sin lecturas en la puerta por este tiempo, estando la placa en línea: en observación. */
  readonly observacionHoras: number;
}

/** Valores de partida (ADR 0031 §18 fija los 15 min y las 2 h; el resto son supuestos de la ola W9). */
export const UMBRALES_DE_PLACA_POR_DEFECTO: UmbralesDePlacaConfigurados = {
  caidaMinutos: 15,
  desaparecidaMinutos: 120,
  recuperacionMinutos: 3,
  lectorMinutos: 5,
  observacionHoras: 24,
};

export interface ServicioDeUmbralesDePlaca {
  /**
   * Los umbrales vigentes. A diferencia de los topes de QR, NO falla cerrado si falta una clave: sin umbral
   * rige el valor de partida (un aviso de más o de menos no abre ni cierra ninguna puerta). Si
   * «desaparecida» no es mayor que «caída», se corrige a caída + 1 minuto para que los escalones sigan en orden.
   */
  umbrales(): Promise<UmbralesDePlacaConfigurados>;
}

export function crearServicioDeUmbralesDePlaca(pool: Pool): ServicioDeUmbralesDePlaca {
  return {
    async umbrales() {
      const filas = await new RepositorioDeConfiguracion(pool).listar();
      const general = new Map(filas.map((fila) => [fila.clave, fila.valor]));
      const valor = (clave: ClaveDePlaca, porDefecto: number): number =>
        general.get(clave) ?? porDefecto;
      const base = UMBRALES_DE_PLACA_POR_DEFECTO;
      const caidaMinutos = valor(CLAVES_DE_PLACA.caidaMinutos, base.caidaMinutos);
      return {
        caidaMinutos,
        desaparecidaMinutos: Math.max(
          valor(CLAVES_DE_PLACA.desaparecidaMinutos, base.desaparecidaMinutos),
          caidaMinutos + 1,
        ),
        recuperacionMinutos: valor(CLAVES_DE_PLACA.recuperacionMinutos, base.recuperacionMinutos),
        lectorMinutos: valor(CLAVES_DE_PLACA.lectorMinutos, base.lectorMinutos),
        observacionHoras: valor(CLAVES_DE_PLACA.observacionHoras, base.observacionHoras),
      };
    },
  };
}

/** Los umbrales con que se juzga si la apertura de una puerta falla (ADR 0031 §18, ola W10). */
export interface UmbralesDeAperturaConfigurados {
  /** Segundos que se espera el informe de la placa antes de dar la apertura por `sin_confirmacion`. */
  readonly plazoConfirmacionSegundos: number;
  /** Cuántas aperturas fallidas en la ventana abren el aviso (un caso aislado no avisa). */
  readonly fallidasMinimo: number;
  /** Ventana, en minutos, en que se cuentan las aperturas fallidas. */
  readonly fallidasVentanaMinutos: number;
}

/** Valores de partida: supuestos de la ola W10 (el ADR dice «repetirse», no cuántas veces ni en cuánto tiempo). */
export const UMBRALES_DE_APERTURA_POR_DEFECTO: UmbralesDeAperturaConfigurados = {
  plazoConfirmacionSegundos: 90,
  fallidasMinimo: 2,
  fallidasVentanaMinutos: 60,
};

export interface ServicioDeUmbralesDeApertura {
  /** Los umbrales vigentes; como los de placa, no fallan cerrado: sin la clave rige el valor de partida. */
  umbrales(): Promise<UmbralesDeAperturaConfigurados>;
}

export function crearServicioDeUmbralesDeApertura(pool: Pool): ServicioDeUmbralesDeApertura {
  return {
    async umbrales() {
      const filas = await new RepositorioDeConfiguracion(pool).listar();
      const general = new Map(filas.map((fila) => [fila.clave, fila.valor]));
      const valor = (clave: ClaveDeApertura, porDefecto: number): number =>
        general.get(clave) ?? porDefecto;
      const base = UMBRALES_DE_APERTURA_POR_DEFECTO;
      return {
        plazoConfirmacionSegundos: valor(
          CLAVES_DE_APERTURA.plazoConfirmacionSegundos,
          base.plazoConfirmacionSegundos,
        ),
        fallidasMinimo: valor(CLAVES_DE_APERTURA.fallidasMinimo, base.fallidasMinimo),
        fallidasVentanaMinutos: valor(
          CLAVES_DE_APERTURA.fallidasVentanaMinutos,
          base.fallidasVentanaMinutos,
        ),
      };
    },
  };
}

/** La política de incidentes de uso que rige para una cuenta (ADR 0033 §4, ola W11). */
export interface PoliticaDeIncidentes {
  /** Incidentes CONFIRMADOS de un usuario, dentro de la ventana, a partir de los cuales hay reincidencia. */
  readonly reincidenciaMinimo: number;
  /** Ventana móvil, en días, en que se cuentan los confirmados. */
  readonly reincidenciaVentanaDias: number;
  /** Si el sistema restringe solo (nivel leve) al cruzar el umbral. Apagada por omisión; el nivel crítico nunca. */
  readonly restriccionAutomatica: boolean;
}

/** Valores de partida (supuestos de la ola W11: el ADR 0033 §4 da «por ejemplo, 3 en 30 días»). */
export const POLITICA_DE_INCIDENTES_POR_DEFECTO: PoliticaDeIncidentes = {
  reincidenciaMinimo: 3,
  reincidenciaVentanaDias: 30,
  restriccionAutomatica: false,
};

export interface ServicioDePoliticaDeIncidentes {
  /**
   * La política que rige para la cuenta del contexto: la excepción de la cuenta si la tiene y, si no, el valor
   * general. Como los demás umbrales, NO falla cerrado: sin clave rige el valor de partida (que no restringe solo).
   */
  politica(): Promise<PoliticaDeIncidentes>;
}

export function crearServicioDePoliticaDeIncidentes(pool: Pool): ServicioDePoliticaDeIncidentes {
  return {
    async politica() {
      const [generales, excepciones] = await Promise.all([
        new RepositorioDeConfiguracion(pool).listar(),
        new RepositorioDeExcepciones(pool).listar(),
      ]);
      const general = new Map(generales.map((fila) => [fila.clave, fila.valor]));
      const deLaCuenta = new Map(
        excepciones
          .filter((fila) => fila.usuario_id === null)
          .map((fila) => [fila.clave, fila.valor]),
      );
      const valor = (clave: string, porDefecto: number): number =>
        deLaCuenta.get(clave) ?? general.get(clave) ?? porDefecto;
      const base = POLITICA_DE_INCIDENTES_POR_DEFECTO;
      return {
        reincidenciaMinimo: valor(CLAVES_DE_INCIDENTE.reincidenciaMinimo, base.reincidenciaMinimo),
        reincidenciaVentanaDias: valor(
          CLAVES_DE_INCIDENTE.reincidenciaVentanaDias,
          base.reincidenciaVentanaDias,
        ),
        restriccionAutomatica: valor(CLAVES_DE_INCIDENTE.restriccionAutomatica, 0) === 1,
      };
    },
  };
}

/** Un usuario cuyos rechazos de generación por tope se repiten (señal de `generacion_ruidosa`). */
export interface UsuarioConRechazosRepetidos {
  readonly cuentaId: string;
  readonly usuarioId: string;
  readonly total: number;
  /** Los ids de los últimos rechazos (`eventos_de_limite`), más nuevos primero. */
  readonly eventoIds: readonly string[];
}

export interface ServicioDeRechazosRepetidos {
  /** Los umbrales de la detección (globales): cuántos rechazos y en cuántas horas. */
  umbrales(): Promise<{ readonly minimo: number; readonly ventanaHoras: number }>;
  /**
   * Quiénes, en CUALQUIER cuenta, tuvieron al menos `minimo` rechazos por tope desde `desde`. Es para el detector
   * del sistema (salto explícito del aislamiento, solo lectura): cada hallazgo se trata luego dentro de su cuenta.
   * Una página de `limite` hallazgos, ordenados por (cuenta, usuario), a continuación de `despuesDe` (`null` = desde
   * el principio): para recorrerlos todos con un cursor.
   */
  usuarios(
    desde: Date,
    minimo: number,
    limite: number,
    despuesDe?: { readonly cuentaId: string; readonly usuarioId: string } | null,
  ): Promise<UsuarioConRechazosRepetidos[]>;
}

export function crearServicioDeRechazosRepetidos(pool: Pool): ServicioDeRechazosRepetidos {
  return {
    async umbrales() {
      const filas = await new RepositorioDeConfiguracion(pool).listar();
      const general = new Map(filas.map((fila) => [fila.clave, fila.valor]));
      return {
        minimo: general.get(CLAVES_DE_INCIDENTE.rechazosGeneracionMinimo) ?? 5,
        ventanaHoras: general.get(CLAVES_DE_INCIDENTE.rechazosGeneracionVentanaHoras) ?? 24,
      };
    },
    async usuarios(desde, minimo, limite, despuesDe = null) {
      const filas = await new RepositorioDeEventosDeLimiteDeTodas(pool).rechazosRepetidos(
        desde,
        minimo,
        limite,
        despuesDe,
      );
      return filas.map((fila) => ({
        cuentaId: fila.tenant_id,
        usuarioId: fila.usuario_id,
        total: Number(fila.total),
        eventoIds: fila.ultimos_ids.split(','),
      }));
    },
  };
}

/** El nivel del usuario en el árbol de su cuenta (ADR 0028); el uso masivo tiene un N distinto por nivel. */
export type NivelParaUmbral = 'administrador' | 'titular' | 'miembro' | 'guardia';

/** Los umbrales con que se juzga si hay una señal de abuso (ADR 0030 §4 y §4.1, ola W12). */
export interface UmbralesDeSenal {
  /** Aperturas con QR propio en un día local por encima de las cuales hay uso masivo (más de N), por nivel. */
  readonly usoMasivo: Readonly<Record<NivelParaUmbral, number>>;
  /** Dos usos de un QR propio en sitios distintos con menos de estos minutos: uso imposible. */
  readonly usoImposibleEntreSitiosMinutos: number;
  /** Igual en dos puertas del MISMO sitio, en segundos; 0 = no se juzga. */
  readonly usoImposibleEntrePuertasSegundos: number;
  /** Ventana, en horas, de uso imposible, QR reenviado y PIN compartido. */
  readonly ventanaHoras: number;
  /** Rechazos `qr.usado` sobre un mismo QR a partir de los cuales se sospecha que se reenvió. */
  readonly qrReenviadoRechazosMinimo: number;
  /** IP distintas entre las sesiones activas de un usuario a partir de las cuales se sospecha PIN compartido. */
  readonly pinCompartidoIpsMinimo: number;
  /** Aperturas mínimas en un día para que el flujo de una cuenta pueda ser atípico. */
  readonly flujoAperturasMinimo: number;
  /** Aperturas por usuario activo en un día a partir de las cuales el flujo es atípico. */
  readonly flujoAperturasPorUsuario: number;
}

/** Valores de partida (supuestos de la ola W12: el ADR dice «N distinto por rol» y «muy por encima», no cuánto). */
export const UMBRALES_DE_SENAL_POR_DEFECTO: UmbralesDeSenal = {
  usoMasivo: { administrador: 40, titular: 30, miembro: 20, guardia: 12 },
  usoImposibleEntreSitiosMinutos: 10,
  usoImposibleEntrePuertasSegundos: 20,
  ventanaHoras: 24,
  qrReenviadoRechazosMinimo: 3,
  pinCompartidoIpsMinimo: 4,
  flujoAperturasMinimo: 50,
  flujoAperturasPorUsuario: 25,
};

function armarUmbrales(valor: (clave: string, porDefecto: number) => number): UmbralesDeSenal {
  const base = UMBRALES_DE_SENAL_POR_DEFECTO;
  return {
    usoMasivo: {
      administrador: valor(CLAVES_DE_SENAL.usoMasivoAdministrador, base.usoMasivo.administrador),
      titular: valor(CLAVES_DE_SENAL.usoMasivoTitular, base.usoMasivo.titular),
      miembro: valor(CLAVES_DE_SENAL.usoMasivoMiembro, base.usoMasivo.miembro),
      guardia: valor(CLAVES_DE_SENAL.usoMasivoGuardia, base.usoMasivo.guardia),
    },
    usoImposibleEntreSitiosMinutos: valor(
      CLAVES_DE_SENAL.usoImposibleEntreSitiosMinutos,
      base.usoImposibleEntreSitiosMinutos,
    ),
    usoImposibleEntrePuertasSegundos: valor(
      CLAVES_DE_SENAL.usoImposibleEntrePuertasSegundos,
      base.usoImposibleEntrePuertasSegundos,
    ),
    ventanaHoras: valor(CLAVES_DE_SENAL.ventanaHoras, base.ventanaHoras),
    qrReenviadoRechazosMinimo: valor(
      CLAVES_DE_SENAL.qrReenviadoRechazosMinimo,
      base.qrReenviadoRechazosMinimo,
    ),
    pinCompartidoIpsMinimo: valor(
      CLAVES_DE_SENAL.pinCompartidoIpsMinimo,
      base.pinCompartidoIpsMinimo,
    ),
    flujoAperturasMinimo: valor(CLAVES_DE_SENAL.flujoAperturasMinimo, base.flujoAperturasMinimo),
    flujoAperturasPorUsuario: valor(
      CLAVES_DE_SENAL.flujoAperturasPorUsuario,
      base.flujoAperturasPorUsuario,
    ),
  };
}

export interface ServicioDeUmbralesDeSenal {
  /** Los valores generales de la plataforma (sin excepciones). Como los demás umbrales, no fallan cerrado. */
  generales(): Promise<UmbralesDeSenal>;
  /**
   * Para la búsqueda de candidatos en TODAS las cuentas: por cada umbral, el valor más bajo entre el general y
   * cualquier excepción. Así una excepción que BAJA un umbral no deja a su cuenta sin revisar; cada hallazgo se
   * juzga luego con el umbral efectivo (`de`).
   */
  minimosEnLaPlataforma(): Promise<UmbralesDeSenal>;
  /**
   * Los umbrales que rigen en la cuenta del contexto: la excepción del usuario (si se pasa y la tiene), si no la de
   * la cuenta, si no el valor general.
   */
  de(usuarioId: string | null): Promise<UmbralesDeSenal>;
  /**
   * Los umbrales del flujo (aperturas mínimas y por usuario) que rigen en cada una de esas cuentas: su excepción si
   * la tiene, si no el valor general. Solo lectura, para la vista de AGROCOM.
   */
  flujoDeCuentas(
    cuentaIds: readonly string[],
  ): Promise<
    Map<string, { readonly aperturasMinimo: number; readonly aperturasPorUsuario: number }>
  >;
}

export function crearServicioDeUmbralesDeSenal(pool: Pool): ServicioDeUmbralesDeSenal {
  const generalesDe = async (): Promise<ReadonlyMap<string, number>> =>
    new Map((await new RepositorioDeConfiguracion(pool).listar()).map((f) => [f.clave, f.valor]));
  return {
    async generales() {
      const general = await generalesDe();
      return armarUmbrales((clave, porDefecto) => general.get(clave) ?? porDefecto);
    },
    async minimosEnLaPlataforma() {
      const [general, minimos] = await Promise.all([
        generalesDe(),
        new RepositorioDeExcepcionesDeTodas(pool).minimoPorClave(Object.values(CLAVES_DE_SENAL)),
      ]);
      return armarUmbrales((clave, porDefecto) => {
        const base = general.get(clave) ?? porDefecto;
        return Math.min(base, minimos.get(clave) ?? base);
      });
    },
    async flujoDeCuentas(cuentaIds) {
      const [general, minimos, porUsuario] = await Promise.all([
        generalesDe(),
        new RepositorioDeExcepcionesDeTodas(pool).deCuentas(
          CLAVES_DE_SENAL.flujoAperturasMinimo,
          cuentaIds,
        ),
        new RepositorioDeExcepcionesDeTodas(pool).deCuentas(
          CLAVES_DE_SENAL.flujoAperturasPorUsuario,
          cuentaIds,
        ),
      ]);
      const base = UMBRALES_DE_SENAL_POR_DEFECTO;
      const minimoGeneral =
        general.get(CLAVES_DE_SENAL.flujoAperturasMinimo) ?? base.flujoAperturasMinimo;
      const porUsuarioGeneral =
        general.get(CLAVES_DE_SENAL.flujoAperturasPorUsuario) ?? base.flujoAperturasPorUsuario;
      const deMinimo = new Map(minimos.map((fila) => [fila.tenant_id, fila.valor]));
      const dePorUsuario = new Map(porUsuario.map((fila) => [fila.tenant_id, fila.valor]));
      return new Map(
        cuentaIds.map((id) => [
          id,
          {
            aperturasMinimo: deMinimo.get(id) ?? minimoGeneral,
            aperturasPorUsuario: dePorUsuario.get(id) ?? porUsuarioGeneral,
          },
        ]),
      );
    },
    async de(usuarioId) {
      const [general, excepciones] = await Promise.all([
        generalesDe(),
        new RepositorioDeExcepciones(pool).listar(),
      ]);
      return armarUmbrales((clave, porDefecto) =>
        valorEfectivo({
          deUsuario:
            usuarioId === null
              ? null
              : (excepciones.find((f) => f.clave === clave && f.usuario_id === usuarioId)?.valor ??
                null),
          deCuenta:
            excepciones.find((f) => f.clave === clave && f.usuario_id === null)?.valor ?? null,
          dePlan: null,
          global: general.get(clave) ?? porDefecto,
        }),
      );
    },
  };
}

/** Una marca de la bolsa mensual (80 % o superada) tal como quedó en `eventos_de_limite`. */
export interface MarcaDeBolsaRegistrada {
  readonly id: string;
  readonly cuentaId: string;
  readonly usuarioId: string | null;
  readonly tipo: 'bolsa.aviso' | 'bolsa.superada';
  /** Cuántos QR llevaba la cuenta en el mes al marcar. */
  readonly valor: number | null;
  /** La bolsa que regía. */
  readonly tope: number | null;
  /** `bolsa.aviso:<aaaa-mm>` o `bolsa.superada:<aaaa-mm-dd>`. */
  readonly claveUnica: string | null;
  readonly ocurridoAt: Date;
}

export interface ServicioDeMarcasDeBolsa {
  /**
   * Las marcas de TODAS las cuentas desde `desde`, por id creciente, a continuación de `despuesDeId` (`null` =
   * desde el principio), de a `limite`. Solo lectura: es lo que el detector lleva a la bandeja.
   */
  desde(desde: Date, despuesDeId: string | null, limite: number): Promise<MarcaDeBolsaRegistrada[]>;
  /** La última marca de cada tipo desde `desde` por cuenta: cuándo avisó y cuándo se pasó. */
  ultimasDelMes(
    cuentaIds: readonly string[],
    desde: Date,
  ): Promise<Map<string, { avisoAt: Date | null; superadaAt: Date | null }>>;
}

export function crearServicioDeMarcasDeBolsa(pool: Pool): ServicioDeMarcasDeBolsa {
  const repositorio = new RepositorioDeMarcasDeBolsaDeTodas(pool);
  return {
    async desde(desde, despuesDeId, limite) {
      return (await repositorio.desde(desde, despuesDeId, limite)).map((fila) => ({
        id: fila.id,
        cuentaId: fila.tenant_id,
        usuarioId: fila.usuario_id,
        tipo: fila.tipo,
        valor: fila.valor,
        tope: fila.tope,
        claveUnica: fila.clave_unica,
        ocurridoAt: fila.ocurrido_at,
      }));
    },
    ultimasDelMes: (cuentaIds, desde) => repositorio.ultimasDelMes(cuentaIds, desde),
  };
}

/** De dónde sale la bolsa que rige para una cuenta (precedencia del ADR 0030 §2.1.1). */
export type OrigenDeLaBolsa = 'excepcion' | 'plan' | 'general';

export interface BolsaDeCuenta {
  /** QR por mes; `null` solo si ni el plan ni la excepción la fijan y la base no se sembró con la general. */
  readonly tope: number | null;
  readonly origen: OrigenDeLaBolsa | null;
}

export interface ServicioDeBolsaDeCuentas {
  /**
   * La bolsa mensual que rige para cada una de esas cuentas, dado lo que fija el plan de cada una (`null` = no la
   * fija): excepción de la cuenta > plan > valor general. Y el porcentaje en que se avisa. Solo lectura.
   */
  de(planPorCuenta: ReadonlyMap<string, number | null>): Promise<{
    readonly avisoPorcentaje: number;
    readonly bolsas: Map<string, BolsaDeCuenta>;
  }>;
}

export function crearServicioDeBolsaDeCuentas(pool: Pool): ServicioDeBolsaDeCuentas {
  return {
    async de(planPorCuenta) {
      const [generales, excepciones] = await Promise.all([
        new RepositorioDeConfiguracion(pool).listar(),
        new RepositorioDeExcepcionesDeTodas(pool).deCuentas(CLAVES.bolsaMensual, [
          ...planPorCuenta.keys(),
        ]),
      ]);
      const general = new Map(generales.map((fila) => [fila.clave, fila.valor]));
      const deCuenta = new Map(excepciones.map((fila) => [fila.tenant_id, fila.valor]));
      const bolsas = new Map<string, BolsaDeCuenta>();
      for (const [cuentaId, dePlan] of planPorCuenta) {
        const deExcepcion = deCuenta.get(cuentaId);
        const base = general.get(CLAVES.bolsaMensual);
        if (deExcepcion !== undefined)
          bolsas.set(cuentaId, { tope: deExcepcion, origen: 'excepcion' });
        else if (dePlan !== null) bolsas.set(cuentaId, { tope: dePlan, origen: 'plan' });
        else if (base !== undefined) bolsas.set(cuentaId, { tope: base, origen: 'general' });
        else bolsas.set(cuentaId, { tope: null, origen: null });
      }
      return { avisoPorcentaje: general.get(CLAVES.bolsaAvisoPorcentaje) ?? 80, bolsas };
    },
  };
}
