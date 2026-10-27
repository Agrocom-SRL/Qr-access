import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PestanaConsumo } from '../features/limites';
import { PestanaFlujo, PestanaSenales } from '../features/senales';
import { tienePermiso, useSesion } from '../features/seguridad';
import { EncabezadoPagina } from '../shared/ui/molecules/EncabezadoPagina';
import { EstadoVacio } from '../shared/ui/organisms/EstadoVacio';
import { Pestanas, type Pestana } from '../shared/ui/organisms/Pestanas';

type Seccion = 'consumo' | 'senales' | 'flujo';

/**
 * La vista de AGROCOM sobre el uso y el abuso (ADR 0030 §5): el consumo de la bolsa, las señales y
 * el flujo. Cada pestaña aparece solo con su permiso (`limites.consumo.ver` o `seguridad.senal.ver`),
 * y solo entonces pide sus datos. La pestaña va en la URL (`?pestana=`) para compartir el enlace.
 */
export function ConsumoYSenalesPage() {
  const { t } = useTranslation(['senales', 'comun']);
  const { sesion } = useSesion();
  const [parametros, setParametros] = useSearchParams();
  const permisos = sesion?.permisos ?? [];

  const pestanas: Pestana<Seccion>[] = [
    ...(tienePermiso(permisos, 'limites.consumo.ver')
      ? [{ id: 'consumo' as const, etiqueta: t('senales:pestana.consumo') }]
      : []),
    ...(tienePermiso(permisos, 'seguridad.senal.ver')
      ? [
          { id: 'senales' as const, etiqueta: t('senales:pestana.senales') },
          { id: 'flujo' as const, etiqueta: t('senales:pestana.flujo') },
        ]
      : []),
  ];
  const pedida = pestanas.find((pestana) => pestana.id === parametros.get('pestana'));
  const activa = pedida?.id ?? pestanas[0]?.id;

  return (
    <>
      <EncabezadoPagina titulo={t('senales:titulo')} subtitulo={t('senales:subtitulo')} />
      {pestanas.length === 0 || activa === undefined ? (
        <EstadoVacio
          ilustracion="bloqueo"
          titulo={t('comun:sinPermiso.titulo')}
          texto={t('comun:sinPermiso.texto')}
        />
      ) : (
        <>
          <Pestanas
            etiqueta={t('senales:pestanas')}
            pestanas={pestanas}
            activa={activa}
            onCambio={(id) => {
              setParametros({ pestana: id }, { replace: true });
            }}
          />
          {activa === 'consumo' ? <PestanaConsumo /> : null}
          {activa === 'senales' ? <PestanaSenales /> : null}
          {activa === 'flujo' ? <PestanaFlujo /> : null}
        </>
      )}
    </>
  );
}
