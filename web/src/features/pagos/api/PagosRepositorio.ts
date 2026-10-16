import type { Cobranza, FormularioDePago, TipoDePago, VentanaDeCobranza } from '../domain/pago';

export interface PagoRegistrado {
  periodoDesde: Date;
  periodoHasta: Date;
  /** Vencimiento de la suscripción después del pago. */
  venceEl: Date;
}

export interface PagosRepositorio {
  /** Registra un pago manual; una renovación extiende la vigencia 12 meses. */
  registrar: (
    cuentaId: string,
    tipo: TipoDePago,
    pago: Omit<FormularioDePago, 'monto'> & { monto: number },
  ) => Promise<PagoRegistrado>;
  cobranza: (consulta: { ventana: VentanaDeCobranza; busqueda: string }) => Promise<Cobranza>;
}
