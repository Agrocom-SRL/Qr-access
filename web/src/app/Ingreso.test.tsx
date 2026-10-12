import { render, screen } from '@testing-library/react';
import { t } from '../l10n';
import { Ingreso } from './Ingreso';

describe('Ingreso', () => {
  it('pide usuario y contraseña y ofrece ingresar', () => {
    render(<Ingreso />);
    expect(screen.getByLabelText(t.ingresoUsuario)).toBeInTheDocument();
    expect(screen.getByLabelText(t.ingresoContrasena)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.ingresoBoton })).toBeInTheDocument();
  });
});
