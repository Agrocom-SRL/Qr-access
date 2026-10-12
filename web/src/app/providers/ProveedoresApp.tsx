import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ProveedorEquipo } from '../../features/equipo';
import { ProveedorPlanes } from '../../features/planes';
import { ProveedorSeguridad, SesionProvider } from '../../features/seguridad';
import { ProveedorTema } from '../../theme/ProveedorTema';
import type { Servicios } from './crearServicios';

function crearClienteConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Sin red las lecturas siguen mostrando la caché (README, "sin conexión").
        networkMode: 'offlineFirst',
        staleTime: 30_000,
        retry: (intentos, error) =>
          intentos < 2 &&
          !(error instanceof Error && 'status' in error && Number(error.status) < 500),
      },
    },
  });
}

/** Proveedores globales, en orden: tema, datos de servidor, repositorios y sesión. */
export function ProveedoresApp({
  servicios,
  children,
}: {
  servicios: Servicios;
  children: ReactNode;
}) {
  const [clienteConsultas] = useState(crearClienteConsultas);
  return (
    <ProveedorTema>
      <QueryClientProvider client={clienteConsultas}>
        <ProveedorSeguridad valor={servicios.seguridad}>
          <ProveedorEquipo valor={servicios.equipo}>
            <ProveedorPlanes valor={servicios.planes}>
              <SesionProvider almacen={servicios.almacen}>{children}</SesionProvider>
            </ProveedorPlanes>
          </ProveedorEquipo>
        </ProveedorSeguridad>
      </QueryClientProvider>
    </ProveedorTema>
  );
}
