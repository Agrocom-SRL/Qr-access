import type { Plan, ResultadoDeRetiro } from '../domain/plan';

export interface DatosDePlan {
  nombre: string;
  cupoUsuarios: number;
  precioAnual: number;
}

export interface PlanesRepositorio {
  listar: () => Promise<readonly Plan[]>;
  /** Guarda varios precios de una vez: todos o ninguno. */
  crear: (datos: DatosDePlan) => Promise<void>;
  /** El cupo solo cambia si ninguna cuenta usa el plan (la API responde `plan.en_uso`). */
  editar: (id: string, cambios: Partial<DatosDePlan>) => Promise<void>;
  /** Lo saca de la venta; sigue valiendo para las cuentas que ya lo tienen. */
  retirar: (id: string) => Promise<ResultadoDeRetiro>;
}
