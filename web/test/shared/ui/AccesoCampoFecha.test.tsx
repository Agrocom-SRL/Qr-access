import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AccesoCampoFecha } from '@/shared/ui/molecules/AccesoCampoFecha';

function Prueba({ inicial = '', limpiable = false }: { inicial?: string; limpiable?: boolean }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <AccesoCampoFecha etiqueta="Fecha" valor={valor} onCambio={setValor} limpiable={limpiable} />
      <output data-testid="valor">{valor}</output>
    </>
  );
}

describe('AccesoCampoFecha', () => {
  it('muestra la fecha elegida con el formato del idioma y abre el calendario del mes', async () => {
    render(<Prueba inicial="2026-10-12" />);
    const campo = screen.getByRole('button', { name: /Fecha/ });
    expect(campo).toHaveTextContent('12/10/2026');
    await userEvent.click(campo);
    const calendario = await screen.findByRole('dialog', { name: 'Fecha' });
    expect(within(calendario).getByText(/octubre de 2026/i)).toBeInTheDocument();
    expect(
      within(calendario).getByRole('button', { name: /12 de octubre de 2026/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('elige un día, cierra y devuelve aaaa-mm-dd', async () => {
    render(<Prueba inicial="2026-10-12" />);
    await userEvent.click(screen.getByRole('button', { name: /Fecha/ }));
    await userEvent.click(await screen.findByRole('button', { name: /20 de octubre de 2026/ }));
    expect(screen.getByTestId('valor')).toHaveTextContent('2026-10-20');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cambia de mes y se mueve con el teclado; Esc cierra sin elegir', async () => {
    render(<Prueba inicial="2026-10-31" />);
    await userEvent.click(screen.getByRole('button', { name: /Fecha/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mes siguiente' }));
    // Octubre 31 pasa a noviembre 30: el día se ajusta al último del mes.
    expect(await screen.findByText(/noviembre de 2026/i)).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByText(/diciembre de 2026/i)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('valor')).toHaveTextContent('2026-10-31');
  });

  it('limpia la fecha cuando el campo es opcional', async () => {
    render(<Prueba inicial="2026-10-12" limpiable />);
    await userEvent.click(screen.getByRole('button', { name: /Fecha/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Limpiar' }));
    expect(screen.getByTestId('valor')).toHaveTextContent('');
    expect(screen.getByRole('button', { name: /Fecha/ })).toHaveTextContent('Elige una fecha');
  });
});
