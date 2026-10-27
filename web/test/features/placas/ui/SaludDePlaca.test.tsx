import { render, screen } from '@testing-library/react';
import { insigniasDeSalud, SaludDePlaca } from '@/features/placas/ui/components/SaludDePlaca';
import type { Placa } from '@/features/placas/domain/placa';

const VINCULADA: Placa = {
  id: '1',
  mac: 'AA:BB:CC:00:11:22',
  estado: 'vinculada',
  firmware: '1.4.0',
  ip: null,
  ultimoContactoEn: new Date(),
  enLinea: true,
  estadoConexion: 'en_linea',
  lectorResponde: true,
  enObservacion: false,
  sensorPuerta: 'cerrada',
  sensorConfigurado: { instalado: true, nivelAbierto: 'alto' },
  aperturaFallida: false,
  porConfirmarHasta: null,
  dispositivo: { id: '7', nombre: 'Portón' },
  cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
  puerta: { id: '1', nombre: 'Portón' },
};

describe('salud de la placa: lector, sensor y aperturas', () => {
  it('una placa sana muestra el lector que responde y el sensor con la puerta cerrada', () => {
    expect(insigniasDeSalud(VINCULADA).map((i) => i.clave)).toEqual([
      'lectorResponde',
      'sensorCerrada',
    ]);
  });

  it('sin sensor instalado lo dice, y un lector mudo o una apertura fallida salen como peligro', () => {
    const insignias = insigniasDeSalud({
      ...VINCULADA,
      lectorResponde: false,
      sensorConfigurado: { instalado: false, nivelAbierto: 'alto' },
      sensorPuerta: 'sin_sensor',
      aperturaFallida: true,
      enObservacion: true,
    });
    expect(insignias).toEqual([
      { clave: 'lectorSinRespuesta', tono: 'peligro', icono: 'error' },
      { clave: 'sinSensor', tono: 'neutro', icono: 'sensors_off' },
      { clave: 'aperturaFallida', tono: 'peligro', icono: 'block' },
      { clave: 'observacion', tono: 'neutro', icono: 'visibility' },
    ]);
  });

  it('una placa detectada, sin vínculo, no tiene sensor ni lector que mostrar', () => {
    expect(
      insigniasDeSalud({
        ...VINCULADA,
        estado: 'detectada',
        dispositivo: null,
        lectorResponde: null,
        sensorConfigurado: null,
        sensorPuerta: null,
        estadoConexion: null,
      }),
    ).toEqual([]);
  });

  it('cada dato se dibuja con su texto', () => {
    render(<SaludDePlaca placa={{ ...VINCULADA, aperturaFallida: true }} />);
    expect(screen.getByText('Lector responde')).toBeInTheDocument();
    expect(screen.getByText('Sensor: puerta cerrada')).toBeInTheDocument();
    expect(screen.getByText('Aperturas fallidas')).toBeInTheDocument();
  });
});
