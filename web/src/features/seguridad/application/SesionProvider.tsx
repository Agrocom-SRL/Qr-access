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

interface ContextoSesion {
  /** `null` si no hay sesión. */
  sesion: SesionIniciada | null;
  /** `true` cuando la API cortó la sesión (refresco fallido): se muestra PE5c. */
  vencida: boolean;
  iniciar: (sesion: SesionIniciada) => void;
  /** Cierre voluntario: no es una sesión vencida. */
  terminar: () => void;
}

const Contexto = createContext<ContextoSesion | null>(null);

/**
 * Estado de sesión de la interfaz. Los tokens viven en el `AlmacenSesion` (memoria); acá solo
 * quién entró. Si los tokens desaparecen sin que el usuario cierre sesión, la sesión venció.
 */
export function SesionProvider({
  almacen,
  children,
}: {
  almacen: AlmacenSesion;
  children: ReactNode;
}) {
  const tokens = useSyncExternalStore(
    (aviso) => almacen.suscribir(aviso),
    () => almacen.obtener(),
  );
  const [sesion, setSesion] = useState<SesionIniciada | null>(null);
  const [vencida, setVencida] = useState(false);
  const cierreVoluntario = useRef(false);

  useEffect(() => {
    if (tokens === null && sesion !== null && !cierreVoluntario.current) {
      setSesion(null);
      setVencida(true);
    }
  }, [tokens, sesion]);

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
    () => ({ sesion, vencida, iniciar, terminar }),
    [sesion, vencida, iniciar, terminar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion requiere <SesionProvider>');
  return valor;
}
