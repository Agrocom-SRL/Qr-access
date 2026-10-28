import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { iniciarIdiomas } from './l10n';
import './theme/global.css';

iniciarIdiomas();

// react-select genera sus estilos en runtime (emotion, etiquetas <style>) y la CSP no admite estilos en
// línea: solo los que lleven el nonce de la petición, que nginx escribe en este meta y en la cabecera.
// Sin nginx (vite dev) el marcador queda sin reemplazar y no hay CSP que lo exija.
const nonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;
const cacheDeEstilos = createCache({
  key: 'css',
  nonce: nonce && !nonce.startsWith('__') ? nonce : undefined,
});

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento #raiz en index.html');
createRoot(raiz).render(
  <StrictMode>
    <CacheProvider value={cacheDeEstilos}>
      <App />
    </CacheProvider>
  </StrictMode>,
);
