import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotonIcono } from '../atoms/BotonIcono';
import { CampoFormulario } from './CampoFormulario';
import type { PropsCampoTexto } from './AccesoCampoTexto';
import estilos from './controles.module.css';
import styles from './CampoContrasena.module.css';

type Props = Omit<PropsCampoTexto, 'type' | 'mono'>;

/** Campo de contraseña con botón de ojo para mostrar u ocultar (A01). */
export function CampoContrasena({ etiqueta, ayuda, error, className, ref, ...resto }: Props) {
  const { t } = useTranslation('auth');
  const [visible, setVisible] = useState(false);
  return (
    <CampoFormulario etiqueta={etiqueta} ayuda={ayuda} error={error}>
      {(control) => (
        <div className={styles.envoltorio}>
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className={[estilos.control, styles.entrada, className].filter(Boolean).join(' ')}
            {...control}
            {...resto}
          />
          <span className={styles.ojo}>
            <BotonIcono
              icono={visible ? 'visibility_off' : 'visibility'}
              etiqueta={visible ? t('ocultar') : t('mostrar')}
              aria-pressed={visible}
              onClick={() => {
                setVisible((v) => !v);
              }}
            />
          </span>
        </div>
      )}
    </CampoFormulario>
  );
}
