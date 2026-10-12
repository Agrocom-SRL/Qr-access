import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AccesoBoton } from '@/shared/ui/atoms/AccesoBoton';
import { iniciales } from '@/shared/ui/atoms/Avatar';
import { BadgeSuscripcion } from '@/shared/ui/atoms/BadgeSuscripcion';
import { BarraUso, nivelDeUso } from '@/shared/ui/molecules/BarraUso';
import { normalizarCodigo } from '@/shared/ui/molecules/CampoCodigo';
import { Paginador } from '@/shared/ui/molecules/Paginador';
import { ConfirmarDialogo } from '@/shared/ui/organisms/ConfirmarDialogo';
import { ListadoPaginado } from '@/shared/ui/organisms/ListadoPaginado';
import type { Columna } from '@/shared/ui/organisms/TablaDatos';

describe('reglas puras', () => {
  it('BarraUso: advertencia desde 90 % y peligro desde 100 %', () => {
    expect(nivelDeUso(87, 100)).toBe('normal');
    expect(nivelDeUso(90, 100)).toBe('advertencia');
    expect(nivelDeUso(100, 100)).toBe('peligro');
    expect(nivelDeUso(5, 0)).toBe('normal');
  });

  it('el código de cuenta son 3 letras mayúsculas', () => {
    expect(normalizarCodigo('fr0o9x')).toBe('FRO');
    expect(normalizarCodigo('ab')).toBe('AB');
  });

  it('iniciales del avatar', () => {
    expect(iniciales('Lucía Paz')).toBe('LP');
    expect(iniciales('Marco')).toBe('M');
  });
});

describe('átomos y moléculas', () => {
  it('AccesoBoton cargando se deshabilita y marca aria-busy', () => {
    render(<AccesoBoton cargando>Ingresando</AccesoBoton>);
    const boton = screen.getByRole('button', { name: 'Ingresando' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
  });

  it('BadgeSuscripcion muestra texto, no solo color', () => {
    render(<BadgeSuscripcion estado="porVencer" />);
    expect(screen.getByText('Por vencer')).toBeInTheDocument();
  });

  it('BarraUso muestra la etiqueta mono "87 / 100"', () => {
    render(<BarraUso usados={87} cupo={100} />);
    expect(screen.getByText('87 / 100')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '87');
  });

  it('Paginador informa el rango y respeta los extremos', async () => {
    const onCambio = vi.fn();
    render(<Paginador pagina={1} porPagina={10} total={42} onCambio={onCambio} />);
    expect(screen.getByText('Mostrando 1–10 de 42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onCambio).toHaveBeenCalledWith(2);
  });
});

interface Fila {
  id: string;
  nombre: string;
}
const columnas: Columna<Fila>[] = [{ id: 'nombre', encabezado: 'Cuenta', celda: (f) => f.nombre }];

function listado(propiedades: Partial<Parameters<typeof ListadoPaginado<Fila>>[0]>) {
  return (
    <MemoryRouter>
      <ListadoPaginado<Fila>
        etiqueta="Cuentas"
        columnas={columnas}
        filas={undefined}
        claveDe={(f) => f.id}
        cargando={false}
        onReintentar={() => undefined}
        vacio={{ titulo: 'Aún no hay cuentas', texto: 'Crea la primera.' }}
        tituloError="No pudimos cargar las cuentas"
        {...propiedades}
      />
    </MemoryRouter>
  );
}

describe('ListadoPaginado: los cuatro estados', () => {
  it('carga: tabla con filas esqueleto', () => {
    render(listado({ cargando: true }));
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });

  it('vacío: título y texto', () => {
    render(listado({ filas: [] }));
    expect(screen.getByText('Aún no hay cuentas')).toBeInTheDocument();
  });

  it('error: traduce el código y ofrece reintentar', async () => {
    const onReintentar = vi.fn();
    render(listado({ hayError: true, errorCode: 'suscripcion.vencida', onReintentar }));
    expect(screen.getByText('No pudimos cargar las cuentas')).toBeInTheDocument();
    expect(screen.getByText('Suscripción vencida')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledOnce();
  });

  it('datos: filas reales', () => {
    render(listado({ filas: [{ id: '1', nombre: 'Frigorífico Oriente' }] }));
    expect(screen.getByText('Frigorífico Oriente')).toBeInTheDocument();
  });
});

describe('ConfirmarDialogo', () => {
  it('confirma y cancela con sus botones', async () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(
      <ConfirmarDialogo
        abierto
        titulo="¿Registrar el pago?"
        texto="Quedará vigente."
        etiquetaConfirmar="Registrar pago"
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirmar).toHaveBeenCalledOnce();
    expect(onCancelar).toHaveBeenCalledOnce();
  });
});
