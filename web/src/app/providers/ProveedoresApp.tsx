import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ProveedorBitacora } from '../../features/bitacora';
import { ProveedorCuentas } from '../../features/cuentas';
import { ProveedorEquipo } from '../../features/equipo';
import { ProveedorEstadisticas } from '../../features/estadisticas';
import { ProveedorPagos } from '../../features/pagos';
import { ProveedorEventos } from '../../features/eventos';
import { ProveedorLimites } from '../../features/limites';
import { ProveedorSenales } from '../../features/senales';
import { ProveedorNotificaciones } from '../../features/notificaciones';
import { ProveedorPlacas } from '../../features/placas';
import { ProveedorCobro } from '../../features/cobro';
import { ProveedorPlanes } from '../../features/planes';
import { ProveedorResumen } from '../../features/resumen';
import { ProveedorSeguridad, SesionProvider } from '../../features/seguridad';
import { ProveedorSesiones } from '../../features/sesiones';
import { ProveedorIncidentes } from '../../features/incidentes';
import { ProveedorAnulacion } from '../../features/anulacion';
import { ProveedorExportaciones } from '../../features/exportacion';
import { ProveedorSuscripciones } from '../../features/suscripciones';
import { ProveedorTema } from '../../theme/ProveedorTema';
import type { Servicios } from './crearServicios';

/** Reintentos de una lectura que falló con 5xx o sin red; los errores 4xx no se reintentan nunca. */
const REINTENTOS_POR_DEFECTO = 2;

function crearClienteConsultas(reintentos: number): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Sin red las lecturas siguen mostrando la caché (README, "sin conexión").
        networkMode: 'offlineFirst',
        staleTime: 30_000,
        retry: (intentos, error) =>
          intentos < reintentos &&
          !(error instanceof Error && 'status' in error && Number(error.status) < 500),
      },
    },
  });
}

/** Proveedores globales, en orden: tema, datos de servidor, repositorios y sesión. */
export function ProveedoresApp({
  servicios,
  reintentos = REINTENTOS_POR_DEFECTO,
  children,
}: {
  servicios: Servicios;
  /** Cuántas veces se reintenta una lectura fallida; los tests usan 0. */
  reintentos?: number;
  children: ReactNode;
}) {
  const [clienteConsultas] = useState(() => crearClienteConsultas(reintentos));
  return (
    <ProveedorTema>
      <QueryClientProvider client={clienteConsultas}>
        <ProveedorSeguridad valor={servicios.seguridad}>
          <ProveedorEquipo valor={servicios.equipo}>
            <ProveedorPlanes valor={servicios.planes}>
              <ProveedorCobro valor={servicios.cobro}>
                <ProveedorPlacas valor={servicios.placas}>
                  <ProveedorCuentas valor={servicios.cuentas}>
                    <ProveedorSuscripciones valor={servicios.suscripciones}>
                      <ProveedorPagos valor={servicios.pagos}>
                        <ProveedorBitacora valor={servicios.bitacora}>
                          <ProveedorEventos valor={servicios.eventos}>
                            <ProveedorResumen valor={servicios.resumen}>
                              <ProveedorEstadisticas valor={servicios.estadisticas}>
                                <ProveedorNotificaciones valor={servicios.notificaciones}>
                                  <ProveedorLimites valor={servicios.limites}>
                                    <ProveedorSenales valor={servicios.senales}>
                                      <SesionProvider almacen={servicios.almacen}>
                                        <ProveedorSesiones valor={servicios.sesiones}>
                                          <ProveedorIncidentes valor={servicios.incidentes}>
                                            <ProveedorAnulacion valor={servicios.anulacion}>
                                              <ProveedorExportaciones
                                                valor={servicios.exportaciones}
                                              >
                                                {children}
                                              </ProveedorExportaciones>
                                            </ProveedorAnulacion>
                                          </ProveedorIncidentes>
                                        </ProveedorSesiones>
                                      </SesionProvider>
                                    </ProveedorSenales>
                                  </ProveedorLimites>
                                </ProveedorNotificaciones>
                              </ProveedorEstadisticas>
                            </ProveedorResumen>
                          </ProveedorEventos>
                        </ProveedorBitacora>
                      </ProveedorPagos>
                    </ProveedorSuscripciones>
                  </ProveedorCuentas>
                </ProveedorPlacas>
              </ProveedorCobro>
            </ProveedorPlanes>
          </ProveedorEquipo>
        </ProveedorSeguridad>
      </QueryClientProvider>
    </ProveedorTema>
  );
}
