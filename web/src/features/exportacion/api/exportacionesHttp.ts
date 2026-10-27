import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import {
  consultaDeExportacion,
  type PaginaDeExportacion,
  type RecursoExportable,
  type ResumenDePagina,
} from '../domain/exportacion';
import type { ExportacionesRepositorio } from './ExportacionesRepositorio';

/**
 * El resumen de una página sale de sus cabeceras `X-*` (`x-pagina`, `x-total-filas`, `x-hay-mas`...), no del
 * cuerpo: el cuerpo es el CSV tal cual. Una cabecera ausente cuenta como cero o como falso.
 */
export function resumenDeCabeceras(cabeceras: Headers): ResumenDePagina {
  const numero = (nombre: string) => Number(cabeceras.get(nombre) ?? 0);
  return {
    pagina: numero('x-pagina'),
    porPagina: numero('x-por-pagina'),
    total: numero('x-total-filas'),
    filas: numero('x-filas'),
    hayMas: cabeceras.get('x-hay-mas') === 'true',
    truncado: cabeceras.get('x-truncado') === 'true',
  };
}

export function crearExportacionesHttp(cliente: ClienteHttp): ExportacionesRepositorio {
  return {
    async pagina(cuentaId, recurso: RecursoExportable, pedido) {
      // La respuesta cruda: el CSV va como blob y las cabeceras `X-*` dicen cuánto hay y si sigue.
      const respuesta = await cliente.solicitar<Response>({
        metodo: 'GET',
        ruta: `/plataforma/cuentas/${encodeURIComponent(cuentaId)}/exportaciones/${recurso}`,
        consulta: consultaDeExportacion(recurso, pedido.pagina, pedido.filtros),
        formato: 'respuesta',
      });
      const pagina: PaginaDeExportacion = {
        csv: await respuesta.blob(),
        resumen: resumenDeCabeceras(respuesta.headers),
      };
      return pagina;
    },
  };
}
