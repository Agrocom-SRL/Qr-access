import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { tienePermiso, useSesion } from '../features/seguridad';
import { PlantillaAdmin } from '../shared/ui/templates/PlantillaAdmin';
import { RailNavegacion, type ItemRail } from '../shared/ui/organisms/RailNavegacion';
import { RUTAS } from './rutas';

const ITEMS: readonly (ItemRail & { permiso?: string })[] = [
  {
    clave: 'resumen',
    ruta: RUTAS.resumen,
    icono: 'space_dashboard',
    iconoActivo: 'space_dashboard_fill',
  },
  { clave: 'cuentas', ruta: RUTAS.cuentas, icono: 'apartment', iconoActivo: 'apartment_fill' },
  { clave: 'cobranza', ruta: RUTAS.cobranza, icono: 'payments', iconoActivo: 'payments_fill' },
  { clave: 'planes', ruta: RUTAS.planes, icono: 'sell', iconoActivo: 'sell_fill' },
  { clave: 'bitacora', ruta: RUTAS.bitacora, icono: 'history', iconoActivo: 'history_fill' },
  {
    clave: 'equipo',
    ruta: RUTAS.equipo,
    icono: 'group',
    iconoActivo: 'group_fill',
    permiso: 'seguridad.equipo.ver',
  },
];

/**
 * Guarda de sesión y marco de las pantallas autenticadas. Sin sesión lleva a ingreso; con
 * contraseña temporal solo deja entrar a Perfil. La autoridad de los permisos es la API: acá
 * solo se oculta lo que el rol no puede (ADR 0021).
 */
export function LayoutAdmin() {
  const { sesion } = useSesion();
  const ubicacion = useLocation();
  if (!sesion) return <Navigate to={RUTAS.ingreso} replace state={{ desde: ubicacion.pathname }} />;
  if (sesion.debeCambiarContrasena && ubicacion.pathname !== RUTAS.perfil) {
    return <Navigate to={RUTAS.perfil} replace />;
  }
  const items = ITEMS.filter(
    (item) => item.permiso === undefined || tienePermiso(sesion.permisos, item.permiso),
  );
  return (
    <PlantillaAdmin
      rail={
        <RailNavegacion
          items={items}
          usuario={{ nombre: sesion.usuario.nombre, rutaPerfil: RUTAS.perfil }}
        />
      }
    >
      <Outlet />
    </PlantillaAdmin>
  );
}
