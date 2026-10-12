import type { ReactNode } from 'react';
import { Ilustracion, type NombreIlustracion } from '../molecules/Ilustracion';
import styles from './EstadoVacio.module.css';

interface Props {
  ilustracion?: NombreIlustracion;
  /** Ilustración más grande, para pantallas de estado completas. */
  ilustracionGrande?: boolean;
  titulo: string;
  texto?: string;
  /** Un `AccesoBoton` o enlace con la acción que destraba el vacío. */
  accion?: ReactNode;
  /** Código de la API en mono 12 (solo en el estado de error). */
  codigo?: string;
}

/** Ilustración 200×144, título 20/600, texto de hasta 400 px y acción (PE2, PE4). */
export function EstadoVacio({
  ilustracion = 'vacioPuertas',
  ilustracionGrande = false,
  titulo,
  texto,
  accion,
  codigo,
}: Props) {
  return (
    <div className={styles.estado}>
      <Ilustracion nombre={ilustracion} grande={ilustracionGrande} />
      <h2 className={styles.titulo}>{titulo}</h2>
      {texto ? <p className={styles.texto}>{texto}</p> : null}
      {codigo ? <code className={styles.codigo}>{codigo}</code> : null}
      {accion}
    </div>
  );
}
