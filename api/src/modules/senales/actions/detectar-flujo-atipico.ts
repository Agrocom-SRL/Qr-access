import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { inicioDelDia } from '../../../platform/tiempo/fechas.js';
import {
  crearServicioDeActividadParaSenales,
  diaLocal,
  inicioDelDiaLocal,
  ZONA_DE_LOS_TOPES,
} from '../../accesos/contracts.js';
import { crearServicioDeUmbralesDeSenal } from '../../limites/contracts.js';
import type { AvisoAgrupado, DatosDeAviso } from '../../notificaciones/contracts.js';
import {
  crearServicioDeConteoDeUsuarios,
  crearServicioDeCuentas,
} from '../../seguridad/contracts.js';
import { llevarABandeja } from '../bandeja.js';
import {
  aperturasPorUsuario,
  baseHabitual,
  claveDeFlujoAtipico,
  DESFASE_UTC,
  DIAS_DE_BASE,
  esFlujoAtipico,
  restarDias,
} from '../domain/reglas.js';
import {
  MAXIMO_DE_SENALES_POR_PASADA,
  pasadaAgotada,
  TAMANO_DE_PAGINA,
  pasadaVacia,
  recorrer,
  tratar,
  type ResultadoDePasada,
} from '../pasada.js';
import { RepositorioDeAvisosDeSenal } from '../repository.js';

/**
 * Flujo atípico de la cuenta (ADR 0030 §4 y §5, ola W12): las aperturas por QR de un día local divididas entre los
 * usuarios activos de la cuenta, muy por encima de lo habitual (`senal.flujo_aperturas_minimo` y
 * `senal.flujo_aperturas_por_usuario`, con excepción por cuenta). Es lo que delata un plan chico usado como portería de
 * muchos (el caso del condominio): no se corta, se avisa para negociar con el propietario.
 *
 * Revisa el día de hoy (hasta ahora) y el de ayer, para no perder el que cruzó el umbral justo antes de medianoche. Una
 * lectura de todas las cuentas busca las que llegan al mínimo de aperturas más bajo posible; cada una se juzga luego,
 * en su cuenta, con sus umbrales efectivos y sus usuarios activos de hoy (no hay historia de cuántos usuarios hubo cada
 * día). El aviso (propietario de la cuenta y AGROCOM) se deja una vez por cuenta y día; los días siguientes que sigue
 * atípico actualizan el MISMO aviso abierto, porque la persistencia es lo que importa y un pico de un día es normal.
 *
 * Cuenta TODAS las aperturas, repeticiones incluidas (ADR 0032 §4.3). Si falta historia, la `base` va vacía; el
 * umbral absoluto manda. Solo observa: no abre incidente (no es de un usuario) ni limita nada.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
  maximoDeSenales: number = MAXIMO_DE_SENALES_POR_PASADA,
): Promise<ResultadoDePasada> {
  const actividad = crearServicioDeActividadParaSenales(pool);
  const umbrales = crearServicioDeUmbralesDeSenal(pool);
  const { flujoAperturasMinimo: piso } = await umbrales.minimosEnLaPlataforma();
  const resultado = pasadaVacia();

  const hoy = diaLocal(ahora, ZONA_DE_LOS_TOPES);
  const inicioDeHoy = inicioDelDiaLocal(ahora, ZONA_DE_LOS_TOPES);
  const ayer = restarDias(hoy, 1);
  const inicioDeAyer = inicioDelDiaLocal(new Date(inicioDeHoy.getTime() - 1), ZONA_DE_LOS_TOPES);
  const rangos = [
    { dia: ayer, desde: inicioDeAyer, hasta: new Date(inicioDeHoy.getTime() - 1) },
    { dia: hoy, desde: inicioDeHoy, hasta: ahora },
  ];

  for (const rango of rangos) {
    const hallazgos = recorrer(
      (cursor: string | null) =>
        actividad.cuentasConAperturas(rango.desde, rango.hasta, piso, tamanoDePagina, cursor),
      (h): string => h.cuentaId,
      tamanoDePagina,
    );
    for await (const hallazgo of hallazgos) {
      if (pasadaAgotada(resultado, maximoDeSenales)) break;
      await tratar(resultado, registrarError, () =>
        ContextoCuenta.ejecutarEn(hallazgo.cuentaId, async () => {
          const claveUnica = claveDeFlujoAtipico(rango.dia);
          if (await new RepositorioDeAvisosDeSenal(pool).existe(claveUnica)) return 'omitida';
          const efectivos = await umbrales.de(null);
          const usuariosActivos =
            (await crearServicioDeConteoDeUsuarios(pool).activosPorCuenta([hallazgo.cuentaId])).get(
              hallazgo.cuentaId,
            ) ?? 0;
          const medida = { aperturas: hallazgo.aperturas, usuariosActivos };
          const umbralesDeFlujo = {
            aperturasMinimo: efectivos.flujoAperturasMinimo,
            aperturasPorUsuario: efectivos.flujoAperturasPorUsuario,
          };
          if (!esFlujoAtipico(medida, umbralesDeFlujo)) return 'omitida';

          // Una cuenta dada de baja ya no tiene a quién avisar.
          const cuenta = await crearServicioDeCuentas(pool).identificar(hallazgo.cuentaId);
          if (cuenta === null) return 'omitida';
          const desdeDeLaBase = inicioDelDia(
            restarDias(rango.dia, DIAS_DE_BASE),
            ZONA_DE_LOS_TOPES,
          );
          const anteriores =
            (
              await actividad.porDia([hallazgo.cuentaId], desdeDeLaBase, rango.desde, DESFASE_UTC)
            ).get(hallazgo.cuentaId) ?? [];

          const datos: DatosDeAviso = {
            cuenta,
            sitio: null,
            placas: [],
            flujo: {
              dia: rango.dia,
              aperturas: hallazgo.aperturas,
              usuarios_activos: usuariosActivos,
              por_usuario: aperturasPorUsuario(medida),
              umbral_por_usuario: umbralesDeFlujo.aperturasPorUsuario,
              base: baseHabitual(anteriores.map((d) => d.aperturas)),
            },
          };
          const comun = {
            tipo: 'flujo.atipico',
            severidad: 'aviso',
            agrupacion: `flujo.atipico:cuenta:${cuenta.id}`,
            sitioId: null,
            miembros: [rango.dia],
            datos,
            alResolver: null,
          } as const;
          const avisos: AvisoAgrupado[] = [
            { ...comun, audiencia: 'cuenta' },
            { ...comun, audiencia: 'plataforma' },
          ];
          const entrega = await llevarABandeja(pool, hallazgo.cuentaId, {
            tipo: 'flujo_atipico',
            usuarioId: null,
            claveUnica,
            avisos,
            ahora,
          });
          if (entrega === 'ocupada') return 'ocupada';
          return entrega === 'avisada' ? 'abierta' : 'omitida';
        }),
      );
    }
  }
  return resultado;
}
