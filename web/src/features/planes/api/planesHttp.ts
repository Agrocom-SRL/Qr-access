import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import type { Plan } from '../domain/plan';
import type { PlanesRepositorio } from './PlanesRepositorio';

interface PlanDto {
  id: string;
  nombre: string;
  cupo_usuarios: number | null;
  precio_anual: number;
  cuentas: number;
  usuarios_en_uso: number;
}

export function planDesdeDto(dto: PlanDto): Plan {
  return {
    id: dto.id,
    nombre: dto.nombre,
    cupoUsuarios: dto.cupo_usuarios,
    precioAnual: dto.precio_anual,
    cuentas: dto.cuentas,
    usuariosEnUso: dto.usuarios_en_uso,
  };
}

/** Endpoints `/plataforma/planes` de la API (módulo `suscripciones`). */
export function crearPlanesHttp(cliente: ClienteHttp): PlanesRepositorio {
  return {
    async listar() {
      const dto = await cliente.solicitar<{ datos: PlanDto[] }>({
        metodo: 'GET',
        ruta: '/plataforma/planes',
      });
      return dto.datos.map(planDesdeDto);
    },
    async crear(datos) {
      await cliente.solicitar({
        metodo: 'POST',
        ruta: '/plataforma/planes',
        cuerpo: {
          nombre: datos.nombre,
          cupo_usuarios: datos.cupoUsuarios,
          precio_anual: datos.precioAnual,
        },
      });
    },
    async editar(id, cambios) {
      await cliente.solicitar({
        metodo: 'PATCH',
        ruta: `/plataforma/planes/${id}`,
        cuerpo: {
          nombre: cambios.nombre,
          cupo_usuarios: cambios.cupoUsuarios,
          precio_anual: cambios.precioAnual,
        },
      });
    },
    async retirar(id) {
      const dto = await cliente.solicitar<{ resultado: 'retirado' | 'eliminado' }>({
        metodo: 'DELETE',
        ruta: `/plataforma/planes/${id}`,
      });
      return dto.resultado;
    },
    async guardarPrecios(cambios) {
      await cliente.solicitar({
        metodo: 'PUT',
        ruta: '/plataforma/planes/precios',
        cuerpo: {
          precios: cambios.map((c) => ({ plan_id: c.planId, precio_anual: c.precioAnual })),
        },
      });
    },
  };
}
