import { Route, Routes } from 'react-router-dom';
import {
  CrearCuentaPage,
  CuentasPage,
  DetalleCuentaPage,
  RUTAS_DE_CUENTAS,
} from '../features/cuentas';
import { BitacoraPage } from '../features/bitacora';
import { CobranzaPage, RegistrarPagoPage } from '../features/pagos';
import { EquipoPage } from '../features/equipo';
import { PlanesPage } from '../features/planes';
import { ResumenPage } from '../features/resumen';
import { IngresoPage, PerfilPage } from '../features/seguridad';
import { LayoutAdmin } from './LayoutAdmin';
import { PaginaProximamente } from './PaginaProximamente';
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
        <Route path={`${RUTAS.cobranza}/:cuentaId/pago`} element={<RegistrarPagoPage />} />
        <Route path={RUTAS.planes} element={<PlanesPage />} />
        <Route path={RUTAS.bitacora} element={<BitacoraPage />} />
        <Route path={RUTAS.equipo} element={<EquipoPage />} />
        <Route path={RUTAS.perfil} element={<PerfilPage />} />
        <Route path="*" element={<PaginaProximamente />} />
      </Route>
    </Routes>
  );
}
