import { tienePermiso, useSesion } from '../../../seguridad';
import { JerarquiaDeCuenta } from './JerarquiaDeCuenta';
import { UsoDeUsuarios } from './UsoDeUsuarios';
import styles from './PestanaUsuarios.module.css';

/**
 * Pestaña «Usuarios» de la ficha de una cuenta: quién depende de quién (y a quién se reasigna) y cuánto usa
 * cada usuario. Antes la jerarquía vivía en el Resumen y el uso en Suscripción; juntos se leen como un solo tema.
 */
export function PestanaUsuarios({ cuentaId }: { cuentaId: string }) {
  const { sesion } = useSesion();
  const puedeReasignar = tienePermiso(sesion?.permisos ?? [], 'seguridad.administrador.reasignar');
  return (
    <div className={styles.apilado}>
      <JerarquiaDeCuenta cuentaId={cuentaId} puedeReasignar={puedeReasignar} />
      <UsoDeUsuarios cuentaId={cuentaId} />
    </div>
  );
}
