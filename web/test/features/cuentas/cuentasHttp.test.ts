import { crearCuentasHttp, detalleDesdeDto } from '@/features/cuentas/api/cuentasHttp';
import { BORRADOR_VACIO } from '@/features/cuentas/domain/alta';
import type { ClienteHttp } from '@/shared/api/clienteHttp';

/** Cliente falso que responde lo que se le pida y guarda cada solicitud en `enviadas`. */
function clienteFalso(respuesta?: unknown) {
  const enviadas: unknown[] = [];
  const solicitar = vi.fn((solicitud: unknown) => {
    enviadas.push(solicitud);
    return Promise.resolve(respuesta);
  });
  return { solicitar, enviadas, cliente: { solicitar } as unknown as ClienteHttp };
}

describe('cuentas por HTTP (contrato de la API)', () => {
  it('editar manda el apellido y deja vacíos los datos opcionales (la API los guarda como null)', async () => {
    const { solicitar, cliente } = clienteFalso();
    await crearCuentasHttp(cliente).editar('1', {
      razonSocial: ' Agroindustrial Norte ',
      nit: '',
      ciudad: 'La Paz',
      contactoNombre: 'Carla',
      contactoApellido: 'Méndez',
      contactoTelefono: '',
      contactoCorreo: '',
    });
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'PATCH',
      ruta: '/plataforma/cuentas/1',
      cuerpo: {
        razon_social: 'Agroindustrial Norte',
        nit: '',
        ciudad: 'La Paz',
        contacto_nombre: 'Carla',
        contacto_apellido: 'Méndez',
        contacto_telefono: '',
        contacto_correo: '',
      },
    });
  });

  it('crear sin NIT envía vacío y el administrador toma el nombre completo del responsable', async () => {
    const respuesta = {
      cuenta: { id: '77', codigo: 'AGU', nombre: 'Agrícola Guarayos' },
      administrador: { id: '88', etiqueta: 'Rodrigo Añez', pin: 'AGU1234' },
      suscripcion: { estado: 'pendiente_pago' },
    };
    const { enviadas, cliente } = clienteFalso(respuesta);
    const base = BORRADOR_VACIO('2026-10-12');
    await crearCuentasHttp(cliente).crear({
      ...base,
      empresa: {
        ...base.empresa,
        razonSocial: 'Agrícola Guarayos',
        codigo: 'AGU',
        ciudad: 'Ascensión de Guarayos',
        nit: '',
        contactoNombre: 'Rodrigo',
        contactoApellido: 'Añez',
      },
      planId: 'plan-1',
      vigencia: { inicio: '2026-10-12', administradorNombre: '', adminIgualAlResponsable: true },
    });
    expect(enviadas[0]).toMatchObject({
      metodo: 'POST',
      ruta: '/plataforma/cuentas',
      cuerpo: {
        nit: '',
        contacto_nombre: 'Rodrigo',
        contacto_apellido: 'Añez',
        administrador_nombre: 'Rodrigo Añez',
      },
    });
  });

  it('el detalle conserva NIT, teléfono y correo vacíos como null y separa el nombre del apellido', () => {
    const detalle = detalleDesdeDto({
      cuenta: {
        id: '1',
        codigo: 'AGR',
        nombre: 'Agroindustrial Norte',
        activa: true,
        cliente_desde: '2024-11-05T12:00:00Z',
      },
      empresa: {
        nit: null,
        ciudad: 'La Paz',
        contacto: 'Carla Méndez',
        contacto_nombre: 'Carla',
        contacto_apellido: 'Méndez',
        telefono: null,
        correo: null,
      },
      suscripcion: null,
      uso: {
        usuarios_activos: 0,
        sitios: 0,
        puertas: 0,
        dispositivos_sin_conexion: 0,
        administradores: 0,
      },
    });
    expect(detalle.empresa).toEqual({
      nit: null,
      ciudad: 'La Paz',
      contacto: 'Carla Méndez',
      contactoNombre: 'Carla',
      contactoApellido: 'Méndez',
      telefono: null,
      correo: null,
    });
  });
});
