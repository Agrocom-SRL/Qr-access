import { render, screen } from '@testing-library/react';
import { TarjetaDeNotificacion } from '@/features/notificaciones/ui/components/TarjetaDeNotificacion';
import type { Notificacion } from '@/features/notificaciones/domain/notificacion';

const BASE: Omit<Notificacion, 'tipo' | 'senal' | 'bolsa' | 'flujo'> = {
  id: '300',
  severidad: 'aviso',
  cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
  sitio: null,
  leida: false,
  placas: [],
  novedadEn: new Date('2026-10-27T12:00:00Z'),
  creadaEn: new Date('2026-10-27T11:00:00Z'),
};

function tarjeta(aviso: Notificacion) {
  return render(
    <TarjetaDeNotificacion
      notificacion={aviso}
      puedeGestionar={false}
      onLeer={() => undefined}
      onDescartar={() => undefined}
    />,
  );
}

describe('avisos de señales, bolsa y flujo en la bandeja', () => {
  it('una señal de uso dice qué pasó, de quién, cuánto midió y qué día', () => {
    tarjeta({
      ...BASE,
      tipo: 'senal.uso',
      senal: {
        tipo: 'uso_masivo',
        usuarioId: '31',
        usuarioEtiqueta: 'Jorge Rivero',
        gravedad: 'media',
        incidenteId: '901',
        dia: '2026-10-27',
        valor: 13,
        umbral: 12,
      },
    });
    expect(screen.getByText('Un QR tiene un uso fuera de lo normal')).toBeInTheDocument();
    expect(screen.getByText('Uso masivo de un QR')).toBeInTheDocument();
    expect(screen.getByText('Usuario: Jorge Rivero')).toBeInTheDocument();
    expect(screen.getByText('Medido: 13; umbral: 12')).toBeInTheDocument();
    expect(screen.getByText('Día 27/10')).toBeInTheDocument();
  });

  it('una señal sin nombre de usuario lo dice, sin inventar uno', () => {
    tarjeta({
      ...BASE,
      tipo: 'senal.uso',
      senal: {
        tipo: 'pin_compartido',
        usuarioId: '41',
        usuarioEtiqueta: null,
        gravedad: 'alta',
        incidenteId: null,
        dia: '2026-10-27',
        valor: 4,
        umbral: 4,
      },
    });
    expect(screen.getByText('Usuario sin nombre')).toBeInTheDocument();
  });

  it('una bolsa superada sin cifras no inventa un número', () => {
    tarjeta({
      ...BASE,
      tipo: 'bolsa.superada',
      bolsa: { mes: '2026-10', dia: '2026-10-27', usado: null, tope: null },
    });
    expect(screen.getByText('Una cuenta superó su bolsa de QR del mes')).toBeInTheDocument();
    expect(
      screen.getByText(/Cuota de octubre de 2026: este aviso no trae las cifras/),
    ).toBeInTheDocument();
  });

  it('una bolsa con cifras las muestra con su mes', () => {
    tarjeta({
      ...BASE,
      tipo: 'bolsa.aviso',
      bolsa: { mes: '2026-10', dia: '2026-10-27', usado: 92, tope: 100 },
    });
    expect(screen.getByText('92 de 100 QR en octubre de 2026')).toBeInTheDocument();
  });

  it('un flujo atípico muestra aperturas, usuarios y la base habitual', () => {
    tarjeta({
      ...BASE,
      tipo: 'flujo.atipico',
      flujo: {
        dia: '2026-10-27',
        aperturas: 60,
        usuariosActivos: 2,
        porUsuario: 30,
        umbralPorUsuario: 25,
        base: 12.5,
      },
    });
    expect(screen.getByText('60 aperturas con 2 usuarios activos')).toBeInTheDocument();
    expect(screen.getByText('30 por usuario (umbral: 25)')).toBeInTheDocument();
    expect(screen.getByText('Base habitual: 12,5 aperturas')).toBeInTheDocument();
  });
});
