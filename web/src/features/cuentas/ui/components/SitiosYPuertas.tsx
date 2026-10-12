import { useTranslation } from 'react-i18next';
import { formatearTranscurrido } from '../../../../l10n/formatos';
import { codigoDe } from '../../../../shared/api/errorApi';
import { AccesoBadge } from '../../../../shared/ui/atoms/AccesoBadge';
import { Icono } from '../../../../shared/ui/atoms/Icono';
import { Skeleton } from '../../../../shared/ui/atoms/Skeleton';
import { TextoMono } from '../../../../shared/ui/atoms/TextoMono';
import { EstadoError } from '../../../../shared/ui/organisms/EstadoError';
import { EstadoVacio } from '../../../../shared/ui/organisms/EstadoVacio';
import { TablaDatos, type Columna } from '../../../../shared/ui/organisms/TablaDatos';
import { useSitiosYPuertas } from '../../application/useCuentas';
import type { SitioConPuertas } from '../../domain/cuenta';
import styles from './SitiosYPuertas.module.css';

type FilaDePuerta = SitioConPuertas['puertas'][number];

/** Pestaña "Sitios y puertas" (A05c): solo lectura, con el estado del lector de cada puerta. */
export function SitiosYPuertas({ cuentaId }: { cuentaId: string }) {
  const { t } = useTranslation('detalle');
  const sitios = useSitiosYPuertas(cuentaId, true);
  const ahora = new Date();

  const columnas: Columna<FilaDePuerta>[] = [
    { id: 'puerta', encabezado: t('puertaColumna'), celda: (p) => <strong>{p.nombre}</strong> },
    {
      id: 'dispositivo',
      encabezado: t('dispositivoColumna'),
      celda: (p) => (
        <span className={styles.suave}>
          <TextoMono>{p.dispositivo?.nombre ?? t('sinLector')}</TextoMono>
        </span>
      ),
    },
    {
      id: 'senal',
      encabezado: t('senalColumna'),
      celda: (p) => (
        <span className={styles.suave}>
          <TextoMono>
            {p.dispositivo?.ultimaSenal
              ? formatearTranscurrido(p.dispositivo.ultimaSenal, ahora)
              : t('sinSenal')}
          </TextoMono>
        </span>
      ),
    },
    {
      id: 'estado',
      encabezado: t('estadoColumna'),
      alinear: 'fin',
      celda: (p) =>
        p.dispositivo === null ? null : p.dispositivo.enLinea ? (
          <AccesoBadge tono="primario" icono="wifi">
            {t('enLinea')}
          </AccesoBadge>
        ) : (
          <AccesoBadge tono="peligro" icono="wifi_off">
            {t('sinConexion')}
          </AccesoBadge>
        ),
    },
  ];

  return (
    <div className={styles.contenedor}>
      <p className={styles.nota}>
        <Icono nombre="info" tamano={20} />
        {t('sitiosSoloLectura')}
      </p>
      {sitios.isError ? (
        <EstadoError
          titulo={t('errorCarga')}
          code={codigoDe(sitios.error)}
          onReintentar={() => void sitios.refetch()}
        />
      ) : sitios.isPending ? (
        <div aria-busy="true">
          <Skeleton alto="bloque" />
        </div>
      ) : sitios.data.length === 0 ? (
        <EstadoVacio titulo={t('sitiosVacio.titulo')} texto={t('sitiosVacio.texto')} />
      ) : (
        sitios.data.map((sitio) => (
          <section key={sitio.id} className={styles.sitio} aria-labelledby={`sitio-${sitio.id}`}>
            <h2 id={`sitio-${sitio.id}`} className={styles.nombre}>
              <Icono nombre="location_on" />
              {sitio.nombre}
            </h2>
            <TablaDatos
              incrustada
              etiqueta={sitio.nombre}
              columnas={columnas}
              filas={sitio.puertas}
              claveDe={(p) => p.id}
            />
          </section>
        ))
      )}
    </div>
  );
}
