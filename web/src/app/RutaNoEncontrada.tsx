import { useNavigate } from 'react-router-dom';
import { PantallaNoEncontrada } from '../shared/ui/organisms/PantallasDeEstado';
import { RUTAS } from './rutas';

/** Cualquier dirección sin pantalla: se queda dentro del panel con la sesión abierta. */
export function RutaNoEncontrada() {
  const navegar = useNavigate();
  return (
    <PantallaNoEncontrada
      incrustada
      onVolver={() => {
        void navegar(RUTAS.resumen);
      }}
    />
  );
}
