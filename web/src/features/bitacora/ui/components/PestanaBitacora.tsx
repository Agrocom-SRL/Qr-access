import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBitacora } from '../../application/useBitacora';
import { POR_PAGINA_DE_BITACORA } from '../../domain/evento';
import { TablaBitacora } from './TablaBitacora';

/** Pestaña "Bitácora" de la ficha de una cuenta (A05d): sus cambios, desde el panel y desde la app. */
export function PestanaBitacora({ cuentaId }: { cuentaId: string }) {
  const { t } = useTranslation('bitacora');
  const [pagina, setPagina] = useState(1);
  const consulta = useBitacora(
    { cuentaId, accion: null, desde: '', hasta: '', pagina },
    POR_PAGINA_DE_BITACORA,
  );
  return (
    <TablaBitacora
      datos={consulta.data}
      cargando={consulta.isPending}
      error={consulta.error}
      hayError={consulta.isError}
      onReintentar={() => void consulta.refetch()}
      onPagina={setPagina}
      conCuenta={false}
      vacio={{ titulo: t('sinResultados.titulo'), texto: t('sinResultados.texto') }}
    />
  );
}
