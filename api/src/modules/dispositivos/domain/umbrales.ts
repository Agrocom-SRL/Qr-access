import type { UmbralesDePlaca } from './estado-de-placa.js';

/** Los umbrales como los guarda la configuración (minutos y horas) pasados a segundos, que es lo que compara el dominio. */
export function umbralesEnSegundos(configurados: {
  readonly caidaMinutos: number;
  readonly desaparecidaMinutos: number;
  readonly recuperacionMinutos: number;
  readonly lectorMinutos: number;
  readonly observacionHoras: number;
}): UmbralesDePlaca {
  return {
    caidaSegundos: configurados.caidaMinutos * 60,
    desaparecidaSegundos: configurados.desaparecidaMinutos * 60,
    recuperacionSegundos: configurados.recuperacionMinutos * 60,
    lectorSinRespuestaSegundos: configurados.lectorMinutos * 60,
    observacionSegundos: configurados.observacionHoras * 3600,
  };
}
