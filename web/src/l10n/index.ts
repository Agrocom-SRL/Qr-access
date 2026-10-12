import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import app from './es/app.json';
import auth from './es/auth.json';
import bitacora from './es/bitacora.json';
import cambiarPlan from './es/cambiarPlan.json';
import cobranza from './es/cobranza.json';
import comun from './es/comun.json';
import crearCuenta from './es/crearCuenta.json';
import cuentas from './es/cuentas.json';
import detalle from './es/detalle.json';
import equipo from './es/equipo.json';
import estadisticas from './es/estadisticas.json';
import estados from './es/estados.json';
import estructura from './es/estructura.json';
import errores from './es/errores.json';
import nav from './es/nav.json';
import pago from './es/pago.json';
import perfil from './es/perfil.json';
import planes from './es/planes.json';
import resumen from './es/resumen.json';
import suscripcion from './es/suscripcion.json';

/** Idioma por defecto del panel; `en` se agrega con los mismos namespaces (ADR 0022). */
export const IDIOMA_POR_DEFECTO = 'es';

/** Un namespace por módulo, más `comun` y `errores` compartidos. */
export const recursos = {
  es: {
    app,
    auth,
    bitacora,
    cambiarPlan,
    cobranza,
    comun,
    crearCuenta,
    cuentas,
    detalle,
    equipo,
    errores,
    estadisticas,
    estados,
    estructura,
    nav,
    pago,
    perfil,
    planes,
    resumen,
    suscripcion,
  },
} as const;

/** Inicia i18next una sola vez; los tests y `main.tsx` lo invocan. */
export function iniciarIdiomas(idioma: string = IDIOMA_POR_DEFECTO) {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources: recursos,
      lng: idioma,
      fallbackLng: IDIOMA_POR_DEFECTO,
      defaultNS: 'comun',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18next;
}

export { i18next };
