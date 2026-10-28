import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { FiltroSegmentado } from '../../../../shared/ui/molecules/FiltroSegmentado';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useCrearCuentaDeCobro, useEditarCuentaDeCobro } from '../../application/useCobro';
import {
  BANCOS,
  FORMULARIO_VACIO,
  METODOS_DE_COBRO,
  TIPOS_DE_CUENTA,
  formularioDe,
  validarCuentaDeCobro,
  type CuentaDeCobro,
  type FormularioDeCuentaDeCobro,
  type MetodoDeCobro,
  type TipoDeCuenta,
} from '../../domain/cuentaDeCobro';
import { CampoImagenQr } from './CampoImagenQr';
import styles from './DialogoCuentaDeCobro.module.css';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Sin cuenta, el diálogo crea; con cuenta, edita. */
  cuenta: CuentaDeCobro | null;
}

/** Crear o editar una cuenta donde AGROCOM recibe pagos: una cuenta bancaria o un QR de cobro (ADR 0029). */
export function DialogoCuentaDeCobro({ abierto, onCerrar, cuenta }: Props) {
  const { t } = useTranslation(['cobro', 'comun']);
  const crear = useCrearCuentaDeCobro();
  const editar = useEditarCuentaDeCobro();
  const mutacion = cuenta === null ? crear : editar;
  const [formulario, setFormulario] = useState<FormularioDeCuentaDeCobro>(() =>
    cuenta === null ? FORMULARIO_VACIO : formularioDe(cuenta),
  );
  const [tocados, setTocados] = useState<ReadonlySet<keyof FormularioDeCuentaDeCobro>>(new Set());

  // Cada vez que se abre con otra cuenta (o para crear) el formulario parte de sus valores.
  const [origen, setOrigen] = useState<{ abierto: boolean; id: string | null }>({
    abierto,
    id: cuenta?.id ?? null,
  });
  if (origen.abierto !== abierto || origen.id !== (cuenta?.id ?? null)) {
    setOrigen({ abierto, id: cuenta?.id ?? null });
    if (abierto) {
      setFormulario(cuenta === null ? FORMULARIO_VACIO : formularioDe(cuenta));
      setTocados(new Set());
      mutacion.reset();
    }
  }

  const errores = validarCuentaDeCobro(formulario);
  const valido = Object.keys(errores).length === 0;
  const cambiar = (parcial: Partial<FormularioDeCuentaDeCobro>) => {
    setFormulario((actual) => ({ ...actual, ...parcial }));
  };
  const tocar = (campo: keyof FormularioDeCuentaDeCobro) => {
    setTocados((actual) => new Set(actual).add(campo));
  };
  const mensaje = (campo: keyof FormularioDeCuentaDeCobro) => {
    const error = errores[campo];
    return tocados.has(campo) && error ? t(`cobro:${error}`) : undefined;
  };

  const guardar = () => {
    if (!valido) return;
    if (cuenta === null) crear.mutate(formulario, { onSuccess: onCerrar });
    else editar.mutate({ id: cuenta.id, datos: formulario }, { onSuccess: onCerrar });
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo={cuenta === null ? t('cobro:dialogoNueva') : t('cobro:dialogoEditar')}
      onCerrar={onCerrar}
      ancho="ancho"
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={onCerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton cargando={mutacion.isPending} disabled={!valido} onClick={guardar}>
            {mutacion.isPending ? t('cobro:guardando') : t('cobro:guardar')}
          </AccesoBoton>
        </>
      }
    >
      <div className={styles.campos}>
        {cuenta === null ? (
          <FiltroSegmentado<MetodoDeCobro>
            etiqueta={t('cobro:metodo')}
            valor={formulario.metodo}
            onCambio={(metodo) => {
              cambiar({ metodo });
            }}
            opciones={METODOS_DE_COBRO.map((m) => ({
              valor: m,
              etiqueta: t(`cobro:metodos.${m}`),
            }))}
          />
        ) : null}

        <AccesoCampoTexto
          etiqueta={t('cobro:banco')}
          list="bancos-de-cobro"
          value={formulario.banco}
          error={mensaje('banco')}
          autoComplete="off"
          onBlur={() => {
            tocar('banco');
          }}
          onChange={(e) => {
            cambiar({ banco: e.target.value });
          }}
        />
        <datalist id="bancos-de-cobro">
          {BANCOS.map((banco) => (
            <option key={banco} value={banco} />
          ))}
        </datalist>

        {formulario.metodo === 'transferencia' ? (
          <>
            <AccesoCampoTexto
              etiqueta={t('cobro:titular')}
              ayuda={t('cobro:titularAyuda')}
              value={formulario.titular}
              error={mensaje('titular')}
              autoComplete="off"
              onBlur={() => {
                tocar('titular');
              }}
              onChange={(e) => {
                cambiar({ titular: e.target.value });
              }}
            />
            <div className={styles.fila}>
              <AccesoCampoTexto
                etiqueta={t('cobro:numeroCuenta')}
                mono
                value={formulario.numeroCuenta}
                error={mensaje('numeroCuenta')}
                autoComplete="off"
                onBlur={() => {
                  tocar('numeroCuenta');
                }}
                onChange={(e) => {
                  cambiar({ numeroCuenta: e.target.value });
                }}
              />
              <AccesoSelectorBuscable
                conBusqueda={false}
                etiqueta={t('cobro:tipoCuenta')}
                valor={formulario.tipoCuenta}
                opciones={[
                  { valor: '', etiqueta: t('cobro:tipoSinEspecificar') },
                  ...TIPOS_DE_CUENTA.map((tipo) => ({
                    valor: tipo,
                    etiqueta: t(`cobro:tipos.${tipo}`),
                  })),
                ]}
                onCambio={(tipoCuenta) => {
                  cambiar({ tipoCuenta: tipoCuenta as TipoDeCuenta | '' });
                }}
              />
            </div>
          </>
        ) : (
          <CampoImagenQr
            archivo={formulario.imagen}
            imagenActualId={formulario.imagenActualId}
            banco={formulario.banco}
            error={mensaje('imagen')}
            onCambio={(imagen) => {
              cambiar({ imagen });
              tocar('imagen');
            }}
          />
        )}

        <AccesoCampoTexto
          etiqueta={t('cobro:nota')}
          ayuda={t('cobro:notaAyuda')}
          maxLength={200}
          value={formulario.nota}
          autoComplete="off"
          onChange={(e) => {
            cambiar({ nota: e.target.value });
          }}
        />

        {mutacion.isError ? (
          <Aviso tono="peligro">{traducirError(t, codigoDe(mutacion.error))}</Aviso>
        ) : null}
      </div>
    </Dialogo>
  );
}
