import type { ReactNode } from 'react';
import styles from './FormularioSecciones.module.css';

export interface Seccion {
  id: string;
  titulo: string;
  descripcion?: string;
  /** Acción a la derecha del título (p. ej. "Editar" en la revisión). */
  accion?: ReactNode;
  contenido: ReactNode;
}

/** Tarjeta con una o más secciones separadas por una línea; cada una con su título (A04). */
export function FormularioSecciones({ secciones }: { secciones: readonly Seccion[] }) {
  return (
    <div className={styles.tarjeta}>
      {secciones.map((seccion) => (
        <section
          key={seccion.id}
          className={styles.seccion}
          aria-labelledby={`seccion-${seccion.id}`}
        >
          <header className={styles.cabecera}>
            <div>
              <h2 id={`seccion-${seccion.id}`} className={styles.titulo}>
                {seccion.titulo}
              </h2>
              {seccion.descripcion ? (
                <p className={styles.descripcion}>{seccion.descripcion}</p>
              ) : null}
            </div>
            {seccion.accion}
          </header>
          {seccion.contenido}
        </section>
      ))}
    </div>
  );
}
