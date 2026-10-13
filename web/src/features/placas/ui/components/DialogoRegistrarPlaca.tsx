import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import type { PlacaRegistrada } from '../../api/PlacasRepositorio';
import { useRegistrarPlaca } from '../../application/usePlacas';
import { agruparCodigo, normalizarMac } from '../../domain/placa';
import styles from './DialogoRegistrarPlaca.module.css';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

/**
 * Alta de una placa por su MAC. La respuesta trae el código de vinculación en claro, una sola vez:
 * solo vive en el estado de este diálogo mientras se muestra y se descarta al cerrarlo.
 */
export function DialogoRegistrarPlaca({ abierto, onCerrar }: Props) {
  const { t } = useTranslation(['placas', 'comun']);
  const registrar = useRegistrarPlaca();
  const [mac, setMac] = useState('');
  const [tocado, setTocado] = useState(false);
  const [registrada, setRegistrada] = useState<PlacaRegistrada | null>(null);
  const [copiado, setCopiado] = useState(false);

  const macNormalizada = normalizarMac(mac);
  const errorDeMac = tocado && mac !== '' && macNormalizada === null;

  const cerrar = () => {
    setMac('');
    setTocado(false);
    setRegistrada(null);
    setCopiado(false);
    registrar.reset();
    onCerrar();
  };

  const enviar = () => {
    if (macNormalizada === null) return;
    registrar.mutate(macNormalizada, { onSuccess: setRegistrada });
  };

  const comando = registrada ? `set codigo ${registrada.codigo}` : '';
  const copiar = async () => {
    await navigator.clipboard.writeText(comando);
    setCopiado(true);
  };

  if (registrada) {
    return (
      <Dialogo
        abierto={abierto}
        titulo={t('placas:codigoTitulo')}
        onCerrar={cerrar}
        ancho="angosto"
        acciones={<AccesoBoton onClick={cerrar}>{t('placas:listo')}</AccesoBoton>}
      >
        <div className={styles.codigo}>
          <span>{t('placas:codigoDe', { mac: registrada.mac })}</span>
          <span className={styles.codigoTexto}>{agruparCodigo(registrada.codigo)}</span>
          <span>{t('placas:codigoInstruccion')}</span>
          <span className={styles.comando}>{comando}</span>
          <AccesoBoton variante="tonal" icono="content_copy" onClick={() => void copiar()}>
            {copiado ? t('placas:comandoCopiado') : t('placas:copiarComando')}
          </AccesoBoton>
        </div>
        <Aviso tono="advertencia" icono="visibility_lock">
          {t('placas:codigoAviso')}
        </Aviso>
      </Dialogo>
    );
  }

  return (
    <Dialogo
      abierto={abierto}
      titulo={t('placas:registrarTitulo')}
      onCerrar={cerrar}
      ancho="angosto"
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton
            cargando={registrar.isPending}
            disabled={macNormalizada === null || registrar.isPending}
            onClick={enviar}
          >
            {registrar.isPending ? t('placas:registrando') : t('placas:registrarConfirmar')}
          </AccesoBoton>
        </>
      }
    >
      <AccesoCampoTexto
        etiqueta={t('placas:mac')}
        mono
        value={mac}
        placeholder={t('placas:macPlaceholder')}
        ayuda={t('placas:registrarAyuda')}
        autoComplete="off"
        autoCapitalize="characters"
        error={errorDeMac ? t('placas:macInvalida') : undefined}
        onBlur={() => {
          setTocado(true);
        }}
        onChange={(e) => {
          setMac(e.target.value);
        }}
      />
      {registrar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(registrar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
