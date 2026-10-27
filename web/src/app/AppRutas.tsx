import { Route, Routes } from 'react-router-dom';
import {
  CrearCuentaPage,
  CuentasPage,
  DetalleCuentaPage,
  RUTAS_DE_CUENTAS,
} from '../features/cuentas';
import { BitacoraPage } from '../features/bitacora';
import { NotificacionesPage } from '../features/notificaciones';
import { DetalleConsumoPage } from '../features/limites';
import { CuentasDeCobroPage } from '../features/cobro';
import { CobranzaPage, RegistrarPagoPage } from '../features/pagos';
import { EventosPage } from '../features/eventos';
import { EquipoPage } from '../features/equipo';
import { EstadisticasPage } from '../features/estadisticas';
import { DetalleFlujoPage } from '../features/senales';
import { PlacasPage } from '../features/placas';
import { PlanesPage } from '../features/planes';
import { ResumenPage } from '../features/resumen';
import { IngresoPage, PerfilPage } from '../features/seguridad';
import { ConPermiso } from './ConPermiso';
import { ConsumoYSenalesPage } from './ConsumoYSenalesPage';
import { LayoutAdmin } from './LayoutAdmin';
import { EstadosPage } from './EstadosPage';
import { RutaNoEncontrada } from './RutaNoEncontrada';
import { RUTAS } from './rutas';

/** Árbol de rutas; el módulo de cada pantalla se agrega aquí a medida que se construye. */
export function AppRutas() {
  return (
    <Routes>
      <Route path={RUTAS.ingreso} element={<IngresoPage />} />
      <Route element={<LayoutAdmin />}>
        <Route path={RUTAS.resumen} element={<ResumenPage />} />
        <Route path={RUTAS.cuentas} element={<CuentasPage />} />
        <Route path={RUTAS_DE_CUENTAS.nueva} element={<CrearCuentaPage />} />
        <Route path={`${RUTAS.cuentas}/:id`} element={<DetalleCuentaPage />} />
        <Route path={RUTAS.cobranza} element={<CobranzaPage />} />
        <Route path={RUTAS.cuentasDeCobro} element={<CuentasDeCobroPage />} />
        <Route path={`${RUTAS.cobranza}/:cuentaId/pago`} element={<RegistrarPagoPage />} />
        <Route path={RUTAS.accesos} element={<EventosPage />} />
        <Route path={RUTAS.placas} element={<PlacasPage />} />
        <Route path={RUTAS.estadisticas} element={<EstadisticasPage />} />
        <Route path={RUTAS.consumo} element={<ConsumoYSenalesPage />} />
        <Route
          path={`${RUTAS.consumo}/cuentas/:id`}
          element={
            <ConPermiso permisos={['limites.consumo.ver']}>
              <DetalleConsumoPage />
            </ConPermiso>
          }
        />
        <Route
          path={`${RUTAS.consumo}/flujo/:id`}
          element={
            <ConPermiso permisos={['seguridad.senal.ver']}>
              <DetalleFlujoPage />
            </ConPermiso>
          }
        />
        <Route path={RUTAS.planes} element={<PlanesPage />} />
        <Route path={RUTAS.bitacora} element={<BitacoraPage />} />
        <Route
          path={RUTAS.notificaciones}
          element={
            <ConPermiso permisos={['notificaciones.aviso_plataforma.ver']}>
              <NotificacionesPage />
            </ConPermiso>
          }
        />
        <Route path={RUTAS.equipo} element={<EquipoPage />} />
        <Route path={RUTAS.perfil} element={<PerfilPage />} />
        <Route path={RUTAS.estados} element={<EstadosPage />} />
        <Route path="*" element={<RutaNoEncontrada />} />
      </Route>
    </Routes>
  );
}
