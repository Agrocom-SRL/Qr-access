import { render, screen } from '@testing-library/react';
import { EjecucionDeAcceso } from '@/features/eventos/ui/components/EjecucionDeAcceso';

describe('ejecución de un acceso', () => {
  it('abrió, no abrió y sin confirmar se leen por texto, no solo por color', () => {
    const { rerender } = render(<EjecucionDeAcceso ejecucion="ejecutada" causa="puerta_abrio" />);
    expect(screen.getByText('Abrió')).toBeInTheDocument();
    expect(screen.getByText('La puerta se abrió')).toBeInTheDocument();

    rerender(<EjecucionDeAcceso ejecucion="fallida" causa="rele_no_accionado" />);
    expect(screen.getByText('No abrió')).toBeInTheDocument();
    expect(screen.getByText('El relé no se accionó')).toBeInTheDocument();

    rerender(<EjecucionDeAcceso ejecucion="sin_confirmacion" causa="sin_sensor" />);
    expect(screen.getByText('Sin confirmar')).toBeInTheDocument();
    expect(screen.getByText('La puerta no tiene sensor')).toBeInTheDocument();
  });

  it('un rechazo no tiene ejecución: se muestra un guion', () => {
    render(<EjecucionDeAcceso ejecucion={null} causa={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('sin causa conocida, solo el desenlace', () => {
    render(<EjecucionDeAcceso ejecucion="fallida" causa={null} />);
    expect(screen.getByText('No abrió')).toBeInTheDocument();
    expect(screen.queryByText(/La puerta/)).not.toBeInTheDocument();
  });
});
