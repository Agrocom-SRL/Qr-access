import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccesoBoton } from '../atoms/AccesoBoton';
import { TextoMono } from '../atoms/TextoMono';
import styles from './TarjetaGrafica.module.css';

export interface TablaDeGrafica {
  encabezados: readonly string[];
  filas: readonly (readonly (string | number)[])[];
}

interface Props {
  titulo: string;
  subtitulo?: string;
  /** La gráfica. */
  children: ReactNode;
  /** Los mismos datos como tabla: nadie depende del color ni de pasar el cursor para leerlos. */
  tabla: TablaDeGrafica;
  /** Ocupa dos columnas de la rejilla. */
  ancha?: boolean;
}

/** Tarjeta de una gráfica: título, la gráfica y un botón para verla como tabla (accesibilidad). */
export function TarjetaGrafica({ titulo, subtitulo, children, tabla, ancha = false }: Props) {
  const { t } = useTranslation('estadisticas');
  const [verTabla, setVerTabla] = useState(false);
  const id = useId();
  return (
    <section
      className={[styles.tarjeta, ancha ? styles.ancha : ''].filter(Boolean).join(' ')}
      aria-labelledby={id}
    >
      <header className={styles.cabecera}>
        <div>
          <h2 id={id} className={styles.titulo}>
            {titulo}
          </h2>
          {subtitulo ? <p className={styles.subtitulo}>{subtitulo}</p> : null}
        </div>
        <AccesoBoton
          variante="texto"
          aria-pressed={verTabla}
          onClick={() => {
            setVerTabla((v) => !v);
          }}
        >
          {verTabla ? t('verGrafica') : t('verTabla')}
        </AccesoBoton>
      </header>
      {verTabla ? (
        <div className={styles.tablaCaja}>
          <table className={styles.tabla}>
            <caption className={styles.oculto}>{titulo}</caption>
            <thead>
              <tr>
                {tabla.encabezados.map((encabezado) => (
                  <th key={encabezado} scope="col">
                    {encabezado}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((fila) => (
                <tr key={String(fila[0])}>
                  {fila.map((celda, i) => (
                    <td key={`${String(fila[0])}-${String(i)}`}>
                      {i === 0 ? celda : <TextoMono>{celda}</TextoMono>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
