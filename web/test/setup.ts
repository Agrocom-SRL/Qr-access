import '@testing-library/jest-dom/vitest';
import { iniciarIdiomas } from '@/l10n';

iniciarIdiomas();

// Recharts mide su contenedor con ResizeObserver, que jsdom no trae.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// La pestaña recuerda el refresco entre cargas; cada test arranca sin sesión recordada.
afterEach(() => {
  sessionStorage.clear();
});
