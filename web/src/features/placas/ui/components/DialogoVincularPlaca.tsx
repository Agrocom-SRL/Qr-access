import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useCuentas, useSitiosYPuertas, type SitioConPuertas } from '../../../cuentas';
import { useVincularPlaca } from '../../application/usePlacas';
import { minutosRestantes, type Placa } from '../../domain/placa';

/** Las puertas activas de la cuenta que todavía no tienen lector, con su sitio. */
function puertasLibres(sitios: readonly SitioConPuertas[] | undefined): OpcionSelector[] {
  return (sitios ?? []).flatMap((sitio) =>
    sitio.puertas
      .filter((puerta) => puerta.activa && puerta.dispositivo === null)
      .map((puerta) => ({ valor: puerta.id, etiqueta: `${sitio.nombre} · ${puerta.nombre}` })),
  );
}

interface Props {
  placa: Placa;
  onCerrar: () => void;
}

/**
 * Asigna la placa a una puerta sin lector de una cuenta; el nombre del lector arranca con el de la
 * puerta. Es de dos pasos (ADR 0026): elegir y, una vez pedido el vínculo, la instrucción de
 * pulsar el botón de la placa, que es lo que lo confirma.
 */
export function DialogoVincularPlaca({ placa, onCerrar }: Props) {
  const { t } = useTranslation(['placas', 'comun']);
  const vincular = useVincularPlaca();
  const [busqueda, setBusqueda] = useState('');
  const [cuenta, setCuenta] = useState<OpcionSelector | null>(null);
  const [puertaId, setPuertaId] = useState('');
  const [nombre, setNombre] = useState('');
  const [nombreEditado, setNombreEditado] = useState(false);
  const [esperaHasta, setEsperaHasta] = useState<Date | null>(null);

  const cuentas = useCuentas({ busqueda, estado: 'todas', pagina: 1 });
  const sitios = useSitiosYPuertas(cuenta?.valor ?? '', cuenta !== null);

  const opcionesDeCuenta: OpcionSelector[] = (cuentas.data?.elementos ?? []).map((c) => ({
    valor: c.id,
    etiqueta: `${c.codigo} · ${c.nombre}`,
  }));
  // La cuenta elegida sigue en la lista aunque la búsqueda ya no la devuelva.
  if (cuenta !== null && !opcionesDeCuenta.some((o) => o.valor === cuenta.valor)) {
    opcionesDeCuenta.unshift(cuenta);
  }
  const opcionesDePuerta = puertasLibres(sitios.data);
  const sinPuertasLibres = cuenta !== null && sitios.isSuccess && opcionesDePuerta.length === 0;

  const puedeVincular = cuenta !== null && puertaId !== '' && nombre.trim() !== '';

  const elegirPuerta = (id: string) => {
    setPuertaId(id);
    const etiqueta = opcionesDePuerta.find((o) => o.valor === id)?.etiqueta ?? '';
    if (!nombreEditado) setNombre(etiqueta.split(' · ').at(-1) ?? '');
  };

  const enviar = () => {
    if (cuenta === null) return;
    vincular.mutate(
      { placaId: placa.id, datos: { cuentaId: cuenta.valor, puertaId, nombre: nombre.trim() } },
      {
        onSuccess: ({ porConfirmarHasta }) => {
          setEsperaHasta(porConfirmarHasta);
        },
      },
    );
  };

  if (esperaHasta !== null) {
    return (
      <Dialogo
        abierto
        titulo={t('placas:confirmarTitulo')}
        onCerrar={onCerrar}
        ancho="angosto"
        acciones={<AccesoBoton onClick={onCerrar}>{t('placas:listo')}</AccesoBoton>}
      >
        <p>{t('placas:confirmarTexto', { mac: placa.mac })}</p>
        <ol>
          <li>{t('placas:confirmarPaso1')}</li>
          <li>{t('placas:confirmarPaso2')}</li>
          <li>{t('placas:confirmarPaso3')}</li>
        </ol>
        <Aviso tono="informacion">
          {t('placas:confirmarVentana', { count: minutosRestantes(esperaHasta, new Date()) })}
        </Aviso>
      </Dialogo>
    );
  }

  return (
    <Dialogo
      abierto
      titulo={t('placas:vincularTitulo')}
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
      <p>{t('placas:vincularTexto', { mac: placa.mac })}</p>
      <AccesoSelectorBuscable
        etiqueta={t('placas:cuenta')}
        placeholder={t('placas:cuentaPlaceholder')}
        opciones={opcionesDeCuenta}
        valor={cuenta?.valor ?? ''}
        onBusqueda={setBusqueda}
        onCambio={(valor) => {
          setCuenta(opcionesDeCuenta.find((o) => o.valor === valor) ?? null);
          setPuertaId('');
          if (!nombreEditado) setNombre('');
        }}
      />
      <AccesoSelectorBuscable
        etiqueta={t('placas:puerta')}
        placeholder={t('placas:puertaPlaceholder')}
        opciones={opcionesDePuerta}
        valor={puertaId}
        deshabilitado={cuenta === null || opcionesDePuerta.length === 0}
        error={sinPuertasLibres ? t('placas:sinPuertasLibres') : undefined}
        onCambio={elegirPuerta}
      />
      <AccesoCampoTexto
        etiqueta={t('placas:nombreLector')}
        value={nombre}
        autoComplete="off"
        onChange={(e) => {
          setNombreEditado(true);
          setNombre(e.target.value);
        }}
      />
      {vincular.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(vincular.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
