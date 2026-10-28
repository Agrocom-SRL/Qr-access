import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AlmacenSesion } from '../../../shared/api/almacenSesion';
import type { SesionIniciada } from '../domain/sesion';
import { useSeguridadRepositorio } from './contextos';

interface ContextoSesion {
  /** `null` si no hay sesión. */
  sesion: SesionIniciada | null;
  /** `true` mientras se recupera la sesión con la cookie de refresco (al arrancar o recargar). */
  restaurando: boolean;
  /** `true` cuando la API cortó la sesión (refresco fallido): se muestra PE5c. */
  vencida: boolean;
  iniciar: (sesion: SesionIniciada) => void;
  /** Cierre voluntario: no es una sesión vencida. */
  terminar: () => void;
}

const Contexto = createContext<ContextoSesion | null>(null);

/**
 * Estado de sesión de la interfaz. El acceso vive en el `AlmacenSesion` (memoria); acá solo quién
 * entró. Si el acceso desaparece sin que el usuario cierre sesión, la sesión venció.
 */
export function SesionProvider({
  almacen,
  children,
}: {
  almacen: AlmacenSesion;
  children: ReactNode;
}) {
  const acceso = useSyncExternalStore(
    (aviso) => almacen.suscribir(aviso),
    () => almacen.obtener(),
  );
  const [sesion, setSesion] = useState<SesionIniciada | null>(null);
  const [vencida, setVencida] = useState(false);
  // Al arrancar no se sabe si hay cookie de refresco (es `HttpOnly`): siempre se intenta restaurar.
  const [restaurando, setRestaurando] = useState(true);
  const cierreVoluntario = useRef(false);
  const repositorio = useSeguridadRepositorio();

  useEffect(() => {
    if (!restaurando) return;
    let activo = true;
    void repositorio.restaurar().then((recuperada) => {
      if (!activo) return;
      if (recuperada) setSesion((actual) => actual ?? recuperada);
      setRestaurando(false);
    });
    return () => {
      activo = false;
    };
  }, [repositorio, restaurando]);

  useEffect(() => {
    if (acceso === null && sesion !== null && !cierreVoluntario.current) {
      setSesion(null);
      setVencida(true);
    }
  }, [acceso, sesion]);

  const iniciar = useCallback((nueva: SesionIniciada) => {
    cierreVoluntario.current = false;
    setVencida(false);
    setSesion(nueva);
  }, []);
  const terminar = useCallback(() => {
    cierreVoluntario.current = true;
    setSesion(null);
  }, []);

  const valor = useMemo(
    () => ({ sesion, vencida, restaurando, iniciar, terminar }),
    [sesion, vencida, restaurando, iniciar, terminar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion requiere <SesionProvider>');
  return valor;
}
