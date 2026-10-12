import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import {
  crearServicioDeSuscripcionesDePlataforma,
  estadoDePago,
  type EstadoDeSuscripcion,
  type EstadoDePago,
} from '../../suscripciones/contracts.js';
import { RepositorioDeCuentasDePlataforma, RepositorioDeSuperAdmins } from '../repository.js';

export interface SuscripcionDeCuentaVista {
  cuenta: { id: string; codigo: string; nombre: string };
  suscripcion: {
    id: string;
    plan: { id: string; nombre: string; cupo_usuarios: number | null; precio_anual: number };
    desde: string;
    hasta: string;
    estado: EstadoDeSuscripcion;
    dias_restantes: number;
  };
  /** Estado del pago de la próxima renovación; `null` si la suscripción está suspendida. */
  proximo_pago: EstadoDePago | null;
  pagos: {
    id: string;
    tipo: 'alta' | 'renovacion' | 'mejora_de_plan';
    plan: string;
    monto: number;
    fecha_pago: string;
    medio: 'transferencia' | 'deposito' | 'efectivo';
    referencia: string;
    periodo_desde: string;
    periodo_hasta: string;
    registro: { id: string; nombre: string } | null;
  }[];
}

/** La pestaña "Suscripción" de una cuenta (A05b): resumen, próximo pago e historial de renovaciones y pagos. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  ahora: Date = new Date(),
): Promise<SuscripcionDeCuentaVista> {
  const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);

  const servicio = crearServicioDeSuscripcionesDePlataforma(pool);
  const { suscripcion, pagos } = await ContextoCuenta.comoPlataformaEn(
    cuenta.id,
    principal.usuarioId,
    async () => ({
      suscripcion: await servicio.deLaCuentaDelContexto(ahora),
      pagos: await servicio.pagosDeLaCuentaDelContexto(),
    }),
  );
  if (suscripcion === null) throw new ErrorDeDominio('suscripcion.no_encontrada', 404);

  const quienes = await new RepositorioDeSuperAdmins(pool).buscarPorIds([
    ...new Set(pagos.flatMap((pago) => (pago.registradoPor === null ? [] : [pago.registradoPor]))),
  ]);
  const nombres = new Map(quienes.map((q) => [q.id, q.etiqueta ?? q.username]));

  return {
    cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre },
    suscripcion: {
      id: suscripcion.id,
      plan: {
        id: suscripcion.plan.id,
        nombre: suscripcion.plan.nombre,
        cupo_usuarios: suscripcion.plan.cupoUsuarios,
        precio_anual: suscripcion.plan.precioAnual,
      },
      desde: suscripcion.desde.toISOString(),
      hasta: suscripcion.hasta.toISOString(),
      estado: suscripcion.estado,
      dias_restantes: suscripcion.diasRestantes,
    },
    proximo_pago: suscripcion.estado === 'suspendida' ? null : estadoDePago(suscripcion.estado),
    pagos: pagos.map((pago) => ({
      id: pago.id,
      tipo: pago.tipo,
      plan: pago.planNombre,
      monto: pago.monto,
      fecha_pago: pago.fechaPago,
      medio: pago.medio,
      referencia: pago.referencia,
      periodo_desde: pago.periodoDesde.toISOString(),
      periodo_hasta: pago.periodoHasta.toISOString(),
      registro:
        pago.registradoPor === null
          ? null
          : { id: pago.registradoPor, nombre: nombres.get(pago.registradoPor) ?? '—' },
    })),
  };
}
