import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useCambiarNombre } from '../../application/useSeguridad';

interface Props {
  abierto: boolean;
  nombreActual: string;
  onCerrar: () => void;
}

/** Modal para cambiar el nombre visible. */
export function DialogoNombre({ abierto, nombreActual, onCerrar }: Props) {
  const { t } = useTranslation(['perfil', 'comun']);
  const cambiar = useCambiarNombre();
  const [nombre, setNombre] = useState(nombreActual);
  const cerrar = () => {
    cambiar.reset();
    onCerrar();
  };
  return (
    <Dialogo
      abierto={abierto}
      titulo={t('perfil:editarNombre')}
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            type="submit"
            form="form-nombre"
            cargando={cambiar.isPending}
            disabled={nombre.trim() === ''}
          >
            {cambiar.isPending ? t('perfil:guardando') : t('perfil:guardarNombre')}
          </AccesoBoton>
        </>
      }
    >
      <form
        id="form-nombre"
        onSubmit={(e) => {
          e.preventDefault();
          cambiar.mutate(nombre, { onSuccess: cerrar });
        }}
      >
        <AccesoCampoTexto
          etiqueta={t('perfil:nombre')}
          value={nombre}
          autoComplete="name"
          error={cambiar.error ? traducirError(t, codigoDe(cambiar.error)) : undefined}
          onChange={(e) => {
            setNombre(e.target.value);
          }}
        />
      </form>
    </Dialogo>
  );
}
