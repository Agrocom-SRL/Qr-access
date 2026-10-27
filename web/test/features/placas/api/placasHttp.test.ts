import { crearPlacasHttp, placaDesdeDto } from '@/features/placas/api/placasHttp';
import type { ClienteHttp } from '@/shared/api/clienteHttp';

const DTO = {
  id: '1',
  mac: 'AA:BB:CC:00:11:22',
  estado: 'vinculada' as const,
  firmware: '1.4.0',
  ip: null,
  ultimo_contacto_at: '2026-10-27T12:00:00.000Z',
  en_linea: false,
  estado_conexion: 'caida_sostenida' as const,
  lector_responde: false,
  en_observacion: true,
  sensor_puerta: 'abierta' as const,
  sensor_configurado: { instalado: true, nivel_abierto: 'bajo' as const },
  apertura_fallida: true,
  por_confirmar_hasta: null,
  dispositivo: { id: '7', nombre: 'Portón' },
  cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
  puerta: { id: '1', nombre: 'Portón' },
};

describe('placas por HTTP: conexión, sensor y aperturas (ADR 0031 §18)', () => {
  it('mapea el estado de conexión, el lector, el sensor y las aperturas fallidas', () => {
    expect(placaDesdeDto(DTO)).toMatchObject({
      estadoConexion: 'caida_sostenida',
      lectorResponde: false,
      enObservacion: true,
      sensorPuerta: 'abierta',
      sensorConfigurado: { instalado: true, nivelAbierto: 'bajo' },
      aperturaFallida: true,
    });
  });

  it('configurar el sensor manda instalado y nivel_abierto a su ruta', async () => {
    const solicitar = vi.fn<(solicitud: unknown) => Promise<unknown>>(() =>
      Promise.resolve(undefined),
    );
    const cliente = { solicitar } as unknown as ClienteHttp;
    await crearPlacasHttp(cliente).configurarSensor('1', { instalado: true, nivelAbierto: 'alto' });
    expect(solicitar).toHaveBeenCalledWith({
      metodo: 'PUT',
      ruta: '/plataforma/placas/1/sensor',
      cuerpo: { instalado: true, nivel_abierto: 'alto' },
    });
  });
});
