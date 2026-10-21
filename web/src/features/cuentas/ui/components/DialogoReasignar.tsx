import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useReasignar } from '../../application/useCuentas';
import type { RamaDeAdministrador } from '../../domain/cuenta';
import styles from './DialogoReasignar.module.css';

/** Lo que se va a mover: un Guardia, o un Titular con su unidad y sus Miembros. */
export interface Reasignable {
  id: string;
  etiqueta: string;
  tipo: 'guardia' | 'titular';
  /** Cuántos Miembros lo siguen (solo un Titular). */
  miembros: number;
  /** El Administrador que lo tiene hoy. */
  administradorId: string;
}

interface Props {
  cuentaId: string;
  /** `null` = cerrado. */
  aMover: Reasignable | null;
  /** Los Administradores a los que se puede mover (sin el actual). */
  destinos: readonly RamaDeAdministrador[];
  onCerrar: () => void;
}

/**
 * Mueve un Guardia o una unidad completa a otro Administrador de la cuenta (ADR 0028 §7). Solo
 * AGROCOM puede: un Administrador nunca abre un camino hacia la rama de otro. El cupo no cambia y
 * la operación queda en la bitácora.
 */
export function DialogoReasignar({ cuentaId, aMover, destinos, onCerrar }: Props) {
  const { t } = useTranslation(['detalle', 'comun']);
  const reasignar = useReasignar(cuentaId);
  const [destinoId, setDestinoId] = useState('');

  const cerrar = () => {
    setDestinoId('');
    reasignar.reset();
    onCerrar();
  };

  return (
    <Dialogo
      abierto={aMover !== null}
      titulo={t('detalle:reasignarTitulo', { nombre: aMover?.etiqueta ?? '' })}
      ancho="ancho"
      onCerrar={cerrar}
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={reasignar.isPending}
            disabled={destinoId === '' || aMover === null}
            onClick={() => {
              if (aMover === null) return;
              reasignar.mutate(
                { usuarioId: aMover.id, administradorId: destinoId },
                { onSuccess: cerrar },
              );
            }}
          >
            {reasignar.isPending ? t('detalle:reasignando') : t('detalle:reasignar')}
          </AccesoBoton>
        </>
      }
    >
      <p className={styles.texto}>
        {aMover?.tipo === 'titular'
          ? t('detalle:reasignarTextoTitular', { count: aMover.miembros })
          : t('detalle:reasignarTextoGuardia')}
      </p>
      <AccesoSelectorBuscable
        etiqueta={t('detalle:reasignarDestino')}
        placeholder={t('detalle:reasignarElegir')}
        conBusqueda={false}
        valor={destinoId}
        opciones={destinos.map((rama) => ({ valor: rama.id, etiqueta: rama.etiqueta }))}
        onCambio={setDestinoId}
      />
      {reasignar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(reasignar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
