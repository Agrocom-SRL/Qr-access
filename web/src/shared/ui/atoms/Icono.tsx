import { svgDe, type NombreIcono } from './iconos';
import { cx } from '../../lib/cx';
import styles from './Icono.module.css';

type Tamano = 16 | 18 | 20 | 24 | 32;

interface Props {
  nombre: NombreIcono;
  tamano?: Tamano;
  /** Etiqueta accesible; sin ella el ícono es decorativo. */
  etiqueta?: string;
}

/** Material Symbols Outlined, peso 400. El relleno (`*_fill`) solo se usa en el ítem activo del rail. */
export function Icono({ nombre, tamano = 24, etiqueta }: Props) {
  return (
    <span
      className={cx(styles.icono, styles[`t${String(tamano)}`])}
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svgDe(nombre) }}
    />
  );
}
