import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearTranscurrido } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import {
  AccesoSelectorBuscable,
  type OpcionSelector,
} from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { usePlacas, useVincularPlaca } from '../../application/usePlacas';
import type { Placa } from '../../domain/placa';
import type { UbicacionDelLector } from '../../domain/placa';
import { DialogoConfirmarEnPuerta } from './DialogoConfirmarEnPuerta';
import { SelectorDeUbicacion } from './SelectorDeUbicacion';

interface Props {
  cuentaId: string;
  puerta: { id: string; nombre: string };
  onCerrar: () => void;
}

/** Texto de una placa en el selector: MAC, IP y hace cuánto se anunció. */
function etiquetaDe(placa: Placa, ahora: Date): string {
  return [
    placa.mac,
    placa.ip,
    placa.ultimoContactoEn ? formatearTranscurrido(placa.ultimoContactoEn, ahora) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Vincula una placa ya detectada a una puerta concreta de la cuenta (ADR 0026): es el camino
 * inverso al de la página de placas, que parte de la placa y elige la puerta. El vínculo se pide
 * igual (ventana de confirmación) y solo se completa con el botón de la placa.
 */
export function DialogoVincularAPuerta({ cuentaId, puerta, onCerrar }: Props) {
  const { t } = useTranslation(['placas', 'comun']);
  const vincular = useVincularPlaca();
  const detectadas = usePlacas({ busqueda: '', estado: 'detectada', conexion: 'todas', pagina: 1 });
  const [placaId, setPlacaId] = useState('');
  const [nombre, setNombre] = useState(puerta.nombre);
  const [sentido, setSentido] = useState<UbicacionDelLector>('ambos');
  const [esperaHasta, setEsperaHasta] = useState<Date | null>(null);

  const placas = detectadas.data?.elementos ?? [];
  const ahora = new Date();
  const opciones: OpcionSelector[] = placas.map((p) => ({
    valor: p.id,
    etiqueta: etiquetaDe(p, ahora),
  }));
  const elegida = placas.find((p) => p.id === placaId);
  const sinPlacas = detectadas.isSuccess && placas.length === 0;
  const puedeVincular = elegida !== undefined && nombre.trim() !== '';

  const enviar = () => {
    if (elegida === undefined) return;
    vincular.mutate(
      {
        placaId: elegida.id,
        datos: { cuentaId, puertaId: puerta.id, nombre: nombre.trim(), sentido },
      },
      {
        onSuccess: ({ porConfirmarHasta }) => {
          setEsperaHasta(porConfirmarHasta);
        },
      },
    );
  };

  if (esperaHasta !== null && elegida !== undefined) {
    return (
      <DialogoConfirmarEnPuerta mac={elegida.mac} esperaHasta={esperaHasta} onCerrar={onCerrar} />
    );
  }

  return (
    <Dialogo
      abierto
      titulo={t('placas:vincularAPuertaTitulo', { puerta: puerta.nombre })}
      onCerrar={onCerrar}
      ancho="angosto"
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={onCerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={vincular.isPending}
            disabled={!puedeVincular || vincular.isPending}
            onClick={enviar}
          >
            {vincular.isPending ? t('placas:vinculando') : t('placas:vincularConfirmar')}
          </AccesoBoton>
        </>
      }
    >
      <p>{t('placas:vincularAPuertaTexto')}</p>
      <AccesoSelectorBuscable
        etiqueta={t('placas:placa')}
        placeholder={t('placas:placaPlaceholder')}
        opciones={opciones}
        valor={placaId}
        deshabilitado={opciones.length === 0}
        error={sinPlacas ? t('placas:sinPlacasDetectadas') : undefined}
        onCambio={setPlacaId}
      />
      <SelectorDeUbicacion valor={sentido} onCambio={setSentido} />
      <AccesoCampoTexto
        etiqueta={t('placas:nombreLector')}
        value={nombre}
        autoComplete="off"
        onChange={(e) => {
          setNombre(e.target.value);
        }}
      />
      {detectadas.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(detectadas.error))}</Aviso>
      ) : null}
      {vincular.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(vincular.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
