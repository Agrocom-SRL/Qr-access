import { act, render, screen } from '@testing-library/react';
import { ProveedorTema, useTema } from '@/theme/ProveedorTema';

function Sonda() {
  const { preferencia, aplicado, elegir } = useTema();
  return (
    <button
      type="button"
      onClick={() => {
        elegir('oscuro');
      }}
    >
      {preferencia}:{aplicado}
    </button>
  );
}

describe('ProveedorTema', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.tema;
  });

  it('sin preferencia sigue el sistema y escribe data-tema', () => {
    render(
      <ProveedorTema>
        <Sonda />
      </ProveedorTema>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('sistema:claro');
    expect(document.documentElement.dataset.tema).toBe('claro');
  });

  it('recuerda la elección del usuario', () => {
    render(
      <ProveedorTema>
        <Sonda />
      </ProveedorTema>,
    );
    act(() => {
      screen.getByRole('button').click();
    });
    expect(document.documentElement.dataset.tema).toBe('oscuro');
    expect(localStorage.getItem('acceso.tema')).toBe('oscuro');
  });
});
