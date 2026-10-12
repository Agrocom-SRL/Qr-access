import { BrowserRouter } from 'react-router-dom';
import { AppRutas } from './AppRutas';
import { crearServicios } from './providers/crearServicios';
import { ProveedoresApp } from './providers/ProveedoresApp';

/** La API se sirve en el mismo origen: proxy de Vite en desarrollo, Nginx en producción (sin CORS). */
const servicios = crearServicios('/api/v1');

export function App() {
  return (
    <ProveedoresApp servicios={servicios}>
      <BrowserRouter>
        <AppRutas />
      </BrowserRouter>
    </ProveedoresApp>
  );
}
