import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventosPage } from '@/features/eventos/ui/pages/EventosPage';
import type { EventosRepositorio } from '@/features/eventos/api/EventosRepositorio';
import type { EventoDeAcceso } from '@/features/eventos/domain/evento';
import { ProveedoresApp } from '@/app/providers/ProveedoresApp';
import { crearServiciosDePrueba } from '../../../servicios';

const BASE: EventoDeAcceso = {
  id: '70',
  ocurridoEn: new Date('2026-10-27T12:00:00Z'),
  resultado: 'permitido',
  motivoCode: 'manual.ordenada',
  cuenta: { id: '1', codigo: 'AGR', nombre: 'Agroindustrial Norte' },
  puerta: { id: '3', nombre: 'Portón vehicular', sitio: 'Planta Warnes' },
  dispositivo: 'LECT-0042',
  qrEtiqueta: null,
  ejecucion: 'ejecutada',
  ejecucionCausa: 'puerta_abrio',
  metodo: 'manual',
  usuario: 'Ana Quiroga',
};

const QR: EventoDeAcceso = {
  ...BASE,
  id: '71',
  motivoCode: 'acceso.permitido',
  dispositivo: 'Frontal',
  qrEtiqueta: 'Entrada para Gerencia',
  ejecucion: null,
  ejecucionCausa: null,
  metodo: 'qr',
  usuario: null,
};

function montar(elementos: EventoDeAcceso[]) {
  const listar: EventosRepositorio['listar'] = () =>
    Promise.resolve({ elementos, pagina: 1, porPagina: 15, total: elementos.length });
  return render(
    <ProveedoresApp servicios={crearServiciosDePrueba({ eventos: { listar } })} reintentos={0}>
      <MemoryRouter initialEntries={['/accesos']}>
        <EventosPage />
      </MemoryRouter>
    </ProveedoresApp>,
  );
}

/** Las celdas de la fila que contiene el texto dado, por el nombre de su columna (la de Cuenta cambia). */
async function filaDe(tabla: HTMLElement, texto: string): Promise<Record<string, string>> {
  // La tabla aparece con esqueletos: se espera a que llegue la fila real.
  const celda = await within(tabla).findByText(texto);
  const fila = celda.closest('tr');
  if (fila === null) throw new Error(`sin fila con ${texto}`);
  const encabezados = within(tabla)
    .getAllByRole('columnheader')
    .map((th) => th.textContent);
  const celdas = Array.from(fila.querySelectorAll('td')).map((td) => td.textContent);
  return Object.fromEntries(encabezados.map((h, i) => [h, celdas[i] ?? '']));
}

describe('lecturas: aperturas manuales desde la app (ADR 0035)', () => {
  it('una apertura manual completa lector, QR y motivo, con el nombre de quien abrió', async () => {
    montar([BASE]);
    const tabla = await screen.findByRole('table', { name: 'Lecturas' });
    const fila = await filaDe(tabla, 'Portón vehicular');
    expect(fila.Lector).toBe('App');
    expect(fila.QR).toBe('Apertura manualAna Quiroga');
    expect(fila.Motivo).toBe('Apertura manual ordenada');
    expect(within(tabla).getByText('Ana Quiroga')).toBeInTheDocument();
    expect(within(tabla).queryByText('—', { exact: true })).not.toBeInTheDocument();
  });

  it('sin nombre de usuario la celda QR dice solo Apertura manual', async () => {
    montar([{ ...BASE, usuario: null, motivoCode: 'manual.sin_conexion', resultado: 'rechazado' }]);
    const tabla = await screen.findByRole('table', { name: 'Lecturas' });
    const fila = await filaDe(tabla, 'Portón vehicular');
    expect(fila.Lector).toBe('App');
    expect(fila.QR).toBe('Apertura manual');
    expect(fila.Motivo).toBe('La placa estaba sin conexión');
  });

  it('una lectura por QR no cambia: lector, etiqueta del QR y motivo como antes', async () => {
    montar([QR]);
    const tabla = await screen.findByRole('table', { name: 'Lecturas' });
    const fila = await filaDe(tabla, 'Entrada para Gerencia');
    expect(fila.Lector).toBe('Frontal');
    expect(fila.QR).toBe('Entrada para Gerencia');
    expect(fila.Motivo).toBe('Acceso permitido');
    expect(within(tabla).queryByText('Apertura manual')).not.toBeInTheDocument();
  });
});
