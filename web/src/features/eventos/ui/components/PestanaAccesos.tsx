import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventos } from '../../application/useEventos';
import { POR_PAGINA_DE_EVENTOS } from '../../domain/evento';
import { TablaEventos } from './TablaEventos';

/** Pestaña "Accesos" de la ficha de una cuenta: lo que leyeron sus placas, en vivo. */
export function PestanaAccesos({ cuentaId }: { cuentaId: string }) {
  const { t } = useTranslation('eventos');
  const [pagina, setPagina] = useState(1);
  const consulta = useEventos(
    { cuentaId, resultado: 'todos', ejecucion: 'todas', desde: '', hasta: '', pagina },
    POR_PAGINA_DE_EVENTOS,
  );
  return (
    <TablaEventos
      datos={consulta.data}
      cargando={consulta.isPending}
      error={consulta.error}
      hayError={consulta.isError}
      onReintentar={() => void consulta.refetch()}
      onPagina={setPagina}
      conCuenta={false}
      vacio={{ titulo: t('vacio.titulo'), texto: t('vacio.texto') }}
    />
  );
}
