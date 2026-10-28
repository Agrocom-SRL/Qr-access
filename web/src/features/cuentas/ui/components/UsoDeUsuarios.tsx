import { useTranslation } from 'react-i18next';
import { formatearFecha } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { Aviso } from '../../../../shared/ui/molecules/Aviso';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { useEstadisticasDeUsuarios } from '../../application/useCuentas';
import {
  inactivosDe,
  ruidososDe,
  titularesCercaDelTope,
  type UsoDeUsuario,
} from '../../domain/cuenta';
import styles from './UsoDeUsuarios.module.css';

/**
 * El uso de los usuarios de la cuenta (ADR 0028 §4): quiénes no generaron ningún QR (candidatos a
 * baja), quiénes generan QR a cada rato, qué Titulares ya usan casi todo su tope de Miembros y
 * cuántos usuarios cuelgan de cada Administrador. Es informativo: los umbrales son fijos y el panel
 * no calcula nada; la baja la decide cada Administrador desde la app.
 */
export function UsoDeUsuarios({ cuentaId }: { cuentaId: string }) {
  const { t } = useTranslation('detalle');
  const consulta = useEstadisticasDeUsuarios(cuentaId);

  return (
    <section className={styles.tarjeta} aria-labelledby="uso-titulo">
      <h2 id="uso-titulo" className={styles.titulo}>
        {t('usoTitulo')}
      </h2>
      {consulta.isError ? (
        <EstadoError
          titulo={t('errorUso')}
          code={codigoDe(consulta.error)}
          onReintentar={() => void consulta.refetch()}
        />
      ) : consulta.isPending ? (
        <Skeleton alto="bloque" />
      ) : (
        <Contenido datos={consulta.data} />
      )}
    </section>
  );
}

function Contenido({
  datos,
}: {
  datos: NonNullable<ReturnType<typeof useEstadisticasDeUsuarios>['data']>;
}) {
  const { t } = useTranslation('detalle');
  const inactivos = inactivosDe(datos);
  const ruidosos = ruidososDe(datos);
  const cerca = titularesCercaDelTope(datos);

  return (
    <>
      <Aviso tono="informacion">
        {t('usoAviso', { dias: datos.umbralInactivoDias, qr: datos.umbralRuidosoPorDia })}
      </Aviso>

      {/* Son listas cortas de cantidades: en dos columnas se leen de un vistazo y el bloque ocupa menos alto. */}
      <div className={styles.columnas}>
        <Grupo
          titulo={t('usoInactivos', { count: inactivos.length })}
          vacio={t('usoSinInactivos')}
          filas={inactivos.map((u) => ({
            id: u.id,
            nombre: u.etiqueta,
            detalle: detalleDeInactivo(u, datos.ventanaDias, t),
          }))}
        />
        <Grupo
          titulo={t('usoRuidosos', { count: ruidosos.length })}
          vacio={t('usoSinRuidosos')}
          filas={ruidosos.map((u) => ({
            id: u.id,
            nombre: u.etiqueta,
            detalle: t('usoDetalleRuidoso', { maximo: u.maxQrEnUnDia, total: u.qrGenerados }),
          }))}
        />
        <Grupo
          titulo={t('usoTitulares', { count: cerca.length })}
          vacio={t('usoSinTitulares')}
          filas={cerca.map((titular) => ({
            id: titular.id,
            nombre: titular.etiqueta,
            detalle: t('usoDetalleTitular', {
              unidad: titular.unidad ?? t('sinUnidad'),
              miembros: titular.miembros,
              tope: titular.tope,
            }),
          }))}
        />
        <Grupo
          titulo={t('usoRamas')}
          vacio={t('administradoresVacio')}
          filas={datos.ramas.map((rama) => ({
            id: rama.id,
            nombre: rama.etiqueta,
            detalle: t('usoDetalleRama', { count: rama.usuarios }),
          }))}
        />
      </div>
    </>
  );
}

function detalleDeInactivo(
  u: UsoDeUsuario,
  ventanaDias: number,
  t: (clave: string, opciones?: Record<string, unknown>) => string,
): string {
  return u.ultimoQrEn === null
    ? t('usoDetalleNuncaGeneroQr', { dias: ventanaDias })
    : t('usoDetalleInactivo', { dias: ventanaDias, fecha: formatearFecha(u.ultimoQrEn) });
}

interface FilaDeUso {
  id: string;
  nombre: string;
  detalle: string;
}

function Grupo({ titulo, vacio, filas }: { titulo: string; vacio: string; filas: FilaDeUso[] }) {
  return (
    <div className={styles.grupo}>
      <h3 className={styles.subtitulo}>{titulo}</h3>
      {filas.length === 0 ? (
        <p className={styles.suave}>{vacio}</p>
      ) : (
        <ul className={styles.lista}>
          {filas.map((fila) => (
            <li key={fila.id} className={styles.fila}>
              <strong>{fila.nombre}</strong>
              <span className={styles.suave}>{fila.detalle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
