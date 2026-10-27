import type { Pool } from 'mysql2/promise';
import {
  crearServicioDePoliticaDeIncidentes,
  type PoliticaDeIncidentes,
} from '../../limites/contracts.js';

/**
 * La política de reincidencia que le aplica a la cuenta del contexto (ADR 0033 §4.5): cuántos confirmados en cuántos
 * días y si el sistema restringe solo. La cuenta la VE; la ajusta AGROCOM (configuración y excepciones por cuenta).
 */
export function ejecutar(pool: Pool): Promise<PoliticaDeIncidentes> {
  return crearServicioDePoliticaDeIncidentes(pool).politica();
}
