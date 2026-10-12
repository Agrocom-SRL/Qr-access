import '@testing-library/jest-dom/vitest';
import { iniciarIdiomas } from '@/l10n';

iniciarIdiomas();

// La pestaña recuerda el refresco entre cargas; cada test arranca sin sesión recordada.
afterEach(() => {
  sessionStorage.clear();
});
