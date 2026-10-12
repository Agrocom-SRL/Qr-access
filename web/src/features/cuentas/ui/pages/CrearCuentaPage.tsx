import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { cx } from '../../../../shared/lib/cx';
import { rutaDePago } from '../../../../shared/lib/rutas';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { Migas } from '../../../../shared/ui/molecules/Migas';
import { Stepper } from '../../../../shared/ui/organisms/Stepper';
import { usePlanes } from '../../../planes';
import { useCodigoDisponible, useCrearCuenta } from '../../application/useCuentas';
import {
  BORRADOR_VACIO,
  hoyIso,
  validarEmpresa,
  validarPagoDeAlta,
  validarVigencia,
  type BorradorDeCuenta,
} from '../../domain/alta';
import { RUTAS_DE_CUENTAS } from '../../rutas';
import { CuentaCreadaPantalla } from '../components/CuentaCreadaPantalla';
import { PasoConfirmar } from '../components/PasoConfirmar';
import { PasoEmpresa } from '../components/PasoEmpresa';
import { PasoPlan } from '../components/PasoPlan';
import { PasoVigencia } from '../components/PasoVigencia';
import styles from './CrearCuentaPage.module.css';

const PASOS = ['empresa', 'plan', 'vigencia', 'confirmar'] as const;

interface Creada {
  cuentaId: string;
  cuenta: string;
  administrador: string;
  /** Vive solo en este estado: nunca en la caché de consultas, el almacenamiento ni un log. */
  pin: string;
  /** La cuenta quedó sin pagar su alta: hay que registrar el pago en Cobranza. */
  pendientePago: boolean;
}

/** A04a–e: asistente de 4 pasos para crear una cuenta y mostrar el PIN inicial una sola vez. */
export function CrearCuentaPage() {
  const { t } = useTranslation(['crearCuenta', 'comun']);
  const navegar = useNavigate();
  const crear = useCrearCuenta();
  const planes = usePlanes();
  const [paso, setPaso] = useState(0);
  const [borrador, setBorrador] = useState<BorradorDeCuenta>(() => BORRADOR_VACIO(hoyIso()));
  const [creada, setCreada] = useState<Creada | null>(null);
  const codigo = useCodigoDisponible(borrador.empresa.codigo, borrador.empresa.razonSocial);

  const idPaso = PASOS[paso] ?? 'empresa';
  const planElegido = planes.data?.find((plan) => plan.id === borrador.planId) ?? null;
  const codigoLibre = codigo.resultado?.disponible === true;

  const puedeContinuar =
    idPaso === 'empresa'
      ? Object.keys(validarEmpresa(borrador.empresa)).length === 0 && codigoLibre
      : idPaso === 'plan'
        ? planElegido !== null
        : idPaso === 'vigencia'
          ? Object.keys(validarVigencia(borrador.vigencia)).length === 0
          : Object.keys(validarPagoDeAlta(borrador.pago)).length === 0;

  const volverALista = () => {
    void navegar(RUTAS_DE_CUENTAS.lista);
  };

  const continuar = () => {
    if (!puedeContinuar) return;
    setPaso((actual) => actual + 1);
  };

  const confirmar = () => {
    crear.mutate(borrador, {
      onSuccess: (resultado) => {
        setCreada({
          cuentaId: resultado.cuenta.id,
          cuenta: resultado.cuenta.nombre,
          administrador: resultado.administrador.etiqueta,
          pin: resultado.administrador.pin,
          pendientePago: resultado.estado === 'pendientePago',
        });
        // Se suelta el resultado de la mutación: el PIN ya solo vive en `creada`.
        crear.reset();
      },
    });
  };

  if (creada) {
    return (
      <CuentaCreadaPantalla
        cuenta={creada.cuenta}
        administrador={creada.administrador}
        pin={creada.pin}
        pendientePago={creada.pendientePago}
        onIrALaCuenta={() => {
          const destino = RUTAS_DE_CUENTAS.detalle(creada.cuentaId);
          setCreada(null);
          void navegar(destino);
        }}
        onRegistrarPago={() => {
          const destino = rutaDePago(creada.cuentaId);
          setCreada(null);
          void navegar(destino);
        }}
      />
    );
  }

  const { empresa } = borrador;
  const migas = [
    { etiqueta: t('crearCuenta:migas.cuentas'), ruta: RUTAS_DE_CUENTAS.lista },
    {
      etiqueta:
        paso === 0 || empresa.razonSocial === ''
          ? t('crearCuenta:migas.crear')
          : `${t('crearCuenta:migas.crear')} · ${empresa.razonSocial} · ${empresa.codigo}`,
    },
  ];

  return (
    <div className={cx(styles.pagina, idPaso === 'plan' && styles.ancha)}>
      <header>
        <Migas migas={migas} />
        <h1 className={styles.titulo}>{t(`crearCuenta:titulos.${idPaso}`)}</h1>
      </header>
      <Stepper
        etiqueta={t('crearCuenta:pasosEtiqueta')}
        actual={paso}
        pasos={PASOS.map((id) => ({ id, etiqueta: t(`crearCuenta:pasos.${id}`) }))}
      />

      {idPaso === 'empresa' ? (
        <PasoEmpresa
          datos={borrador.empresa}
          onCambio={(datos) => {
            setBorrador((actual) => ({ ...actual, empresa: datos }));
          }}
        />
      ) : null}
      {idPaso === 'plan' ? (
        <PasoPlan
          planId={borrador.planId}
          onElegir={(planId) => {
            setBorrador((actual) => ({ ...actual, planId }));
          }}
        />
      ) : null}
      {idPaso === 'vigencia' ? (
        <PasoVigencia
          datos={borrador.vigencia}
          nombreDelResponsable={borrador.empresa.contactoNombre}
          onCambio={(vigencia) => {
            setBorrador((actual) => ({ ...actual, vigencia }));
          }}
        />
      ) : null}
      {idPaso === 'confirmar' && planElegido ? (
        <PasoConfirmar
          borrador={borrador}
          plan={planElegido}
          onEditar={(destino) => {
            setPaso(destino);
          }}
          onPago={(pago) => {
            setBorrador((actual) => ({ ...actual, pago }));
          }}
        />
      ) : null}

      {crear.isError ? (
        <Aviso tono="peligro">
          {traducirError(t, codigoDe(crear.error), errorExtra(crear.error))}
        </Aviso>
      ) : null}

      <footer className={styles.acciones}>
        {paso === 0 ? (
          <AccesoBoton variante="texto" onClick={volverALista}>
            {t('comun:cancelar')}
          </AccesoBoton>
        ) : (
          <AccesoBoton
            variante="tonal"
            icono="arrow_back"
            disabled={crear.isPending}
            onClick={() => {
              setPaso((actual) => actual - 1);
            }}
          >
            {t('crearCuenta:atras')}
          </AccesoBoton>
        )}
        {idPaso === 'confirmar' ? (
          <AccesoBoton icono="check" cargando={crear.isPending} onClick={confirmar}>
            {crear.isPending ? t('crearCuenta:creando') : t('crearCuenta:crear')}
          </AccesoBoton>
        ) : (
          <AccesoBoton disabled={!puedeContinuar} onClick={continuar}>
            {t('comun:continuar')}
          </AccesoBoton>
        )}
      </footer>
    </div>
  );
}

/** Parámetros del mensaje de error (p. ej. el nombre de la cuenta que ya usa el código). */
function errorExtra(error: unknown): Record<string, unknown> {
  return typeof error === 'object' && error !== null && 'extra' in error
    ? (error.extra as Record<string, unknown>)
    : {};
}
