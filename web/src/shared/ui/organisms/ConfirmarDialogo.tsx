import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../atoms/AccesoBoton';
import { Dialogo } from './Dialogo';

interface Props {
  abierto: boolean;
  titulo: string;
  texto: string;
  etiquetaConfirmar: string;
  cargando?: boolean;
  /** Acción destructiva: el botón de confirmar va en `peligro`. */
  peligro?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/** Confirmación con "Cancelar" (texto) y la acción primaria a la derecha. */
export function ConfirmarDialogo({
  abierto,
  titulo,
  texto,
  etiquetaConfirmar,
  cargando = false,
  peligro = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const { t } = useTranslation('comun');
  return (
    <Dialogo
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCancelar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={onCancelar}>
            {t('cancelar')}
          </AccesoBoton>
          <AccesoBoton
            variante={peligro ? 'peligro' : 'primario'}
            cargando={cargando}
            onClick={onConfirmar}
          >
            {etiquetaConfirmar}
          </AccesoBoton>
        </>
      }
    >
      <p>{texto}</p>
    </Dialogo>
  );
}
