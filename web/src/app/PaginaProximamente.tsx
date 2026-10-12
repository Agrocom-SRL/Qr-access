import { useTranslation } from 'react-i18next';
import { EstadoVacio } from '../shared/ui/organisms/EstadoVacio';

/** Marcador de las secciones del panel que todavía no tienen su pantalla (se reemplaza módulo a módulo). */
export function PaginaProximamente() {
  const { t } = useTranslation('comun');
  return (
    <EstadoVacio ilustracion="vacioQr" titulo={t('pronto.titulo')} texto={t('pronto.texto')} />
  );
}
