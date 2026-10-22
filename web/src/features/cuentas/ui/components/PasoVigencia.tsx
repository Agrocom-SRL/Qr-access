import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFecha } from '../../../../l10n/formatos';
import { AccesoCampoFecha } from '../../../../shared/ui/molecules/AccesoCampoFecha';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { FormularioSecciones } from '../../../../shared/ui/organisms/FormularioSecciones';
import {
  validarVigencia,
  venceUnAnioDespues,
  type DatosDeVigencia,
  type ErrorDeCampo,
} from '../../domain/alta';
import styles from './PasoEmpresa.module.css';

interface Props {
  datos: DatosDeVigencia;
  onCambio: (datos: DatosDeVigencia) => void;
}

/**
 * A04c: inicio de la suscripción (vence 12 meses después, calculado) y el administrador inicial (su nombre
 * parte con el de la persona responsable y se puede editar).
 * TODO(docs): el diseño pide correo y teléfono opcionales del administrador; `usuarios` no tiene
 * dónde guardarlos, así que no se piden hasta que el modelo de datos los defina.
 */
export function PasoVigencia({ datos, onCambio }: Props) {
  const [tocados, setTocados] = useState<ReadonlySet<keyof DatosDeVigencia>>(new Set());
  const tocar = (campo: keyof DatosDeVigencia) => {
    setTocados((actual) => new Set(actual).add(campo));
  };
  const { t } = useTranslation('crearCuenta');
  const errores = validarVigencia(datos);
  const mensaje = (campo: keyof DatosDeVigencia): string | undefined => {
    const error: ErrorDeCampo | undefined = errores[campo];
    return tocados.has(campo) && error ? t(error) : undefined;
  };
  const vence = errores.inicio === undefined ? venceUnAnioDespues(datos.inicio) : '';

  return (
    <FormularioSecciones
      secciones={[
        {
          id: 'vigencia',
          titulo: t('vigenciaTitulo'),
          contenido: (
            <div className={styles.fila}>
              <AccesoCampoFecha
                etiqueta={t('inicio')}
                valor={datos.inicio}
                error={mensaje('inicio')}
                onBlur={() => {
                  tocar('inicio');
                }}
                onCambio={(inicio) => {
                  onCambio({ ...datos, inicio });
                }}
              />
              <AccesoCampoTexto
                etiqueta={t('vence')}
                mono
                disabled
                value={vence === '' ? '' : formatearFecha(`${vence}T12:00:00Z`)}
                ayuda={t('venceAyuda')}
                readOnly
              />
            </div>
          ),
        },
        {
          id: 'administrador',
          titulo: t('adminInicial'),
          descripcion: t('adminInicialAyuda'),
          contenido: (
            <div className={styles.campos}>
              <AccesoCampoTexto
                etiqueta={t('nombreAdministrador')}
                value={datos.administradorNombre}
                error={mensaje('administradorNombre')}
                onBlur={() => {
                  tocar('administradorNombre');
                }}
                autoComplete="off"
                onChange={(e) => {
                  onCambio({ ...datos, administradorNombre: e.target.value });
                }}
              />
            </div>
          ),
        },
      ]}
    />
  );
}
