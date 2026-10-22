import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import es_app from './es/app.json';
import es_auth from './es/auth.json';
import es_bitacora from './es/bitacora.json';
import es_cambiarPlan from './es/cambiarPlan.json';
import es_cobranza from './es/cobranza.json';
import es_cobro from './es/cobro.json';
import es_comun from './es/comun.json';
import es_crearCuenta from './es/crearCuenta.json';
import es_cuentas from './es/cuentas.json';
import es_detalle from './es/detalle.json';
import es_equipo from './es/equipo.json';
import es_errores from './es/errores.json';
import es_estadisticas from './es/estadisticas.json';
import es_eventos from './es/eventos.json';
import es_estados from './es/estados.json';
import es_estructura from './es/estructura.json';
import es_nav from './es/nav.json';
import es_pago from './es/pago.json';
import es_perfil from './es/perfil.json';
import es_placas from './es/placas.json';
import es_planes from './es/planes.json';
import es_resumen from './es/resumen.json';
import es_suscripcion from './es/suscripcion.json';
import en_app from './en/app.json';
import en_auth from './en/auth.json';
import en_bitacora from './en/bitacora.json';
import en_cambiarPlan from './en/cambiarPlan.json';
import en_cobranza from './en/cobranza.json';
import en_cobro from './en/cobro.json';
import en_comun from './en/comun.json';
import en_crearCuenta from './en/crearCuenta.json';
import en_cuentas from './en/cuentas.json';
import en_detalle from './en/detalle.json';
import en_equipo from './en/equipo.json';
import en_errores from './en/errores.json';
import en_estadisticas from './en/estadisticas.json';
import en_eventos from './en/eventos.json';
import en_estados from './en/estados.json';
import en_estructura from './en/estructura.json';
import en_nav from './en/nav.json';
import en_pago from './en/pago.json';
import en_perfil from './en/perfil.json';
import en_placas from './en/placas.json';
import en_planes from './en/planes.json';
import en_resumen from './en/resumen.json';
import en_suscripcion from './en/suscripcion.json';
import pt_app from './pt/app.json';
import pt_auth from './pt/auth.json';
import pt_bitacora from './pt/bitacora.json';
import pt_cambiarPlan from './pt/cambiarPlan.json';
import pt_cobranza from './pt/cobranza.json';
import pt_cobro from './pt/cobro.json';
import pt_comun from './pt/comun.json';
import pt_crearCuenta from './pt/crearCuenta.json';
import pt_cuentas from './pt/cuentas.json';
import pt_detalle from './pt/detalle.json';
import pt_equipo from './pt/equipo.json';
import pt_errores from './pt/errores.json';
import pt_estadisticas from './pt/estadisticas.json';
import pt_eventos from './pt/eventos.json';
import pt_estados from './pt/estados.json';
import pt_estructura from './pt/estructura.json';
import pt_nav from './pt/nav.json';
import pt_pago from './pt/pago.json';
import pt_perfil from './pt/perfil.json';
import pt_placas from './pt/placas.json';
import pt_planes from './pt/planes.json';
import pt_resumen from './pt/resumen.json';
import pt_suscripcion from './pt/suscripcion.json';

/** Idiomas del panel: cada uno con los mismos namespaces (ADR 0022). */
export const IDIOMAS = ['es', 'en', 'pt'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** Idioma por defecto del panel. */
export const IDIOMA_POR_DEFECTO: Idioma = 'es';

const CLAVE_IDIOMA = 'acceso.idioma';

/** Un namespace por módulo, más `comun` y `errores` compartidos. */
export const recursos = {
  es: {
    app: es_app,
    auth: es_auth,
    bitacora: es_bitacora,
    cambiarPlan: es_cambiarPlan,
    cobranza: es_cobranza,
    cobro: es_cobro,
    comun: es_comun,
    crearCuenta: es_crearCuenta,
    cuentas: es_cuentas,
    detalle: es_detalle,
    equipo: es_equipo,
    errores: es_errores,
    estadisticas: es_estadisticas,
    eventos: es_eventos,
    estados: es_estados,
    estructura: es_estructura,
    nav: es_nav,
    pago: es_pago,
    perfil: es_perfil,
    placas: es_placas,
    planes: es_planes,
    resumen: es_resumen,
    suscripcion: es_suscripcion,
  },
  en: {
    app: en_app,
    auth: en_auth,
    bitacora: en_bitacora,
    cambiarPlan: en_cambiarPlan,
    cobranza: en_cobranza,
    cobro: en_cobro,
    comun: en_comun,
    crearCuenta: en_crearCuenta,
    cuentas: en_cuentas,
    detalle: en_detalle,
    equipo: en_equipo,
    errores: en_errores,
    estadisticas: en_estadisticas,
    eventos: en_eventos,
    estados: en_estados,
    estructura: en_estructura,
    nav: en_nav,
    pago: en_pago,
    perfil: en_perfil,
    placas: en_placas,
    planes: en_planes,
    resumen: en_resumen,
    suscripcion: en_suscripcion,
  },
  pt: {
    app: pt_app,
    auth: pt_auth,
    bitacora: pt_bitacora,
    cambiarPlan: pt_cambiarPlan,
    cobranza: pt_cobranza,
    cobro: pt_cobro,
    comun: pt_comun,
    crearCuenta: pt_crearCuenta,
    cuentas: pt_cuentas,
    detalle: pt_detalle,
    equipo: pt_equipo,
    errores: pt_errores,
    estadisticas: pt_estadisticas,
    eventos: pt_eventos,
    estados: pt_estados,
    estructura: pt_estructura,
    nav: pt_nav,
    pago: pt_pago,
    perfil: pt_perfil,
    placas: pt_placas,
    planes: pt_planes,
    resumen: pt_resumen,
    suscripcion: pt_suscripcion,
  },
} as const;

function esIdioma(valor: string | null): valor is Idioma {
  return IDIOMAS.some((idioma) => idioma === valor);
}

/** El idioma que la persona eligió la última vez; sin elección, el español. */
export function idiomaGuardado(): Idioma {
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA);
    if (esIdioma(guardado)) return guardado;
  } catch {
    // Almacenamiento bloqueado: se usa el idioma por defecto.
  }
  return IDIOMA_POR_DEFECTO;
}

/** Inicia i18next una sola vez; los tests y `main.tsx` lo invocan. */
export function iniciarIdiomas(idioma: Idioma = idiomaGuardado()) {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources: recursos,
      lng: idioma,
      fallbackLng: IDIOMA_POR_DEFECTO,
      defaultNS: 'comun',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    document.documentElement.lang = idioma;
  }
  return i18next;
}

/** Cambia el idioma de todo el panel y lo recuerda para la próxima vez. */
export async function cambiarIdioma(idioma: Idioma): Promise<void> {
  await i18next.changeLanguage(idioma);
  document.documentElement.lang = idioma;
  try {
    localStorage.setItem(CLAVE_IDIOMA, idioma);
  } catch {
    // Sin almacenamiento, el cambio vale solo hasta recargar.
  }
}

export { i18next };
