import {
  crearExportacionesHttp,
  resumenDeCabeceras,
} from '@/features/exportacion/api/exportacionesHttp';
import type { ClienteHttp, SolicitudHttp } from '@/shared/api/clienteHttp';
import { FILTROS_INICIALES_DE_EXPORTACION } from '@/features/exportacion/domain/exportacion';

function clienteFalso(respuesta: Response) {
  const solicitar = vi.fn<(solicitud: SolicitudHttp) => Promise<unknown>>(() =>
    Promise.resolve(respuesta),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

function respuestaCsv(cabeceras: Record<string, string>) {
  return new Response('codigo,nombre\nUSR1,Ana\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', ...cabeceras },
  });
}

describe('exportación por HTTP (ADR 0033 §3)', () => {
  it('lee el resumen de las cabeceras X-* y no del cuerpo', () => {
    const cabeceras = new Headers({
      'x-pagina': '2',
      'x-por-pagina': '1000',
      'x-total-filas': '2500',
      'x-filas': '1000',
      'x-hay-mas': 'true',
      'x-truncado': 'false',
    });
    expect(resumenDeCabeceras(cabeceras)).toEqual({
      pagina: 2,
      porPagina: 1000,
      total: 2500,
      filas: 1000,
      hayMas: true,
      truncado: false,
    });
  });

  it('una cabecera ausente cuenta como cero o como falso', () => {
    expect(resumenDeCabeceras(new Headers())).toEqual({
      pagina: 0,
      porPagina: 0,
      total: 0,
      filas: 0,
      hayMas: false,
      truncado: false,
    });
  });

  it('pide la página de la cuenta con su consulta y devuelve el CSV y el resumen', async () => {
    const { solicitar, cliente } = clienteFalso(
      respuestaCsv({
        'x-pagina': '1',
        'x-por-pagina': '1000',
        'x-total-filas': '1',
        'x-filas': '1',
        'x-hay-mas': 'false',
        'x-truncado': 'false',
      }),
    );
    const pagina = await crearExportacionesHttp(cliente).pagina('7', 'usuarios', {
      pagina: 1,
      filtros: FILTROS_INICIALES_DE_EXPORTACION,
    });
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/cuentas/7/exportaciones/usuarios',
      consulta: { pagina: 1, por_pagina: 1000 },
      formato: 'respuesta',
    });
    expect(pagina.resumen).toMatchObject({ pagina: 1, total: 1, filas: 1, hayMas: false });
    expect(pagina.csv.size).toBe(new Blob(['codigo,nombre\nUSR1,Ana\n']).size);
  });
});
