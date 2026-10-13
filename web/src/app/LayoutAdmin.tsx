import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { tienePermiso, useSesion } from '../features/seguridad';
import { PlantillaAdmin } from '../shared/ui/templates/PlantillaAdmin';
import { RailNavegacion, type ItemRail } from '../shared/ui/organisms/RailNavegacion';
import { PantallaSesionVencida } from '../shared/ui/organisms/PantallasDeEstado';
import { PantallaDeCarga } from '../shared/ui/organisms/PantallaDeCarga';
import { RUTAS } from './rutas';

const ITEMS: readonly (ItemRail & { permiso?: string })[] = [
  {
    clave: 'resumen',
    ruta: RUTAS.resumen,
    icono: 'space_dashboard',
    iconoActivo: 'space_dashboard_fill',
  },
  {
    clave: 'cuentas',
    ruta: RUTAS.cuentas,
    icono: 'apartment',
    iconoActivo: 'apartment_fill',
    permiso: 'seguridad.cuenta.ver',
  },
  {
    clave: 'cobranza',
    ruta: RUTAS.cobranza,
    icono: 'payments',
    iconoActivo: 'payments_fill',
    permiso: 'suscripciones.cobranza.ver',
  },
  {
    clave: 'placas',
    ruta: RUTAS.placas,
    icono: 'memory',
    iconoActivo: 'memory_fill',
    permiso: 'dispositivos.placa.ver',
  },
  {
    clave: 'planes',
    ruta: RUTAS.planes,
    icono: 'sell',
    iconoActivo: 'sell_fill',
    permiso: 'suscripciones.plan.ver',
  },
  {
    clave: 'bitacora',
    ruta: RUTAS.bitacora,
    icono: 'history',
    iconoActivo: 'history_fill',
    permiso: 'bitacora.registro.ver',
  },
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
  const { sesion, restaurando, vencida } = useSesion();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  if (restaurando) return <PantallaDeCarga />;
  if (!sesion && vencida) {
    return (
      <PantallaSesionVencida
        onIngresar={() => {
          void navegar(RUTAS.ingreso, { state: { desde: ubicacion.pathname } });
        }}
      />
    );
  }
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
