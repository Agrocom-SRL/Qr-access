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

  it('editar manda el tope de Miembros solo si se indica', async () => {
    const { solicitar, cliente } = clienteFalso();
    const base = {
      razonSocial: 'Agroindustrial Norte',
      nit: '',
      ciudad: 'La Paz',
      contactoNombre: 'Carla',
      contactoApellido: 'Méndez',
      contactoTelefono: '',
      contactoCorreo: '',
    };
    await crearCuentasHttp(cliente).editar('1', { ...base, maxMiembrosPorTitular: 25 });
    await crearCuentasHttp(cliente).editar('1', base);
    const cuerpos = solicitar.mock.calls.map(
      ([solicitud]) => (solicitud as { cuerpo: Record<string, unknown> }).cuerpo,
    );
    expect(cuerpos[0]).toMatchObject({ max_miembros_por_titular: 25 });
    expect(cuerpos[1]).not.toHaveProperty('max_miembros_por_titular');
  });

  it('crearAdministrador manda el nombre limpio y el sufijo solo si se eligió', async () => {
    const { solicitar, cliente } = clienteFalso({ id: '9', etiqueta: 'Rosa Vaca', pin: 'AGR1234' });
    const creado = await crearCuentasHttp(cliente).crearAdministrador('1', {
      etiqueta: ' Rosa Vaca ',
    });
    await crearCuentasHttp(cliente).crearAdministrador('1', { etiqueta: 'Rosa', sufijo: 'AB12' });
    await crearCuentasHttp(cliente).crearAdministrador('1', { etiqueta: 'Rosa', sufijo: '' });
    expect(creado).toEqual({ id: '9', etiqueta: 'Rosa Vaca', pin: 'AGR1234' });
    expect(solicitar).toHaveBeenNthCalledWith(1, {
      metodo: 'POST',
      ruta: '/plataforma/cuentas/1/administradores',
      cuerpo: { etiqueta: 'Rosa Vaca' },
    });
    expect(solicitar).toHaveBeenNthCalledWith(2, {
      metodo: 'POST',
      ruta: '/plataforma/cuentas/1/administradores',
      cuerpo: { etiqueta: 'Rosa', sufijo: 'AB12' },
    });
    expect(solicitar).toHaveBeenNthCalledWith(3, {
      metodo: 'POST',
      ruta: '/plataforma/cuentas/1/administradores',
      cuerpo: { etiqueta: 'Rosa' },
    });
  });

  it('la jerarquía lee el árbol y pone un guion donde falta el nombre', async () => {
    const { solicitar, cliente } = clienteFalso({
      administradores: [
        {
          id: '11',
          etiqueta: 'Carla',
          guardias: [{ id: '21', etiqueta: null }],
          titulares: [{ id: '31', etiqueta: 'Jorge', unidad: 'Casa 12', miembros: 3 }],
        },
      ],
    });
    const arbol = await crearCuentasHttp(cliente).jerarquia('1');
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/cuentas/1/jerarquia',
    });
    expect(arbol).toEqual([
      {
        id: '11',
        etiqueta: 'Carla',
        guardias: [{ id: '21', etiqueta: '—' }],
        titulares: [{ id: '31', etiqueta: 'Jorge', unidad: 'Casa 12', miembros: 3 }],
      },
    ]);
  });

  it('las estadísticas de usuarios se leen con sus umbrales y el cupo de cada rama', async () => {
    const { solicitar, cliente } = clienteFalso({
      ventana_dias: 30,
      umbral_inactivo_dias: 30,
      umbral_ruidoso_por_dia: 10,
      usuarios: [
        {
          id: '41',
          etiqueta: null,
          rol: 'Miembro',
          unidad: null,
          qr_generados: 0,
          qr_usados: 0,
          max_qr_en_un_dia: 0,
          ultimo_qr_at: '2026-09-02T15:00:00.000Z',
          inactivo: true,
          ruidoso: false,
        },
      ],
      titulares: [
        {
          id: '31',
          etiqueta: 'Jorge',
          unidad: 'Casa 12',
          miembros: 9,
          tope: 10,
          porcentaje: 90,
          cerca_del_tope: true,
        },
      ],
      ramas: [{ id: '11', etiqueta: 'Carla', usuarios: 5 }],
    });
    const e = await crearCuentasHttp(cliente).estadisticasDeUsuarios('1');
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'GET',
      ruta: '/plataforma/cuentas/1/estadisticas-de-usuarios',
    });
    expect(e.umbralInactivoDias).toBe(30);
    expect(e.umbralRuidosoPorDia).toBe(10);
    expect(e.usuarios[0]).toMatchObject({
      etiqueta: '—',
      inactivo: true,
      ultimoQrEn: new Date('2026-09-02T15:00:00.000Z'),
    });
    expect(e.titulares[0]).toMatchObject({ miembros: 9, tope: 10, cercaDelTope: true });
    expect(e.ramas).toEqual([{ id: '11', etiqueta: 'Carla', usuarios: 5 }]);
  });

  it('reasignar manda el usuario y el administrador de destino', async () => {
    const { solicitar, cliente } = clienteFalso();
    await crearCuentasHttp(cliente).reasignar('1', '31', '12');
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'POST',
      ruta: '/plataforma/cuentas/1/reasignaciones',
      cuerpo: { usuario_id: '31', administrador_id: '12' },
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
        max_miembros_por_titular: 10,
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
