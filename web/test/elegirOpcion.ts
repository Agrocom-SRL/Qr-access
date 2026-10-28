import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Abre un selector del panel (react-select) y elige la opción por su texto visible. */
export async function elegirOpcion(selector: HTMLElement, texto: string | RegExp) {
  await userEvent.click(selector);
  await userEvent.click(await screen.findByRole('option', { name: texto }));
}
