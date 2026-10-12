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
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { CampoMonto } from '../../../../shared/ui/molecules/CampoMonto';
import { FilaClaveValor } from '../../../../shared/ui/molecules/FilaClaveValor';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { Migas } from '../../../../shared/ui/molecules/Migas';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { useSuscripcionDeCuenta } from '../../../suscripciones';
import { useRegistrarPago } from '../../application/usePagos';
import {
  MEDIOS,
  parsearMonto,
  validarPago,
  type FormularioDePago,
  type MedioDePago,
  type TipoDePago,
} from '../../domain/pago';
import styles from './RegistrarPagoPage.module.css';

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
 * `?tipo=mejora` cobra la diferencia de un cambio de plan y no cambia la vigencia (ADR 0022).
 */
export function RegistrarPagoPage() {
  const { t } = useTranslation(['pago', 'comun', 'suscripcion']);
  const { cuentaId = '' } = useParams();
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const consulta = useSuscripcionDeCuenta(cuentaId);
  const registrar = useRegistrarPago(cuentaId);

  const tipo: TipoDePago = parametros.get('tipo') === 'mejora' ? 'mejora_de_plan' : 'renovacion';
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
  const sugerido =
    tipo === 'mejora_de_plan' && montoSugerido > 0 ? montoSugerido : suscripcion.plan.precioAnual;
  const datos: FormularioDePago = formulario ?? {
    monto: montoEscrito(sugerido),
    fechaPago: hoy(),
    medio: 'transferencia',
    referencia: '',
  };
  const errores = validarPago(datos);
  const valido = Object.keys(errores).length === 0 && suscripcion.estado !== 'suspendida';
  const cambiar = (parcial: Partial<FormularioDePago>) => {
    setFormulario({ ...datos, ...parcial });
  };
  const tocar = (campo: keyof FormularioDePago) => {
    setTocados((actual) => new Set(actual).add(campo));
  };
  const mensaje = (campo: keyof FormularioDePago): string | undefined => {
    const error = errores[campo];
    if (!tocados.has(campo) || !error) return undefined;
    return campo === 'monto' && error === 'formato' ? t('pago:montoInvalido') : t(`pago:${error}`);
  };

  const venceNuevo = tipo === 'renovacion' ? masUnAnio(suscripcion.hasta) : suscripcion.hasta;
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

  const subtitulo =
    tipo === 'mejora_de_plan'
      ? t('pago:subtituloMejora', { cuenta: cuenta.nombre, plan: suscripcion.plan.nombre })
      : t('pago:subtituloRenovacion', { cuenta: cuenta.nombre, plan: suscripcion.plan.nombre });

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
          setTocados(new Set(['monto', 'fechaPago', 'referencia']));
          if (valido) setConfirmando(true);
        }}
      >
        <div className={styles.fila}>
          <CampoMonto
            etiqueta={t('pago:monto')}
            moneda={t('pago:moneda')}
            value={datos.monto}
            ayuda={tipo === 'mejora_de_plan' ? undefined : t('pago:montoAyuda')}
            error={mensaje('monto')}
            onBlur={() => {
              tocar('monto');
            }}
            onChange={(e) => {
              cambiar({ monto: e.target.value });
            }}
          />
          <AccesoCampoTexto
            etiqueta={t('pago:fecha')}
            type="date"
            mono
            value={datos.fechaPago}
            error={mensaje('fechaPago')}
            onBlur={() => {
              tocar('fechaPago');
            }}
            onChange={(e) => {
              cambiar({ fechaPago: e.target.value });
            }}
          />
        </div>

        <div className={styles.medio}>
          <span className={styles.etiqueta}>{t('pago:medio')}</span>
          <FiltroSegmentado<MedioDePago>
            etiqueta={t('pago:medio')}
            valor={datos.medio}
            onCambio={(medio) => {
              cambiar({ medio });
            }}
            opciones={MEDIOS.map((m) => ({ valor: m, etiqueta: t(`pago:medios.${m}`) }))}
          />
        </div>

        <AccesoCampoTexto
          etiqueta={t('pago:referencia')}
          mono
          value={datos.referencia}
          ayuda={t('pago:referenciaAyuda')}
          error={mensaje('referencia')}
          autoComplete="off"
          onBlur={() => {
            tocar('referencia');
          }}
          onChange={(e) => {
            cambiar({ referencia: e.target.value });
          }}
        />
        {/* TODO(docs): el comprobante adjunto queda fuera hasta definir dónde se guarda (ADR 0015). */}
        <p className={styles.nota}>{t('pago:comprobanteNota')}</p>

        <div className={styles.vigencia}>
          <span>
            {tipo === 'renovacion' ? t('pago:nuevaVigencia') : t('pago:vigenciaSinCambio')}
          </span>
          <TextoMono fuerte>
            {tipo === 'renovacion'
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
            setTocados(new Set(['monto', 'fechaPago', 'referencia']));
            if (valido) setConfirmando(true);
          }}
        >
          {t('pago:registrar')}
        </AccesoBoton>
      </footer>

      <Dialogo
        abierto={confirmando}
        icono="autorenew"
        titulo={tipo === 'renovacion' ? t('pago:confirmarTitulo') : t('pago:confirmarMejoraTitulo')}
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
          {tipo === 'renovacion'
            ? t('pago:confirmarTexto', { cuenta: cuenta.nombre, fecha: formatearFecha(venceNuevo) })
            : t('pago:confirmarMejoraTexto', {
                cuenta: cuenta.nombre,
                fecha: formatearFecha(venceNuevo),
              })}
        </p>
        <dl>
          <FilaClaveValor clave={t('pago:filaMonto')}>
            <TextoMono fuerte>{formatearMonto(parsearMonto(datos.monto) ?? 0)}</TextoMono>
          </FilaClaveValor>
          <FilaClaveValor clave={t('pago:filaMedio')}>
            {t(`pago:medios.${datos.medio}`)} ·{' '}
            <TextoMono fuerte>{datos.referencia.trim()}</TextoMono>
          </FilaClaveValor>
          <FilaClaveValor clave={t('pago:filaFecha')}>
            <TextoMono fuerte>{formatearFecha(`${datos.fechaPago}T12:00:00Z`)}</TextoMono>
          </FilaClaveValor>
        </dl>
      </Dialogo>
    </div>
  );
}
