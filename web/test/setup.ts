import '@testing-library/jest-dom/vitest';
import { iniciarIdiomas } from '@/l10n';

iniciarIdiomas();

// Recharts mide su contenedor con ResizeObserver, que jsdom no trae.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Ningún test deja datos en el almacenamiento del navegador: el refresco vive en una cookie HttpOnly
// que el panel no ve, y los tests que comprueban que no se guarda nada parten de un almacenamiento vacío.
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
