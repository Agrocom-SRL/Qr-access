import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AccesoBoton } from '../atoms/AccesoBoton';

/**
 * Vuelve a la página anterior del historial; si la persona llegó directo a esta dirección (no hay
 * nada atrás dentro del panel), va a [alternativa].
 */
export function BotonVolver({ alternativa }: { alternativa: string }) {
  const { t } = useTranslation('comun');
  const navegar = useNavigate();
  const volver = () => {
    const posicion = (globalThis.history.state as { idx?: number } | null)?.idx ?? 0;
    if (posicion > 0) void navegar(-1);
    else void navegar(alternativa);
  };
  return (
    <AccesoBoton variante="texto" icono="arrow_back" onClick={volver}>
      {t('volver')}
    </AccesoBoton>
  );
}
