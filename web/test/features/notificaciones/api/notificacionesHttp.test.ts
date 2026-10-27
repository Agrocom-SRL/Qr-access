import { crearNotificacionesHttp } from '@/features/notificaciones/api/notificacionesHttp';
import type { ClienteHttp } from '@/shared/api/clienteHttp';

function clienteFalso(respuesta?: unknown) {
  const solicitar = vi.fn<(solicitud: unknown) => Promise<unknown>>(() =>
    Promise.resolve(respuesta),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

const DTO = {
  id: '101',
  tipo: 'apertura.fallida',
  severidad: 'critica',
  cuenta_id: '1',
  cantidad: 2,
  resuelta: false,
  leida: false,
  datos: {
    cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
    sitio: { id: '10', nombre: 'Planta Warnes' },
    placas: [
      {
        dispositivo_id: '7',
        puerta_id: '3',
        puerta_nombre: 'Portón vehicular',
        desde: '2026-10-27T12:30:00.000Z',
        fallos: 3,
        causa: 'puerta_no_abrio',
      },
      {
        dispositivo_id: '8',
        puerta_id: '4',
        puerta_nombre: 'Depósito',
        desde: null,
        fallos: 1,
        causa: 'causa_nueva_de_la_api',
      },
    ],
  },
  novedad_at: '2026-10-27T12:35:00.000Z',
  creada_at: '2026-10-27T12:30:00.000Z',
};

describe('notificaciones por HTTP (contrato de la API)', () => {
  it('listar pide la bandeja con el filtro y la página, y mapea cada aviso', async () => {
    const { solicitar, cliente } = clienteFalso({
      datos: [DTO],
      meta: { pagina: 2, por_pagina: 10, total: 11 },
    });
    const pagina = await crearNotificacionesHttp(cliente).listar('no_leidas', 2);

    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/notificaciones',
      consulta: { estado: 'no_leidas', pagina: 2, por_pagina: 10 },
    });
    expect(pagina.pagina).toBe(2);
    expect(pagina.total).toBe(11);
    const [aviso] = pagina.elementos;
    expect(aviso).toMatchObject({
      id: '101',
      tipo: 'apertura.fallida',
      severidad: 'critica',
      leida: false,
      cuenta: { codigo: 'AGR' },
      sitio: { nombre: 'Planta Warnes' },
    });
    expect(aviso?.novedadEn).toEqual(new Date('2026-10-27T12:35:00.000Z'));
    expect(aviso?.placas[0]).toEqual({
      dispositivoId: '7',
      puertaId: '3',
      puertaNombre: 'Portón vehicular',
      desde: new Date('2026-10-27T12:30:00.000Z'),
      fallos: 3,
      causa: 'puerta_no_abrio',
    });
  });

  it('una causa que el panel no conoce no sale en el aviso', async () => {
    const { cliente } = clienteFalso({
      datos: [DTO],
      meta: { pagina: 1, por_pagina: 10, total: 1 },
    });
    const [aviso] = (await crearNotificacionesHttp(cliente).listar('todas', 1)).elementos;
    expect(aviso?.placas[1]?.causa).toBeNull();
    expect(aviso?.placas[1]?.desde).toBeNull();
  });

  it('el contador lee no_leidas; leer y descartar van a su ruta; leer todas devuelve cuántas', async () => {
    const contador = clienteFalso({ no_leidas: 4 });
    expect(await crearNotificacionesHttp(contador.cliente).noLeidas()).toBe(4);
    expect(contador.solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/notificaciones/contador',
    });

    const acciones = clienteFalso({ marcadas: 3 });
    const repositorio = crearNotificacionesHttp(acciones.cliente);
    await repositorio.leer('101');
    await repositorio.descartar('101');
    expect(await repositorio.leerTodas()).toBe(3);
    expect(acciones.solicitar.mock.calls.map(([s]) => s)).toEqual([
      { metodo: 'POST', ruta: '/plataforma/notificaciones/101/leer' },
      { metodo: 'POST', ruta: '/plataforma/notificaciones/101/descartar' },
      { metodo: 'POST', ruta: '/plataforma/notificaciones/leer-todas' },
    ]);
  });
});
