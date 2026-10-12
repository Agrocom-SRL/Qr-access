import { render, screen } from '@testing-library/react';
import { Ingreso } from './Ingreso';

describe('Ingreso', () => {
  it('pide usuario y contraseña y ofrece ingresar', () => {
    render(<Ingreso />);
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });
});
