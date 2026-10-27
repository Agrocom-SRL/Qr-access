import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { tienePermiso, useSesion } from '../features/seguridad';
import { EstadoVacio } from '../shared/ui/organisms/EstadoVacio';

/**
 * Muestra la pantalla solo si la sesión tiene uno de los permisos. Es cortesía de la interfaz: la
 * autoridad es la API, que responde 403 aunque alguien llegue a la ruta a mano (ADR 0021).
 */
export function ConPermiso({
  permisos,
  children,
}: {
  permisos: readonly string[];
  children: ReactNode;
}) {
  const { t } = useTranslation('comun');
  const { sesion } = useSesion();
  const permitido =
    sesion !== null && permisos.some((permiso) => tienePermiso(sesion.permisos, permiso));
  if (!permitido) {
    return (
      <EstadoVacio
        ilustracion="bloqueo"
        titulo={t('sinPermiso.titulo')}
        texto={t('sinPermiso.texto')}
      />
    );
  }
  return <>{children}</>;
}
