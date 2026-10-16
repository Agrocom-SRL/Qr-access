import { useTranslation } from 'react-i18next';
import { BotonIcono } from '../atoms/BotonIcono';
import { TextoMono } from '../atoms/TextoMono';
import styles from './Paginador.module.css';

interface Props {
  pagina: number;
  porPagina: number;
  total: number;
  onCambio: (pagina: number) => void;
}

/** Rango "Mostrando 1–10 de 42" y navegación "‹ 1 / 5 ›". */
export function Paginador({ pagina, porPagina, total, onCambio }: Props) {
  const { t } = useTranslation('comun');
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  return (
    <div className={styles.pie}>
      <span className={styles.rango}>{t('mostrando', { desde, hasta, total })}</span>
      <nav className={styles.navegacion} aria-label={t('paginacion')}>
        <BotonIcono
          icono="chevron_left"
          etiqueta={t('anterior')}
          disabled={pagina <= 1}
          onClick={() => {
            onCambio(pagina - 1);
          }}
        />
        <TextoMono>
          {pagina} / {paginas}
        </TextoMono>
        <BotonIcono
          icono="chevron_right"
          etiqueta={t('siguiente')}
          disabled={pagina >= paginas}
          onClick={() => {
            onCambio(pagina + 1);
          }}
        />
      </nav>
    </div>
  );
}
