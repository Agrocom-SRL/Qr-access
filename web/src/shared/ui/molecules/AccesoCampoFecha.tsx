import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { localeDe } from '../../../l10n/formatos';
import { cx } from '../../lib/cx';
import { Icono } from '../atoms/Icono';
import { CampoFormulario } from './CampoFormulario';
import controles from './controles.module.css';
import estilos from './AccesoCampoFecha.module.css';

interface Props {
  etiqueta: string;
  /** `aaaa-mm-dd`; `''` = sin fecha. */
  valor: string;
  onCambio: (valor: string) => void;
  ayuda?: string;
  error?: string;
  onBlur?: () => void;
  /** Ofrece "Limpiar": para filtros donde la fecha es opcional. */
  limpiable?: boolean;
}

interface Dia {
  anio: number;
  mes: number; // 1-12
  dia: number;
}

const ZONA = 'America/La_Paz';

function aTexto({ anio, mes, dia }: Dia): string {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function deTexto(texto: string): Dia | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return null;
  return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

/** Suma `dias` a un día del calendario sin pasar por la zona horaria del navegador. */
function sumarDias(d: Dia, dias: number): Dia {
  const fecha = new Date(Date.UTC(d.anio, d.mes - 1, d.dia + dias));
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate() };
}

function sumarMeses(d: Dia, meses: number): Dia {
  const fecha = new Date(Date.UTC(d.anio, d.mes - 1 + meses, 1));
  const ultimo = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return {
    anio: fecha.getUTCFullYear(),
    mes: fecha.getUTCMonth() + 1,
    dia: Math.min(d.dia, ultimo),
  };
}

/** Hoy en La Paz (invariante 7: las fechas del panel se leen en la zona del negocio). */
function hoy(): Dia {
  const texto = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, dateStyle: 'short' }).format(
    new Date(),
  );
  return deTexto(texto) ?? { anio: 2026, mes: 1, dia: 1 };
}

/** Las semanas del mes (lunes primero) con `null` en los huecos. */
function semanasDe(anio: number, mes: number): (Dia | null)[][] {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay(); // 0 = domingo
  const desfase = (primero + 6) % 7;
  const total = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const celdas: (Dia | null)[] = [
    ...Array.from({ length: desfase }, () => null),
    ...Array.from({ length: total }, (_, i) => ({ anio, mes, dia: i + 1 })),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
}

/**
 * Campo de fecha con el calendario del diseño, en lugar del `<input type="date">` nativo (cuyo
 * aspecto no se puede tematizar). Teclado: flechas mueven el día, AvPág/RePág el mes, Esc cierra.
 * Los nombres de meses y días salen de `Intl` según el idioma activo.
 */
export function AccesoCampoFecha({
  etiqueta,
  valor,
  onCambio,
  ayuda,
  error,
  onBlur,
  limpiable = false,
}: Props) {
  const { t, i18n } = useTranslation('comun');
  const locale = localeDe(i18n.language);
  const idDialogo = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const elegida = deTexto(valor);
  const [enfoque, setEnfoque] = useState<Dia>(() => elegida ?? hoy());
  const hoyDia = hoy();

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', alPulsar);
    return () => {
      document.removeEventListener('mousedown', alPulsar);
    };
  }, [abierto]);

  // El foco sigue al día de referencia: el elegido o hoy al abrir, y el que mueven las flechas.
  useEffect(() => {
    if (abierto) raiz.current?.querySelector<HTMLButtonElement>('[data-enfoque="true"]')?.focus();
  }, [abierto, enfoque]);

  const nombres = useMemo(() => {
    const mes = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const dia = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    const largo = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' });
    const corto = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
    // 2024-01-01 fue lunes: de ahí salen los nombres de la semana.
    const semana = Array.from({ length: 7 }, (_, i) =>
      dia.format(new Date(Date.UTC(2024, 0, 1 + i))),
    );
    return { mes, semana, largo, corto };
  }, [locale]);
  const enUtc = (d: Dia) => new Date(Date.UTC(d.anio, d.mes - 1, d.dia));
  const mostrada = elegida ? nombres.corto.format(enUtc(elegida)) : '';

  const cerrar = () => {
    setAbierto(false);
    disparador.current?.focus();
    onBlur?.();
  };
  const elegir = (dia: Dia) => {
    onCambio(aTexto(dia));
    cerrar();
  };
  const alTeclear = (e: KeyboardEvent) => {
    const mover: Record<string, Dia> = {
      ArrowLeft: sumarDias(enfoque, -1),
      ArrowRight: sumarDias(enfoque, 1),
      ArrowUp: sumarDias(enfoque, -7),
      ArrowDown: sumarDias(enfoque, 7),
      PageUp: sumarMeses(enfoque, -1),
      PageDown: sumarMeses(enfoque, 1),
    };
    const destino = mover[e.key];
    if (destino) {
      e.preventDefault();
      setEnfoque(destino);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
    }
  };

  return (
    <CampoFormulario etiqueta={etiqueta} ayuda={ayuda} error={error}>
      {(control) => (
        <div className={estilos.raiz} ref={raiz}>
          <button
            {...control}
            ref={disparador}
            type="button"
            className={cx(controles.control, controles.mono, estilos.disparador)}
            aria-haspopup="dialog"
            aria-expanded={abierto}
            aria-controls={abierto ? idDialogo : undefined}
            onClick={() => {
              if (!abierto) setEnfoque(elegida ?? hoy());
              setAbierto(!abierto);
            }}
          >
            <span className={mostrada === '' ? estilos.vacio : undefined}>
              {mostrada === '' ? t('elegirFecha') : mostrada}
            </span>
            <Icono nombre="calendar_today" tamano={20} />
          </button>
          {abierto ? (
            <div
              id={idDialogo}
              role="dialog"
              aria-label={etiqueta}
              className={estilos.calendario}
              onKeyDown={alTeclear}
            >
              <header className={estilos.cabecera}>
                <button
                  type="button"
                  className={estilos.mes}
                  aria-label={t('mesAnterior')}
                  onClick={() => {
                    setEnfoque(sumarMeses(enfoque, -1));
                  }}
                >
                  <Icono nombre="chevron_left" tamano={20} />
                </button>
                <strong className={estilos.titulo} aria-live="polite">
                  {nombres.mes.format(new Date(Date.UTC(enfoque.anio, enfoque.mes - 1, 1)))}
                </strong>
                <button
                  type="button"
                  className={estilos.mes}
                  aria-label={t('mesSiguiente')}
                  onClick={() => {
                    setEnfoque(sumarMeses(enfoque, 1));
                  }}
                >
                  <Icono nombre="chevron_right" tamano={20} />
                </button>
              </header>
              <table className={estilos.tabla} role="grid">
                <thead>
                  <tr>
                    {nombres.semana.map((nombre) => (
                      <th key={nombre} scope="col" className={estilos.diaSemana}>
                        {nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {semanasDe(enfoque.anio, enfoque.mes).map((semana, i) => (
                    <tr key={i}>
                      {semana.map((dia, j) => (
                        <td key={j}>
                          {dia ? (
                            <button
                              type="button"
                              className={cx(
                                estilos.dia,
                                aTexto(dia) === valor && estilos.elegido,
                                aTexto(dia) === aTexto(hoyDia) && estilos.hoy,
                              )}
                              aria-label={nombres.largo.format(enUtc(dia))}
                              aria-pressed={aTexto(dia) === valor}
                              data-enfoque={dia.dia === enfoque.dia}
                              tabIndex={dia.dia === enfoque.dia ? 0 : -1}
                              onClick={() => {
                                elegir(dia);
                              }}
                            >
                              {dia.dia}
                            </button>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <footer className={estilos.pie}>
                <button
                  type="button"
                  className={estilos.accion}
                  onClick={() => {
                    elegir(hoyDia);
                  }}
                >
                  {t('hoy')}
                </button>
                {limpiable && valor !== '' ? (
                  <button
                    type="button"
                    className={estilos.accion}
                    onClick={() => {
                      onCambio('');
                      cerrar();
                    }}
                  >
                    {t('limpiar')}
                  </button>
                ) : null}
              </footer>
            </div>
          ) : null}
        </div>
      )}
    </CampoFormulario>
  );
}
