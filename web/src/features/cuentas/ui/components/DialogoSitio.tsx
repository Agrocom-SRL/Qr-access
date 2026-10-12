import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoInterruptor } from '../../../../shared/ui/atoms/AccesoInterruptor';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useGestionDeEstructura } from '../../application/useCuentas';
import { ZONA_POR_DEFECTO, zonasHorarias } from '../../domain/estructura';
import type { SitioConPuertas } from '../../domain/cuenta';
import styles from './DialogoEditarCuenta.module.css';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  cuentaId: string;
  /** El sitio a editar; `null` crea uno nuevo. */
  sitio: SitioConPuertas | null;
}

/** Alta y edición de un sitio: el lugar físico donde están las puertas de la cuenta (HU-07). */
export function DialogoSitio({ abierto, onCerrar, cuentaId, sitio }: Props) {
  const { t } = useTranslation(['estructura', 'comun']);
  const { crearSitio, editarSitio } = useGestionDeEstructura(cuentaId);
  const [nombre, setNombre] = useState(sitio?.nombre ?? '');
  const [direccion, setDireccion] = useState(sitio?.direccion ?? '');
  const [zona, setZona] = useState(sitio?.zonaHoraria ?? ZONA_POR_DEFECTO);
  const [activo, setActivo] = useState(sitio?.activo ?? true);
  const [tocado, setTocado] = useState(false);

  const mutacion = sitio === null ? crearSitio : editarSitio;
  const cerrar = () => {
    setNombre(sitio?.nombre ?? '');
    setDireccion(sitio?.direccion ?? '');
    setZona(sitio?.zonaHoraria ?? ZONA_POR_DEFECTO);
    setActivo(sitio?.activo ?? true);
    setTocado(false);
    mutacion.reset();
    onCerrar();
  };
  const valido = nombre.trim() !== '' && zona !== '';
  const guardar = () => {
    if (sitio === null) {
      crearSitio.mutate({ nombre, direccion, zonaHoraria: zona }, { onSuccess: cerrar });
    } else {
      editarSitio.mutate(
        { sitioId: sitio.id, cambios: { nombre, direccion, zonaHoraria: zona, activo } },
        { onSuccess: cerrar },
      );
    }
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo={sitio === null ? t('estructura:sitioNuevo') : t('estructura:sitioEditar')}
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton cargando={mutacion.isPending} disabled={!valido} onClick={guardar}>
            {mutacion.isPending ? t('estructura:guardando') : t('estructura:guardar')}
          </AccesoBoton>
        </>
      }
    >
      <div className={styles.campos}>
        <AccesoCampoTexto
          etiqueta={t('estructura:sitioNombre')}
          value={nombre}
          ayuda={t('estructura:sitioNombreAyuda')}
          error={tocado && nombre.trim() === '' ? t('estructura:requerido') : undefined}
          autoComplete="off"
          onBlur={() => {
            setTocado(true);
          }}
          onChange={(e) => {
            setNombre(e.target.value);
          }}
        />
        <AccesoCampoTexto
          etiqueta={t('estructura:direccion')}
          value={direccion}
          autoComplete="off"
          onChange={(e) => {
            setDireccion(e.target.value);
          }}
        />
        <AccesoSelectorBuscable
          etiqueta={t('estructura:zona')}
          ayuda={t('estructura:zonaAyuda')}
          valor={zona}
          opciones={zonasHorarias().map((z) => ({ valor: z, etiqueta: z }))}
          onCambio={setZona}
        />
        {sitio === null ? null : (
          <AccesoInterruptor
            etiqueta={t('estructura:sitioActivo')}
            checked={activo}
            onChange={(e) => {
              setActivo(e.target.checked);
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
