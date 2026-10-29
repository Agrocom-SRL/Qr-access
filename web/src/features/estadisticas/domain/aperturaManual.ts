/** Cómo se usó la apertura manual desde la app (ADR 0035, HU-21): lo que ve AGROCOM en los últimos días. */
export interface AperturaManual {
  /** Cuántos días mira la ventana (hoy incluido). */
  dias: number;
  ordenadas: number;
  rechazadas: number;
  /** Aperturas por QR permitidas en la misma ventana, para comparar los dos caminos. */
  porQr: number;
  usuarios: number;
  cuentasQueLaUsaron: number;
  /** Cómo terminaron las órdenes según lo que informó la placa. */
  ejecucion: { ejecutadas: number; fallidas: number; sinConfirmacion: number };
  porPuerta: readonly {
    cuenta: { id: string; codigo: string; nombre: string };
    puerta: { id: string; nombre: string; sitio: string };
    total: number;
    rechazadas: number;
  }[];
  porCuenta: readonly {
    cuenta: { id: string; codigo: string; nombre: string };
    total: number;
    rechazadas: number;
    usuarios: number;
  }[];
  /** Un elemento por día de la ventana (`aaaa-mm-dd`), con ceros donde no hubo aperturas. */
  porDia: readonly { dia: string; ordenadas: number; rechazadas: number }[];
  /** Las 24 horas del día local (0–23). */
  porHora: readonly { hora: number; total: number }[];
  configuracion: {
    puertas: number;
    habilitadas: number;
    /** Habilitadas y con al menos una placa en servicio: las que de verdad ofrecen el botón. */
    disponibles: number;
    cuentas: number;
    cuentasConModoActivo: number;
  };
}

/** Qué parte de todas las aperturas (manuales y por QR) fue manual, de 0 a 100. Sin aperturas, 0. */
export function porcentajeManual(datos: Pick<AperturaManual, 'ordenadas' | 'porQr'>): number {
  const total = datos.ordenadas + datos.porQr;
  return total === 0 ? 0 : Math.round((datos.ordenadas / total) * 100);
}
