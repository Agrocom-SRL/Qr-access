import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { sumarDias } from '../../../platform/tiempo/fechas.js';
import { diaLocal, ZONA_DE_LOS_TOPES } from '../../accesos/contracts.js';
import {
  crearServicioDeMarcasDeBolsa,
  type MarcaDeBolsaRegistrada,
} from '../../limites/contracts.js';
import type { AvisoAgrupado, DatosDeAviso } from '../../notificaciones/contracts.js';
import { crearServicioDeCuentas } from '../../seguridad/contracts.js';
import { llevarABandeja } from '../bandeja.js';
import { claveDeAvisoDeBolsa, RETROCESO_DE_MARCAS_DE_BOLSA_DIAS } from '../domain/reglas.js';
import {
  MAXIMO_DE_SENALES_POR_PASADA,
  pasadaAgotada,
  TAMANO_DE_PAGINA,
  type ResultadoDePasada,
  pasadaVacia,
  recorrer,
  tratar,
} from '../pasada.js';
import { RepositorioDeAvisosDeSenal } from '../repository.js';

/** Los avisos de una marca de la bolsa: uno para el propietario de la cuenta y otro para AGROCOM. */
function avisosDeLaMarca(
  marca: MarcaDeBolsaRegistrada,
  cuenta: { id: string; codigo: string; nombre: string },
): AvisoAgrupado[] {
  const dia = diaLocal(marca.ocurridoAt, ZONA_DE_LOS_TOPES);
  const mes = dia.slice(0, 7);
  const superada = marca.tipo === 'bolsa.superada';
  const datos: DatosDeAviso = {
    cuenta,
    sitio: null,
    placas: [],
    bolsa: { mes, dia, usado: marca.valor, tope: marca.tope },
  };
  const comun = {
    tipo: marca.tipo,
    // Llegar al porcentaje de aviso informa; pasarse de la bolsa avisa (no corta nada: se negocia, ADR 0030 §2).
    severidad: superada ? 'aviso' : 'info',
    // Un aviso abierto por cuenta, mes y tipo: los días siguientes que sigue superada lo ACTUALIZAN (la persistencia es
    // lo que importa) en vez de abrir otro.
    agrupacion: `${marca.tipo}:cuenta:${cuenta.id}:${mes}`,
    sitioId: null,
    miembros: [superada ? dia : mes],
    datos,
    alResolver: null,
  } as const;
  return [
    { ...comun, audiencia: 'cuenta' },
    { ...comun, audiencia: 'plataforma' },
  ];
}

/**
 * Lleva a la bandeja las marcas de la bolsa mensual (ADR 0030 §2 y §5, ola W12). La generación de QR ya deja la marca
 * en `eventos_de_limite` (`bolsa.aviso:<mes>` al llegar al porcentaje de aviso, `bolsa.superada:<día>` al pasarse) y NO
 * corta nada; acá el sistema avisa, una sola vez por marca (la constancia `bolsa:<clave de la marca>`):
 * - al propietario de la cuenta (todos los Administradores con permiso de avisos) y
 * - a AGROCOM (el equipo con permiso de avisos de plataforma).
 *
 * Mira las marcas de los últimos `RETROCESO_DE_MARCAS_DE_BOLSA_DIAS` días, de todas las cuentas, por id con un cursor:
 * lo que quedó sin avisar por una caída se recupera, y lo ya avisado se salta con una lectura. «Superada» es la marca
 * de la generación (más QR que la bolsa); llegar justo al 100 % no la deja. Nunca toca la generación ni la validación.
 */
export async function ejecutar(
  pool: Pool,
  ahora: Date = new Date(),
  registrarError: (error: unknown) => void = () => undefined,
  tamanoDePagina: number = TAMANO_DE_PAGINA,
  maximoDeSenales: number = MAXIMO_DE_SENALES_POR_PASADA,
): Promise<ResultadoDePasada> {
  const marcas = crearServicioDeMarcasDeBolsa(pool);
  const desde = sumarDias(ahora, -RETROCESO_DE_MARCAS_DE_BOLSA_DIAS);
  const resultado = pasadaVacia();

  const hallazgos = recorrer(
    (cursor: string | null) => marcas.desde(desde, cursor, tamanoDePagina),
    (marca): string => marca.id,
    tamanoDePagina,
  );
  for await (const marca of hallazgos) {
    if (pasadaAgotada(resultado, maximoDeSenales)) break;
    await tratar(resultado, registrarError, () =>
      ContextoCuenta.ejecutarEn(marca.cuentaId, async () => {
        const claveUnica = claveDeAvisoDeBolsa(marca.claveUnica, marca.id);
        if (await new RepositorioDeAvisosDeSenal(pool).existe(claveUnica)) return 'omitida';
        // Una cuenta dada de baja ya no tiene a quién avisar.
        const cuenta = await crearServicioDeCuentas(pool).identificar(marca.cuentaId);
        if (cuenta === null) return 'omitida';
        const entrega = await llevarABandeja(pool, marca.cuentaId, {
          tipo: marca.tipo,
          usuarioId: null,
          claveUnica,
          avisos: avisosDeLaMarca(marca, cuenta),
          ahora,
        });
        if (entrega === 'ocupada') return 'ocupada';
        return entrega === 'avisada' ? 'abierta' : 'omitida';
      }),
    );
  }
  return resultado;
}
