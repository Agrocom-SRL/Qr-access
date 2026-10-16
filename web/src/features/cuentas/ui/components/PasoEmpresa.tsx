import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { AccesoSelectorBuscable } from '../../../../shared/ui/molecules/AccesoSelectorBuscable';
import { CampoFormulario } from '../../../../shared/ui/molecules/CampoFormulario';
import { FormularioSecciones } from '../../../../shared/ui/organisms/FormularioSecciones';
import { useCodigoDisponible } from '../../application/useCuentas';
import {
  CIUDADES,
  normalizarCodigo,
  validarEmpresa,
  type DatosDeEmpresa,
  type ErrorDeCampo,
} from '../../domain/alta';
import styles from './PasoEmpresa.module.css';

interface Props {
  datos: DatosDeEmpresa;
  onCambio: (datos: DatosDeEmpresa) => void;
}

/** A04a: datos de la empresa y código de cuenta validado contra la API (A04a, "código ya existe"). */
export function PasoEmpresa({ datos, onCambio }: Props) {
  const [tocados, setTocados] = useState<ReadonlySet<keyof DatosDeEmpresa>>(new Set());
  const tocar = (campo: keyof DatosDeEmpresa) => {
    setTocados((actual) => new Set(actual).add(campo));
  };
  const { t } = useTranslation(['crearCuenta', 'cuentas']);
  const { resultado, verificando } = useCodigoDisponible(datos.codigo, datos.razonSocial);
  const errores = validarEmpresa(datos);
  const cambiar = (parcial: Partial<DatosDeEmpresa>) => {
    onCambio({ ...datos, ...parcial });
  };
  const mensaje = (campo: keyof DatosDeEmpresa): string | undefined => {
    const error: ErrorDeCampo | undefined = errores[campo];
    return tocados.has(campo) && error ? t(`crearCuenta:${error}`) : undefined;
  };

  const ocupado = resultado?.disponible === false && resultado.formatoValido;
  const libre = resultado?.disponible === true;

  return (
    <FormularioSecciones
      secciones={[
        {
          id: 'empresa',
          titulo: t('crearCuenta:datosEmpresa'),
          contenido: (
            <div className={styles.campos}>
              <AccesoCampoTexto
                etiqueta={t('crearCuenta:razonSocial')}
                value={datos.razonSocial}
                error={mensaje('razonSocial')}
                autoComplete="organization"
                onBlur={() => {
                  tocar('razonSocial');
                }}
                onChange={(e) => {
                  cambiar({ razonSocial: e.target.value });
                }}
              />
              <div className={styles.fila}>
                <AccesoCampoTexto
                  etiqueta={t('crearCuenta:nit')}
                  value={datos.nit}
                  inputMode="numeric"
                  error={mensaje('nit')}
                  onBlur={() => {
                    tocar('nit');
                  }}
                  onChange={(e) => {
                    cambiar({ nit: e.target.value });
                  }}
                />
                <AccesoSelectorBuscable
                  etiqueta={t('crearCuenta:ciudad')}
                  valor={datos.ciudad}
                  error={mensaje('ciudad')}
                  placeholder={t('crearCuenta:ciudadElegir')}
                  onBlur={() => {
                    tocar('ciudad');
                  }}
                  opciones={CIUDADES.map((ciudad) => ({ valor: ciudad, etiqueta: ciudad }))}
                  onCambio={(ciudad) => {
                    cambiar({ ciudad });
                  }}
                />
              </div>
              <div>
                <CampoFormulario
                  etiqueta={t('crearCuenta:codigo')}
                  ayuda={t('crearCuenta:codigoAyuda')}
                  error={mensaje('codigo')}
                  invalido={ocupado}
                >
                  {(control) => (
                    <div className={styles.codigo}>
                      <input
                        className={styles.entradaCodigo}
                        value={datos.codigo}
                        maxLength={3}
                        autoComplete="off"
                        autoCapitalize="characters"
                        onChange={(e) => {
                          cambiar({ codigo: normalizarCodigo(e.target.value) });
                        }}
                        {...control}
                      />
                      {ocupado ? (
                        <p className={styles.error} role="alert">
                          <Icono nombre="error" tamano={20} />
                          {t('crearCuenta:codigoExiste', { cuenta: resultado.usadoPor ?? '' })}
                        </p>
                      ) : libre ? (
                        <p className={styles.libre} role="status">
                          <Icono nombre="check_circle" tamano={20} />
                          {t('crearCuenta:codigoDisponible')}
                        </p>
                      ) : verificando ? (
                        <p className={styles.verificando}>{t('crearCuenta:verificando')}</p>
                      ) : null}
                    </div>
                  )}
                </CampoFormulario>
                {ocupado && resultado.sugerencias.length > 0 ? (
                  <div className={styles.sugerencias}>
                    <span>{t('crearCuenta:disponibles')}</span>
                    {resultado.sugerencias.map((sugerido) => (
                      <button
                        key={sugerido}
                        type="button"
                        className={styles.chip}
                        onClick={() => {
                          cambiar({ codigo: sugerido });
                        }}
                      >
                        {sugerido}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ),
        },
        {
          id: 'responsable',
          titulo: t('crearCuenta:responsableTitulo'),
          descripcion: t('crearCuenta:responsableAyuda'),
          contenido: (
            <div className={styles.campos}>
              <div className={styles.fila}>
                <AccesoCampoTexto
                  etiqueta={t('crearCuenta:responsableNombre')}
                  value={datos.contactoNombre}
                  error={mensaje('contactoNombre')}
                  autoComplete="name"
                  onBlur={() => {
                    tocar('contactoNombre');
                  }}
                  onChange={(e) => {
                    cambiar({ contactoNombre: e.target.value });
                  }}
                />
                <AccesoCampoTexto
                  etiqueta={t('crearCuenta:telefono')}
                  value={datos.contactoTelefono}
                  mono
                  type="tel"
                  error={mensaje('contactoTelefono')}
                  autoComplete="tel"
                  onBlur={() => {
                    tocar('contactoTelefono');
                  }}
                  onChange={(e) => {
                    cambiar({ contactoTelefono: e.target.value });
                  }}
                />
              </div>
              <AccesoCampoTexto
                etiqueta={t('crearCuenta:correo')}
                value={datos.contactoCorreo}
                type="email"
                error={mensaje('contactoCorreo')}
                autoComplete="email"
                ayuda={t('crearCuenta:correoAyuda')}
                onBlur={() => {
                  tocar('contactoCorreo');
                }}
                onChange={(e) => {
                  cambiar({ contactoCorreo: e.target.value });
                }}
              />
            </div>
          ),
        },
      ]}
    />
  );
}
