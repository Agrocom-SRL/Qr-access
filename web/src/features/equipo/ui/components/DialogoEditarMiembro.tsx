import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useRenombrarMiembro } from '../../application/useEquipo';
import type { MiembroEquipo } from '../../domain/equipo';

interface Props {
  miembro: MiembroEquipo;
  onCerrar: () => void;
}

/** Cambia el nombre de un miembro del equipo; el usuario con el que ingresa no se toca. */
export function DialogoEditarMiembro({ miembro, onCerrar }: Props) {
  const { t } = useTranslation(['equipo', 'comun']);
  const renombrar = useRenombrarMiembro();
  const [nombre, setNombre] = useState(miembro.nombre);
  const valido = nombre.trim() !== '' && nombre.trim() !== miembro.nombre;
  return (
    <Dialogo
      abierto
      titulo={t('equipo:editarTitulo', { nombre: miembro.nombre })}
      onCerrar={onCerrar}
      ancho="angosto"
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={onCerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={renombrar.isPending}
            disabled={!valido}
            onClick={() => {
              renombrar.mutate({ id: miembro.id, nombre }, { onSuccess: onCerrar });
            }}
          >
            {renombrar.isPending ? t('equipo:guardando') : t('equipo:guardar')}
          </AccesoBoton>
        </>
      }
    >
      <AccesoCampoTexto
        etiqueta={t('equipo:nombreCompleto')}
        value={nombre}
        autoComplete="off"
        onChange={(e) => {
          setNombre(e.target.value);
        }}
      />
      {renombrar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(renombrar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
