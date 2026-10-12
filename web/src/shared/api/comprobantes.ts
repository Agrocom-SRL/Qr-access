import type { ClienteHttp } from './clienteHttp';

/** Sube un comprobante de pago y devuelve su id, para referenciarlo en el pago (ADR 0024). */
export async function subirComprobante(cliente: ClienteHttp, archivo: File): Promise<string> {
  const { id } = await cliente.solicitar<{ id: string }>({
    metodo: 'POST',
    ruta: '/plataforma/comprobantes',
    archivo,
  });
  return id;
}

/** El archivo de un comprobante, para mostrarlo o descargarlo (la API lo entrega con la sesión). */
export function bajarComprobante(cliente: ClienteHttp, id: string): Promise<Blob> {
  return cliente.solicitar<Blob>({
    metodo: 'GET',
    ruta: `/plataforma/comprobantes/${id}`,
    formato: 'blob',
  });
}
