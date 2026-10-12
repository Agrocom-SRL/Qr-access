import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import type { EventoBitacora } from '../../bitacora';
import type { EstadoRenovacion, Resumen } from '../domain/resumen';

type EstadoDto = 'activa' | 'por_vencer' | 'vencida' | 'suspendida';
const ESTADO: Readonly<Record<EstadoDto, EstadoRenovacion>> = {
  activa: 'activa',
  por_vencer: 'porVencer',
  vencida: 'vencida',
  suspendida: 'suspendida',
};

interface EventoDto {
  id: string;
  ocurrido_at: string;
  usuario: { id: string; nombre: string } | null;
  cuenta: { id: string; codigo: string } | null;
  accion: EventoBitacora['accion'];
  codigo: string;
  canal: EventoBitacora['canal'];
  antes: EventoBitacora['antes'];
  despues: EventoBitacora['despues'];
}

interface ResumenDto {
  actualizado_at: string;
  cuentas: { activas: number; total: number; por_vencer: number };
  usuarios: { en_uso: number; cupo_vendido: number };
  por_vencer_30: { cuentas: number; monto: number };
  ingresos_esperados: { monto: number };
  renovaciones: {
    cuenta: { id: string; codigo: string; nombre: string };
    vence_el: string;
    dias_restantes: number;
    monto: number;
    estado: EstadoDto;
  }[];
  ultimas_acciones: EventoDto[];
}

/** Endpoint `/plataforma/resumen` de la API (módulo `resumen`). */
export function crearResumenHttp(cliente: ClienteHttp): { obtener: () => Promise<Resumen> } {
  return {
    async obtener() {
      const dto = await cliente.solicitar<ResumenDto>({
        metodo: 'GET',
        ruta: '/plataforma/resumen',
      });
      return {
        actualizadoEn: new Date(dto.actualizado_at),
        cuentas: {
          activas: dto.cuentas.activas,
          total: dto.cuentas.total,
          porVencer: dto.cuentas.por_vencer,
        },
        usuarios: { enUso: dto.usuarios.en_uso, cupoVendido: dto.usuarios.cupo_vendido },
        porVencer30: dto.por_vencer_30,
        ingresosEsperados: dto.ingresos_esperados.monto,
        renovaciones: dto.renovaciones.map((r) => ({
          cuenta: r.cuenta,
          venceEl: new Date(r.vence_el),
          diasRestantes: r.dias_restantes,
          monto: r.monto,
          estado: ESTADO[r.estado],
        })),
        ultimasAcciones: dto.ultimas_acciones.map((e) => ({
          id: e.id,
          ocurridoEn: new Date(e.ocurrido_at),
          usuario: e.usuario,
          cuenta: e.cuenta,
          accion: e.accion,
          codigo: e.codigo,
          canal: e.canal,
          antes: e.antes,
          despues: e.despues,
        })),
      };
    },
  };
}
