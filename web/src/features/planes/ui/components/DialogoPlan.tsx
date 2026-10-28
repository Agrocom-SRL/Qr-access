import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { CampoMonto } from '../../../../shared/ui/molecules/CampoMonto';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { formatearNumero } from '../../../../l10n/formatos';
import { useCrearPlan, useEditarPlan } from '../../application/usePlanes';
import {
  parsearCupo,
  parsearPrecio,
  validarPlan,
  type FormularioDePlan,
  type Plan,
} from '../../domain/plan';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Sin plan, el diálogo crea; con plan, edita. */
  plan: Plan | null;
}

const VACIO: FormularioDePlan = { nombre: '', cupo: '', precio: '' };

function desde(plan: Plan | null): FormularioDePlan {
  return plan === null
    ? VACIO
    : {
        nombre: plan.nombre,
        cupo: String(plan.cupoUsuarios ?? ''),
        precio: formatearNumero(plan.precioAnual),
      };
}

/** Crear o editar un plan. El cupo de un plan que ya usan cuentas no se puede cambiar (ADR 0022). */
export function DialogoPlan({ abierto, onCerrar, plan }: Props) {
  const { t } = useTranslation(['planes', 'comun']);
  const crear = useCrearPlan();
  const editar = useEditarPlan();
  const mutacion = plan === null ? crear : editar;
  const [formulario, setFormulario] = useState<FormularioDePlan>(() => desde(plan));
  const [tocados, setTocados] = useState<ReadonlySet<keyof FormularioDePlan>>(new Set());

  // Cada vez que se abre con otro plan (o para crear) el formulario parte de sus valores.
  const [origen, setOrigen] = useState<{ abierto: boolean; id: string | null }>({
    abierto,
    id: plan?.id ?? null,
  });
  if (origen.abierto !== abierto || origen.id !== (plan?.id ?? null)) {
    setOrigen({ abierto, id: plan?.id ?? null });
    if (abierto) {
      setFormulario(desde(plan));
      setTocados(new Set());
      mutacion.reset();
    }
  }

  const errores = validarPlan(formulario);
  const valido = Object.keys(errores).length === 0;
  const cupoBloqueado = plan !== null && plan.cuentas > 0;
  const tocar = (campo: keyof FormularioDePlan) => {
    setTocados((actual) => new Set(actual).add(campo));
  };
  const mensaje = (campo: keyof FormularioDePlan) => {
    const error = errores[campo];
    return tocados.has(campo) && error ? t(`planes:${error}`) : undefined;
  };
  const cambiar = (parcial: Partial<FormularioDePlan>) => {
    setFormulario((actual) => ({ ...actual, ...parcial }));
  };

  const guardar = () => {
    const cupoUsuarios = parsearCupo(formulario.cupo);
    const precioAnual = parsearPrecio(formulario.precio);
    if (!valido || cupoUsuarios === null || precioAnual === null) return;
    const datos = { nombre: formulario.nombre.trim(), cupoUsuarios, precioAnual };
    if (plan === null) crear.mutate(datos, { onSuccess: onCerrar });
    else editar.mutate({ id: plan.id, cambios: datos }, { onSuccess: onCerrar });
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo={plan === null ? t('planes:dialogoNuevo') : t('planes:dialogoEditar')}
      onCerrar={onCerrar}
      ancho="ancho"
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={onCerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton cargando={mutacion.isPending} disabled={!valido} onClick={guardar}>
            {plan === null
              ? mutacion.isPending
                ? t('planes:creando')
                : t('planes:crear')
              : mutacion.isPending
                ? t('planes:guardandoCambios')
                : t('planes:guardarCambios')}
          </AccesoBoton>
        </>
      }
    >
      <AccesoCampoTexto
        etiqueta={t('planes:nombre')}
        placeholder={t('planes:nombreEjemplo')}
        value={formulario.nombre}
        error={mensaje('nombre')}
        autoComplete="off"
        onBlur={() => {
          tocar('nombre');
        }}
        onChange={(e) => {
          cambiar({ nombre: e.target.value });
        }}
      />
      <AccesoCampoTexto
        etiqueta={t('planes:cupo')}
        mono
        inputMode="numeric"
        value={formulario.cupo}
        disabled={cupoBloqueado}
        ayuda={cupoBloqueado ? t('planes:cupoBloqueado') : t('planes:cupoAyuda')}
        error={mensaje('cupo')}
        onBlur={() => {
          tocar('cupo');
        }}
        onChange={(e) => {
          cambiar({ cupo: e.target.value });
        }}
      />
      <CampoMonto
        etiqueta={t('planes:precioAnual')}
        moneda={t('planes:moneda')}
        value={formulario.precio}
        ayuda={t('planes:precioAyuda')}
        error={mensaje('precio')}
        onBlur={() => {
          tocar('precio');
        }}
        onChange={(e) => {
          cambiar({ precio: e.target.value });
        }}
      />
      {mutacion.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(mutacion.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
