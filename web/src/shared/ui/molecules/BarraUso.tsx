import { TextoMono } from '../atoms/TextoMono';
import { cx } from '../../lib/cx';
import styles from './BarraUso.module.css';

/** Proporción de uso de un cupo: `advertencia` desde 90 % y `peligro` desde 100 %. */
export function nivelDeUso(usados: number, cupo: number): 'normal' | 'advertencia' | 'peligro' {
  if (cupo <= 0) return 'normal';
  const proporcion = usados / cupo;
  if (proporcion >= 1) return 'peligro';
  if (proporcion >= 0.9) return 'advertencia';
  return 'normal';
}

interface Props {
  usados: number;
  cupo: number;
  /** Pista de 12 (hero) en lugar de 8. */
  grande?: boolean;
  /** Sobre el fondo `hero`: pista oscura y relleno blanco. */
  sobreHero?: boolean;
  /** Oculta la etiqueta "87 / 100" cuando el contexto ya la muestra. */
  sinEtiqueta?: boolean;
}

export function BarraUso({
  usados,
  cupo,
  grande = false,
  sobreHero = false,
  sinEtiqueta = false,
}: Props) {
  const nivel = nivelDeUso(usados, cupo);
  const porcentaje = cupo > 0 ? Math.min(100, (usados / cupo) * 100) : 0;
  return (
    <span className={styles.contenedor}>
      <span
        className={cx(styles.pista, grande && styles.grande, sobreHero && styles.pistaHero)}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={cupo}
        aria-valuenow={usados}
      >
        <span
          className={cx(styles.relleno, sobreHero ? styles.rellenoHero : styles[nivel])}
          style={{ width: `${String(porcentaje)}%` }}
        />
      </span>
      {sinEtiqueta ? null : (
        <TextoMono>
          {usados} / {cupo}
        </TextoMono>
      )}
    </span>
  );
}
