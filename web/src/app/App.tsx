import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Ingreso } from './Ingreso';

const clienteConsultas = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Ingreso />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
