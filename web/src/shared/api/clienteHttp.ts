import { CODIGO_SIN_CONEXION, ErrorApi } from './errorApi';
import type { AlmacenSesion } from './almacenSesion';

export type MetodoHttp = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface SolicitudHttp {
  metodo: MetodoHttp;
  /** Ruta bajo `/api/v1`, con `/` inicial. */
  ruta: string;
  consulta?: Readonly<Record<string, string | number | boolean | undefined>>;
  cuerpo?: unknown;
  /** Un archivo como cuerpo crudo (su `type` es el `Content-Type`); no se combina con `cuerpo`. */
  archivo?: Blob;
  /**
   * `blob` devuelve el contenido tal cual (un comprobante) en vez de leerlo como JSON. `respuesta`
   * devuelve la `Response` completa para leer sus cabeceras (las `X-*` de una exportación paginada):
   * el llamador decide el tipo y la autenticación y el refresco siguen igual.
   */
  formato?: 'json' | 'blob' | 'respuesta';
  senal?: AbortSignal;
}

/** Contrato que usan los repositorios; `application` nunca ve `fetch` (DIP). */
export interface ClienteHttp {
  solicitar: <T>(solicitud: SolicitudHttp) => Promise<T>;
}

/**
 * La API sabe que un navegador la usa por esta cabecera y le da el refresco en una cookie `HttpOnly`
 * (ADR 0033 §5). Una página ajena no puede enviarla sin un permiso CORS que la API no da.
 */
const CABECERA_DE_CLIENTE = { 'X-Requested-With': 'agrocom-panel' } as const;

interface Opciones {
  baseUrl: string;
  sesion: AlmacenSesion;
  /** Se invoca cuando el refresco falla: la sesión terminó (PE5c). */
  alSesionVencida: () => void;
  implementacionFetch?: typeof fetch;
}

function armarUrl(base: string, ruta: string, consulta: SolicitudHttp['consulta']): string {
  const url = new URL(`${base}${ruta}`, globalThis.location.origin);
  for (const [clave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== '') url.searchParams.set(clave, String(valor));
  }
  return url.pathname + url.search;
}

async function leerError(respuesta: Response): Promise<ErrorApi> {
  try {
    const cuerpo = (await respuesta.json()) as { code?: string } & Record<string, unknown>;
    const extra = Object.fromEntries(
      Object.entries(cuerpo).filter(
        ([clave]) => !['code', 'type', 'title', 'status'].includes(clave),
      ),
    );
    return new ErrorApi(respuesta.status, cuerpo.code ?? 'desconocido', extra);
  } catch {
    return new ErrorApi(respuesta.status, 'desconocido');
  }
}

/** Implementación con `fetch`: Bearer, un solo reintento tras refrescar en 401 y errores por `code`. */
export function crearClienteFetch({
  baseUrl,
  sesion,
  alSesionVencida,
  implementacionFetch = fetch,
}: Opciones): ClienteHttp {
  async function enviar(solicitud: SolicitudHttp, acceso: string | undefined): Promise<Response> {
    // `Accept` es solo una preferencia: las rutas que devuelven otro tipo (el CSV de una exportación, un
    // comprobante) fijan su propio `Content-Type` y no negocian contenido. Si la API empezara a hacerlo,
    // estas solicitudes (`formato` `blob` o `respuesta`) tendrían que mandar su `Accept` propio.
    const cabeceras: Record<string, string> = {
      Accept: 'application/json',
      ...CABECERA_DE_CLIENTE,
    };
    if (solicitud.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (solicitud.archivo) cabeceras['Content-Type'] = solicitud.archivo.type;
    if (acceso) cabeceras.Authorization = `Bearer ${acceso}`;
    try {
      return await implementacionFetch(armarUrl(baseUrl, solicitud.ruta, solicitud.consulta), {
        method: solicitud.metodo,
        headers: cabeceras,
        body:
          solicitud.archivo ??
          (solicitud.cuerpo === undefined ? undefined : JSON.stringify(solicitud.cuerpo)),
        signal: solicitud.senal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ErrorApi(0, CODIGO_SIN_CONEXION);
    }
  }

  let refrescando: Promise<boolean> | null = null;

  /**
   * Pide un acceso nuevo; el refresco va solo en la cookie, así que el cuerpo es vacío. Las llamadas
   * simultáneas comparten el mismo intento.
   */
  function refrescar(): Promise<boolean> {
    refrescando ??= (async () => {
      const respuesta = await enviar(
        { metodo: 'POST', ruta: '/sesiones/refresco', cuerpo: {} },
        undefined,
      );
      if (!respuesta.ok) return false;
      sesion.guardar(((await respuesta.json()) as { acceso: string }).acceso);
      return true;
    })().finally(() => {
      refrescando = null;
    });
    return refrescando;
  }

  return {
    async solicitar<T>(solicitud: SolicitudHttp): Promise<T> {
      let respuesta = await enviar(solicitud, sesion.obtener() ?? undefined);
      if (respuesta.status === 401 && sesion.obtener()) {
        if (await refrescar()) {
          respuesta = await enviar(solicitud, sesion.obtener() ?? undefined);
        } else {
          sesion.limpiar();
          alSesionVencida();
        }
      }
      if (!respuesta.ok) throw await leerError(respuesta);
      if (respuesta.status === 204) return undefined as T;
      if (solicitud.formato === 'respuesta') return respuesta as T;
      if (solicitud.formato === 'blob') return (await respuesta.blob()) as T;
      return (await respuesta.json()) as T;
    },
  };
}
