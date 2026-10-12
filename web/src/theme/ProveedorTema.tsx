import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** Preferencia del usuario; "sistema" sigue `prefers-color-scheme`. */
export type PreferenciaTema = 'claro' | 'oscuro' | 'sistema';

const CLAVE_TEMA = 'acceso.tema';

interface ContextoTema {
  preferencia: PreferenciaTema;
  /** Tema realmente aplicado en `<html data-tema>`. */
  aplicado: 'claro' | 'oscuro';
  elegir: (preferencia: PreferenciaTema) => void;
}

const Contexto = createContext<ContextoTema | null>(null);

function leerPreferencia(): PreferenciaTema {
  try {
    const guardada = localStorage.getItem(CLAVE_TEMA);
    if (guardada === 'claro' || guardada === 'oscuro' || guardada === 'sistema') return guardada;
  } catch {
    // Almacenamiento bloqueado: se usa el sistema.
  }
  return 'sistema';
}

function sistemaOscuro(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Aplica `data-tema` en `<html>` y recuerda la elección (README del handoff, "Tema"). */
export function ProveedorTema({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(leerPreferencia);
  const [oscuroSistema, setOscuroSistema] = useState(sistemaOscuro);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = (e: MediaQueryListEvent) => {
      setOscuroSistema(e.matches);
    };
    consulta.addEventListener('change', alCambiar);
    return () => {
      consulta.removeEventListener('change', alCambiar);
    };
  }, []);

  const aplicado = preferencia === 'sistema' ? (oscuroSistema ? 'oscuro' : 'claro') : preferencia;

  useEffect(() => {
    document.documentElement.dataset.tema = aplicado;
  }, [aplicado]);

  const elegir = useCallback((nueva: PreferenciaTema) => {
    setPreferencia(nueva);
    try {
      localStorage.setItem(CLAVE_TEMA, nueva);
    } catch {
      // Sin almacenamiento la elección dura la sesión.
    }
  }, []);

  const valor = useMemo(() => ({ preferencia, aplicado, elegir }), [preferencia, aplicado, elegir]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema(): ContextoTema {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useTema requiere <ProveedorTema>');
  return valor;
}
