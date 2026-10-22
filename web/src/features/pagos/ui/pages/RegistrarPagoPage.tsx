import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatearFecha, formatearMonto, formatearNumero } from '../../../../l10n/formatos';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { RUTAS, rutaDeCuenta } from '../../../../shared/lib/rutas';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { FilaClaveValor } from '../../../../shared/ui/molecules/FilaClaveValor';
import { Migas } from '../../../../shared/ui/molecules/Migas';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { useSuscripcionDeCuenta } from '../../../suscripciones';
import { useRegistrarPago } from '../../application/usePagos';
import {
  parsearMonto,
  validarPago,
  type FormularioDePago,
  type TipoDePago,
} from '../../domain/pago';
import { CamposDePago } from '../components/CamposDePago';
import styles from './RegistrarPagoPage.module.css';

const TODOS_LOS_CAMPOS: ReadonlySet<keyof FormularioDePago> = new Set([
  'monto',
  'fechaPago',
  'referencia',
  'comprobante',
]);

const hoy = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', dateStyle: 'short' }).format(
    new Date(),
  );

/** El monto como lo escribe la persona: con puntos de miles, sin decimales. */
const montoEscrito = (valor: number) => formatearNumero(valor);

/** Suma 12 meses de calendario para mostrar la nueva vigencia (la cuenta la calcula la API). */
function masUnAnio(fecha: Date): Date {
  const siguiente = new Date(fecha.getTime());
  siguiente.setUTCFullYear(siguiente.getUTCFullYear() + 1);
  return siguiente;
}

/**
 * A07: registra el pago de una cuenta. Una renovación extiende 12 meses desde el vencimiento; con
 * `?tipo=mejora` cobra la diferencia de un cambio de plan y no cambia la vigencia (ADR 0022). Una
 * cuenta nueva pendiente de pago registra su pago de alta: la activa y el año corre desde la fecha del pago.
 */
export function RegistrarPagoPage() {
  const { t } = useTranslation(['pago', 'comun', 'suscripcion']);
  const { cuentaId = '' } = useParams();
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const consulta = useSuscripcionDeCuenta(cuentaId);
  const registrar = useRegistrarPago(cuentaId);

  const montoSugerido = Number(parametros.get('monto'));
  const [formulario, setFormulario] = useState<FormularioDePago | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [tocados, setTocados] = useState<ReadonlySet<keyof FormularioDePago>>(new Set());

  if (consulta.isError) {
    return (
      <EstadoError
        titulo={t('pago:errorCarga')}
        code={codigoDe(consulta.error)}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }
  if (consulta.isPending) {
    return (
      <div aria-busy="true">
        <Skeleton alto="bloque" />
      </div>
    );
  }

  const { cuenta, suscripcion } = consulta.data;
  const tipo: TipoDePago =
    suscripcion.estado === 'pendientePago'
      ? 'alta'
      : parametros.get('tipo') === 'mejora'
        ? 'mejora_de_plan'
        : 'renovacion';
  const sugerido =
    tipo === 'mejora_de_plan' && montoSugerido > 0 ? montoSugerido : suscripcion.plan.precioAnual;
  const datos: FormularioDePago = formulario ?? {
    monto: montoEscrito(sugerido),
    fechaPago: hoy(),
    medio: 'efectivo',
    referencia: '',
    comprobante: null,
  };
  const errores = validarPago(datos);
  const valido = Object.keys(errores).length === 0 && suscripcion.estado !== 'suspendida';
  const cambiar = (parcial: Partial<FormularioDePago>) => {
    setFormulario({ ...datos, ...parcial });
  };
  const tocar = (campo: keyof FormularioDePago) => {
    setTocados((actual) => new Set(actual).add(campo));
  };

  const venceNuevo =
    tipo === 'alta'
      ? masUnAnio(new Date(`${datos.fechaPago}T12:00:00Z`))
      : tipo === 'renovacion'
        ? masUnAnio(suscripcion.hasta)
        : suscripcion.hasta;
  const volver = () => {
    void navegar(rutaDeCuenta(cuentaId, 'suscripcion'));
  };
  const confirmar = () => {
    registrar.mutate(
      { tipo, formulario: datos },
      {
        onSuccess: () => {
          setConfirmando(false);
          volver();
        },
        onSettled: () => {
          setConfirmando(false);
        },
      },
    );
  };

  const subtitulo = t(
    tipo === 'mejora_de_plan'
      ? 'pago:subtituloMejora'
      : tipo === 'alta'
        ? 'pago:subtituloAlta'
        : 'pago:subtituloRenovacion',
    { cuenta: cuenta.nombre, plan: suscripcion.plan.nombre },
  );

  return (
    <div className={styles.pagina}>
      <header>
        <Migas
          migas={[{ etiqueta: t('pago:migas'), ruta: RUTAS.cobranza }, { etiqueta: cuenta.codigo }]}
        />
        <h1 className={styles.titulo}>{t('pago:titulo')}</h1>
        <p className={styles.subtitulo}>{subtitulo}</p>
      </header>

      {suscripcion.estado === 'suspendida' ? (
        <Aviso tono="advertencia">{t('pago:suspendida')}</Aviso>
      ) : null}

      <form
        className={styles.tarjeta}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTocados(TODOS_LOS_CAMPOS);
          if (valido) setConfirmando(true);
        }}
      >
        <CamposDePago
          datos={datos}
          errores={errores}
          tocados={tocados}
          onCambio={cambiar}
          onTocar={tocar}
          ayudaDelMonto={tipo === 'mejora_de_plan' ? undefined : t('pago:montoAyuda')}
        />

        <div className={styles.vigencia}>
          <span>
            {tipo === 'mejora_de_plan' ? t('pago:vigenciaSinCambio') : t('pago:nuevaVigencia')}
          </span>
          <TextoMono fuerte>
            {tipo === 'alta'
              ? `${formatearFecha(`${datos.fechaPago}T12:00:00Z`)} ${t('pago:hasta')} ${formatearFecha(venceNuevo)}`
              : tipo === 'renovacion'
                ? `${formatearFecha(suscripcion.hasta)} ${t('pago:hasta')} ${formatearFecha(venceNuevo)}`
                : formatearFecha(venceNuevo)}
          </TextoMono>
        </div>
      </form>

      {registrar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(registrar.error))}</Aviso>
      ) : null}

      <footer className={styles.acciones}>
        <AccesoBoton variante="texto" onClick={volver}>
          {t('pago:cancelar')}
        </AccesoBoton>
        <AccesoBoton
          disabled={!valido}
          onClick={() => {
            setTocados(TODOS_LOS_CAMPOS);
            if (valido) setConfirmando(true);
          }}
        >
          {t('pago:registrar')}
        </AccesoBoton>
      </footer>

      <Dialogo
        abierto={confirmando}
        icono="autorenew"
        titulo={
          tipo === 'alta'
            ? t('pago:confirmarAltaTitulo')
            : tipo === 'renovacion'
              ? t('pago:confirmarTitulo')
              : t('pago:confirmarMejoraTitulo')
        }
        onCerrar={() => {
          setConfirmando(false);
        }}
        acciones={
          <>
            <AccesoBoton
              variante="texto"
              onClick={() => {
                setConfirmando(false);
              }}
            >
              {t('pago:cancelar')}
            </AccesoBoton>
            <AccesoBoton cargando={registrar.isPending} onClick={confirmar}>
              {registrar.isPending ? t('pago:registrando') : t('pago:registrar')}
            </AccesoBoton>
          </>
        }
      >
        <p className={styles.suave}>
          {t(
            tipo === 'alta'
              ? 'pago:confirmarAltaTexto'
              : tipo === 'renovacion'
                ? 'pago:confirmarTexto'
                : 'pago:confirmarMejoraTexto',
            { cuenta: cuenta.nombre, fecha: formatearFecha(venceNuevo) },
          )}
        </p>
        <dl>
          <FilaClaveValor clave={t('pago:filaMonto')}>
            <TextoMono fuerte>{formatearMonto(parsearMonto(datos.monto) ?? 0)}</TextoMono>
          </FilaClaveValor>
          <FilaClaveValor clave={t('pago:filaMedio')}>
            {t(`pago:medios.${datos.medio}`)}
            {datos.referencia.trim() === '' ? null : (
              <>
                {' · '}
                <TextoMono fuerte>{datos.referencia.trim()}</TextoMono>
              </>
            )}
          </FilaClaveValor>
          <FilaClaveValor clave={t('pago:filaFecha')}>
            <TextoMono fuerte>{formatearFecha(`${datos.fechaPago}T12:00:00Z`)}</TextoMono>
          </FilaClaveValor>
        </dl>
      </Dialogo>
    </div>
  );
}
