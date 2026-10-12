import bloqueo from '../assets/ilustraciones/bloqueo.svg';
import error from '../assets/ilustraciones/error.svg';
import sinConexion from '../assets/ilustraciones/sin_conexion.svg';
import vacioEventos from '../assets/ilustraciones/vacio_eventos.svg';
import vacioPuertas from '../assets/ilustraciones/vacio_puertas.svg';
import vacioQr from '../assets/ilustraciones/vacio_qr.svg';
import styles from './Ilustracion.module.css';

/**
 * unDraw recoloreadas al verde de marca, copiadas de `app/assets/ilustraciones` (se reusan las de la app).
 * TODO(docs): edificios, calendario, búsqueda, equipo y seguridad no existen en la app; hasta
 * bajarlas de unDraw, esas pantallas usan la más cercana.
 */
const ILUSTRACIONES = { bloqueo, error, sinConexion, vacioEventos, vacioPuertas, vacioQr } as const;

export type NombreIlustracion = keyof typeof ILUSTRACIONES;

/** Ilustración decorativa de 200×144. */
export function Ilustracion({ nombre }: { nombre: NombreIlustracion }) {
  return <img className={styles.imagen} src={ILUSTRACIONES[nombre]} alt="" />;
}
