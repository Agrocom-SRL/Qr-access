import { useTranslation } from 'react-i18next';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import styles from './DialogoOpciones.module.css';

interface Props<T extends string> {
  abierto: boolean;
  titulo: string;
  valor: T;
  opciones: readonly { valor: T; etiqueta: string }[];
  onElegir: (valor: T) => void;
  onCerrar: () => void;
}

/** Lista de opciones con la actual marcada: tocar una la aplica y cierra el modal. */
export function DialogoOpciones<T extends string>({
  abierto,
  titulo,
  valor,
  opciones,
  onElegir,
  onCerrar,
}: Props<T>) {
  const { t } = useTranslation('comun');
  return (
    <Dialogo abierto={abierto} titulo={titulo} onCerrar={onCerrar}>
      <ul className={styles.lista} role="radiogroup" aria-label={titulo}>
        {opciones.map((opcion) => {
          const activa = opcion.valor === valor;
          return (
            <li key={opcion.valor}>
              <button
                type="button"
                role="radio"
                aria-checked={activa}
                className={styles.opcion}
                onClick={() => {
                  onElegir(opcion.valor);
                  onCerrar();
                }}
              >
                <span>{opcion.etiqueta}</span>
                {activa ? <Icono nombre="check_circle" etiqueta={t('seleccionado')} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialogo>
  );
}
