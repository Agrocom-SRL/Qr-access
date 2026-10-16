import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { traducirError } from '../../../../l10n/traducirError';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBoton } from '../../../../shared/ui/atoms/AccesoBoton';
import { BotonIcono } from '../../../../shared/ui/atoms/BotonIcono';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { AccesoCampoTexto } from '../../../../shared/ui/molecules/AccesoCampoTexto';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { CampoFormulario } from '../../../../shared/ui/molecules/CampoFormulario';
import { Dialogo } from '../../../../shared/ui/organisms/Dialogo';
import { useAgregarMiembro, useUsuarioDisponible } from '../../application/useEquipo';
import {
  generarContrasenaTemporal,
  sugerirUsuario,
  usuarioConFormatoValido,
} from '../../domain/equipo';
import styles from './DialogoAgregarMiembro.module.css';

function aleatorioSeguro(limite: number): number {
  const valores = new Uint32Array(1);
  // Rechazo por módulo: evita el sesgo de `% limite` sobre un rango que no es múltiplo.
  const maximo = Math.floor(0x1_0000_0000 / limite) * limite;
  do crypto.getRandomValues(valores);
  while ((valores[0] ?? 0) >= maximo);
  return (valores[0] ?? 0) % limite;
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

/** A11b: nombre, usuario con disponibilidad en vivo y contraseña temporal generada (que se puede copiar). */
export function DialogoAgregarMiembro({ abierto, onCerrar }: Props) {
  const { t } = useTranslation(['equipo', 'comun']);
  const agregar = useAgregarMiembro();
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const [contrasena, setContrasena] = useState(() => generarContrasenaTemporal(aleatorioSeguro));
  const [copiada, setCopiada] = useState(false);
  const { disponible, verificando } = useUsuarioDisponible(usuario);

  const cerrar = () => {
    setNombre('');
    setUsuario('');
    setUsuarioEditado(false);
    setContrasena(generarContrasenaTemporal(aleatorioSeguro));
    setCopiada(false);
    agregar.reset();
    onCerrar();
  };

  const puedeAgregar =
    nombre.trim() !== '' &&
    usuarioConFormatoValido(usuario) &&
    disponible === true &&
    !agregar.isPending;

  const copiar = async () => {
    await navigator.clipboard.writeText(contrasena);
    setCopiada(true);
  };

  const enviar = () => {
    agregar.mutate(
      {
        nombre: nombre.trim(),
        usuario: usuario.trim().toLowerCase(),
        contrasenaTemporal: contrasena,
      },
      { onSuccess: cerrar },
    );
  };

  const mensajeUsuario =
    disponible === false
      ? t('equipo:noDisponible')
      : usuario !== '' && !usuarioConFormatoValido(usuario)
        ? traducirError(t, 'usuario.formato_invalido')
        : undefined;

  return (
    <Dialogo
      abierto={abierto}
      titulo={t('equipo:agregarTitulo')}
      onCerrar={cerrar}
      ancho="angosto"
      acciones={
        <>
          <AccesoBoton variante="texto" onClick={cerrar}>
            {t('comun:cancelar')}
          </AccesoBoton>
          <AccesoBoton cargando={agregar.isPending} disabled={!puedeAgregar} onClick={enviar}>
            {agregar.isPending ? t('equipo:agregando') : t('equipo:agregarConfirmar')}
          </AccesoBoton>
        </>
      }
    >
      <AccesoCampoTexto
        etiqueta={t('equipo:nombreCompleto')}
        value={nombre}
        autoComplete="off"
        onChange={(e) => {
          setNombre(e.target.value);
          if (!usuarioEditado) setUsuario(sugerirUsuario(e.target.value));
        }}
      />
      <div>
        <AccesoCampoTexto
          etiqueta={t('equipo:usuario')}
          mono
          value={usuario}
          autoComplete="off"
          autoCapitalize="none"
          error={mensajeUsuario}
          onChange={(e) => {
            setUsuarioEditado(true);
            setUsuario(e.target.value);
          }}
        />
        {disponible === true ? (
          <p className={styles.disponible} role="status">
            <Icono nombre="check_circle" tamano={16} />
            {t('equipo:disponible')}
          </p>
        ) : verificando ? (
          <p className={styles.verificando}>{t('equipo:verificando')}</p>
        ) : null}
      </div>
      <CampoFormulario
        etiqueta={t('equipo:contrasenaTemporal')}
        ayuda={t('equipo:contrasenaTemporalAyuda')}
      >
        {(control) => (
          <div className={styles.contrasena}>
            <input className={styles.entrada} readOnly value={contrasena} {...control} />
            <BotonIcono
              icono="refresh"
              etiqueta={t('equipo:regenerar')}
              onClick={() => {
                setContrasena(generarContrasenaTemporal(aleatorioSeguro));
                setCopiada(false);
              }}
            />
            <BotonIcono
              icono="content_copy"
              etiqueta={copiada ? t('comun:copiado') : t('comun:copiar')}
              onClick={() => void copiar()}
            />
          </div>
        )}
      </CampoFormulario>
      {agregar.isError ? (
        <Aviso tono="peligro">{traducirError(t, codigoDe(agregar.error))}</Aviso>
      ) : null}
    </Dialogo>
  );
}
