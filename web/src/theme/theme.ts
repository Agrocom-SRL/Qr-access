// AGROCOM Acceso · Panel web · theme equivalente a acceso-tokens.css
// Úsalo para lógica en TS (gráficos, tests, estilos condicionales). En estilos, prefiere var(--token).

export const verde = {
  50: '#E8F5EE',
  100: '#C5E6D2',
  200: '#93D0AB',
  300: '#5CB683',
  400: '#2B9A5D',
  500: '#007A33',
  600: '#006B2D',
  700: '#005824',
  800: '#00451C',
  900: '#002F13',
} as const;

const claro = {
  fondo: '#F5F7F6',
  superficie: '#FFFFFF',
  superficieElevada: '#FFFFFF',
  borde: '#DDE2DF',
  texto: '#1B1F1C',
  textoSecundario: '#5B635D',
  primario: '#007A33',
  primarioHover: '#006B2D',
  sobrePrimario: '#FFFFFF',
  primarioSuave: '#E8F5EE',
  peligro: '#C62828',
  peligroSuave: '#FDECEC',
  advertencia: '#965A00',
  advertenciaSuave: '#FFF3E0',
  informacion: '#1565C0',
  informacionSuave: '#E8F1FB',
  hero: '#007A33',
  sobreHero: '#FFFFFF',
  heroAcento: '#006B2D',
  heroTextoSuave: '#E8F5EE',
  accesoPermitido: verde[500],
  accesoDenegado: '#C62828',
  skeleton: '#E9EDEA',
  scrim: 'rgba(27,31,28,0.48)',
} as const;

const oscuro: Record<keyof typeof claro, string> = {
  fondo: '#121614',
  superficie: '#1C211E',
  superficieElevada: '#242A26',
  borde: '#2C332E',
  texto: '#E6EAE7',
  textoSecundario: '#A3ABA5',
  primario: '#5CB683',
  primarioHover: '#93D0AB',
  sobrePrimario: '#002F13',
  primarioSuave: '#002F13',
  peligro: '#EF7A7A',
  peligroSuave: '#3A1C1C',
  advertencia: '#F2B54A',
  advertenciaSuave: '#33270F',
  informacion: '#7EB6F2',
  informacionSuave: '#14263A',
  hero: '#00451C',
  sobreHero: '#FFFFFF',
  heroAcento: '#005824',
  heroTextoSuave: '#E8F5EE',
  accesoPermitido: '#5CB683',
  accesoDenegado: '#EF7A7A',
  skeleton: '#262C28',
  scrim: 'rgba(0,0,0,0.6)',
};

export const color = { claro, oscuro };

export const tipografia = {
  fuenteTexto: "'IBM Plex Sans', system-ui, sans-serif",
  fuenteMono: "'IBM Plex Mono', ui-monospace, monospace", // códigos de cuenta, cifras, fechas, montos, PIN
  tamano: { 12: 12, 14: 14, 16: 16, 20: 20, 24: 24, 32: 32 },
  peso: { regular: 400, medio: 500, semibold: 600 },
  interlineado: { titulo: 1.3, cuerpo: 1.5 },
} as const;

export const espacio = { 2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, 48: 48 } as const;
export const radio = { 6: 6, 10: 10, 14: 14, 20: 20, completo: 999 } as const;

export const elevacion = {
  claro: {
    0: 'none',
    1: '0 1px 2px rgba(27,31,28,0.06), 0 1px 3px rgba(27,31,28,0.06)',
    3: '0 8px 24px rgba(27,31,28,0.10), 0 2px 4px rgba(27,31,28,0.04)',
  },
  oscuro: { 0: 'none', 1: 'none', 3: 'none' },
} as const;

export const movimiento = {
  duracion: { rapida: 120, media: 200, lenta: 300 },
  curva: 'cubic-bezier(0.33, 1, 0.68, 1)', // ease-out-cubic
} as const;

export const layout = {
  altoControl: 48,
  altoMinimoTactil: 44,
  railExtendido: 240,
  railColapsado: 80,
  anchoFormulario: 720,
  anchoContenido: 1200,
  breakpoints: { tablet: 768, escritorio: 1024 },
} as const;

/** Estado de suscripción → tokens. Siempre ícono + texto, nunca solo color. */
export const badgeSuscripcion = {
  activa: {
    fondo: 'primarioSuave',
    texto: 'primario',
    icono: 'check_circle',
    etiqueta: 'suscripcion.estado.activa',
  },
  porVencer: {
    fondo: 'advertenciaSuave',
    texto: 'advertencia',
    icono: 'schedule',
    etiqueta: 'suscripcion.estado.porVencer',
  },
  vencida: {
    fondo: 'peligroSuave',
    texto: 'peligro',
    icono: 'event_busy',
    etiqueta: 'suscripcion.estado.vencida',
  },
  suspendida: {
    fondo: 'fondo',
    texto: 'textoSecundario',
    borde: 'borde',
    icono: 'pause_circle',
    etiqueta: 'suscripcion.estado.suspendida',
  },
  pendientePago: {
    fondo: 'advertenciaSuave',
    texto: 'advertencia',
    icono: 'pending_actions',
    etiqueta: 'suscripcion.estado.pendientePago',
  },
} as const;

/** Acciones de fila con color fijo. */
export const colorAccion = {
  ver: 'informacion',
  editar: 'advertencia',
  eliminar: 'peligro',
  suspender: 'peligro',
} as const;

export type Tema = 'claro' | 'oscuro';
export type TokenColor = keyof typeof claro;
