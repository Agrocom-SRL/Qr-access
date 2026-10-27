import { crearSesionesHttp, sesionDesdeDto } from '@/features/sesiones/api/sesionesHttp';
import type { ClienteHttp, SolicitudHttp } from '@/shared/api/clienteHttp';

function clienteFalso(respuesta?: unknown) {
  const solicitar = vi.fn<(solicitud: SolicitudHttp) => Promise<unknown>>(() =>
    Promise.resolve(respuesta),
  );
  return { solicitar, cliente: { solicitar } as unknown as ClienteHttp };
}

const DTO = {
  id: '501',
  plataforma: 'ios',
  dispositivo: 'iPhone de Jorge',
  ip: '190.4.12.9',
  iniciada_at: '2026-10-27T11:00:00.000Z',
  ultima_actividad_at: '2026-10-27T12:30:00.000Z',
  expira_at: '2026-11-03T11:00:00.000Z',
  actual: false,
};

describe('sesiones por HTTP (ADR 0030 §4.1)', () => {
  it('mapea la sesión y las fechas; una plataforma desconocida no se inventa', () => {
    expect(sesionDesdeDto(DTO)).toMatchObject({
      id: '501',
      plataforma: 'ios',
      dispositivo: 'iPhone de Jorge',
      ip: '190.4.12.9',
    });
    expect(sesionDesdeDto(DTO).ultimaActividadEn).toEqual(new Date('2026-10-27T12:30:00.000Z'));
    expect(sesionDesdeDto({ ...DTO, plataforma: 'marciano' }).plataforma).toBeNull();
  });

  it('lista las sesiones del usuario de la cuenta en su ruta de plataforma', async () => {
    const { solicitar, cliente } = clienteFalso({ datos: [DTO] });
    const sesiones = await crearSesionesHttp(cliente).listar('7', '31');
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/cuentas/7/usuarios/31/sesiones',
    });
    expect(sesiones).toHaveLength(1);
  });

  it('cierra una sesión concreta con DELETE sobre su id', async () => {
    const { solicitar, cliente } = clienteFalso();
    await crearSesionesHttp(cliente).cerrar('7', '31', '501');
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'DELETE',
      ruta: '/plataforma/cuentas/7/usuarios/31/sesiones/501',
    });
  });

  it('cierra todas y devuelve cuántas cerró', async () => {
    const { solicitar, cliente } = clienteFalso({ cerradas: 3 });
    await expect(crearSesionesHttp(cliente).cerrarTodas('7', '31')).resolves.toBe(3);
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'DELETE',
      ruta: '/plataforma/cuentas/7/usuarios/31/sesiones',
    });
  });

  it('codifica los ids en la ruta para que no alteren el camino', async () => {
    const { solicitar, cliente } = clienteFalso({ datos: [] });
    await crearSesionesHttp(cliente).listar('7', '../3');
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/cuentas/7/usuarios/..%2F3/sesiones',
    });
  });
});
