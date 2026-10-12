import { Route, Routes } from 'react-router-dom';
import { EquipoPage } from '../features/equipo';
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
        <Route path={RUTAS.resumen} element={<PaginaProximamente />} />
        <Route path={RUTAS.cuentas} element={<PaginaProximamente />} />
        <Route path={RUTAS.cobranza} element={<PaginaProximamente />} />
        <Route path={RUTAS.planes} element={<PaginaProximamente />} />
        <Route path={RUTAS.bitacora} element={<PaginaProximamente />} />
        <Route path={RUTAS.equipo} element={<EquipoPage />} />
        <Route path={RUTAS.perfil} element={<PerfilPage />} />
        <Route path="*" element={<PaginaProximamente />} />
      </Route>
    </Routes>
  );
}
