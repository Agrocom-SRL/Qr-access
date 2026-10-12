import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoInterruptor } from '../../../../shared/ui/atoms/AccesoInterruptor';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useGestionDeEstructura } from '../../application/useCuentas';
import {
  SEGUNDOS_MAXIMOS,
  SEGUNDOS_MINIMOS,
  SEGUNDOS_POR_DEFECTO,
  segundosValidos,
} from '../../domain/estructura';
import type { PuertaDeSitio } from '../../domain/cuenta';
import styles from './DialogoEditarCuenta.module.css';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  cuentaId: string;
  /** El sitio donde se crea la puerta (alta) o al que pertenece (edición). */
  sitio: { id: string; nombre: string };
  /** La puerta a editar; `null` crea una nueva. */
  puerta: PuertaDeSitio | null;
}

/** Alta y edición de una puerta: su nombre, cuánto queda abierta la cerradura y si está habilitada (HU-08). */
export function DialogoPuerta({ abierto, onCerrar, cuentaId, sitio, puerta }: Props) {
  const { t } = useTranslation(['estructura', 'comun']);
  const { crearPuerta, editarPuerta } = useGestionDeEstructura(cuentaId);
  const [nombre, setNombre] = useState(puerta?.nombre ?? '');
  const [segundos, setSegundos] = useState(
    String(puerta?.segundosApertura ?? SEGUNDOS_POR_DEFECTO),
  );
  const [activa, setActiva] = useState(puerta?.activa ?? true);
  const [tocados, setTocados] = useState<ReadonlySet<'nombre' | 'segundos'>>(new Set());

  const mutacion = puerta === null ? crearPuerta : editarPuerta;
  const cerrar = () => {
    setNombre(puerta?.nombre ?? '');
    setSegundos(String(puerta?.segundosApertura ?? SEGUNDOS_POR_DEFECTO));
    setActiva(puerta?.activa ?? true);
    setTocados(new Set());
    mutacion.reset();
    onCerrar();
  };
  const numero = Number(segundos);
  const nombreValido = nombre.trim() !== '';
  const segundosOk = segundosValidos(numero);
  const tocar = (campo: 'nombre' | 'segundos') => {
    setTocados((actual) => new Set(actual).add(campo));
  };
  const guardar = () => {
    if (puerta === null) {
      crearPuerta.mutate(
        { sitioId: sitio.id, datos: { nombre, segundosApertura: numero } },
        { onSuccess: cerrar },
      );
    } else {
      editarPuerta.mutate(
        { puertaId: puerta.id, cambios: { nombre, segundosApertura: numero, activa } },
        { onSuccess: cerrar },
      );
    }
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo={
        puerta === null
          ? t('estructura:puertaNueva', { sitio: sitio.nombre })
          : t('estructura:puertaEditar')
      }
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={mutacion.isPending}
            disabled={!nombreValido || !segundosOk}
            onClick={guardar}
          >
            {mutacion.isPending ? t('estructura:guardando') : t('estructura:guardar')}
          </AccesoBoton>
        </>
      }
    >
      <div className={styles.campos}>
        <AccesoCampoTexto
          etiqueta={t('estructura:puertaNombre')}
          value={nombre}
          ayuda={t('estructura:puertaNombreAyuda')}
          error={tocados.has('nombre') && !nombreValido ? t('estructura:requerido') : undefined}
          autoComplete="off"
          onBlur={() => {
            tocar('nombre');
          }}
          onChange={(e) => {
            setNombre(e.target.value);
          }}
        />
        <AccesoCampoTexto
          etiqueta={t('estructura:segundos')}
          type="number"
          min={SEGUNDOS_MINIMOS}
          max={SEGUNDOS_MAXIMOS}
          mono
          value={segundos}
          ayuda={t('estructura:segundosAyuda', { min: SEGUNDOS_MINIMOS, max: SEGUNDOS_MAXIMOS })}
          error={
            tocados.has('segundos') && !segundosOk
              ? t('estructura:segundosInvalidos', { min: SEGUNDOS_MINIMOS, max: SEGUNDOS_MAXIMOS })
              : undefined
          }
          onBlur={() => {
            tocar('segundos');
          }}
          onChange={(e) => {
            setSegundos(e.target.value);
          }}
        />
        {puerta === null ? null : (
          <AccesoInterruptor
            etiqueta={t('estructura:puertaActiva')}
            checked={activa}
            onChange={(e) => {
              setActiva(e.target.checked);
            }}
          />
        )}
      </div>
      {mutacion.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(mutacion.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
