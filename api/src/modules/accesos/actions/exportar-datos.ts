import type { Pool } from 'mysql2/promise';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalUsuario } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import {
  crearServicioDeArbol,
  crearServicioDeUsuariosExportables,
} from '../../seguridad/contracts.js';
import { armarCsv, type Celda } from '../domain/csv.js';
import {
  resumirExportacion,
  tramoDe,
  type RecursoExportable,
  type ResumenDeExportacion,
} from '../domain/exportacion.js';
import { RepositorioDeEventos, RepositorioDeExportaciones } from '../repository.js';
import { alcanceDe, presentarEventos, type FiltrosDeEventos } from './listar-eventos.js';

export interface PaginaExportada extends ResumenDeExportacion {
  /** El CSV de esta página, con su fila de encabezado. */
  readonly csv: string;
  readonly pagina: number;
  readonly porPagina: number;
  /** Filas de datos de esta página (sin el encabezado). */
  readonly filas: number;
}

const ENCABEZADO_DE_USUARIOS = [
  'id',
  'etiqueta',
  'rol',
  'superior_id',
  'estado',
  'estado_motivo',
  'creado_at',
] as const;
const ENCABEZADO_DE_PUERTAS = [
  'id',
  'nombre',
  'sitio_id',
  'sitio',
  'zona_horaria',
  'segundos_apertura',
  'activa',
] as const;
const ENCABEZADO_DE_LECTURAS = [
  'id',
  'ocurrido_at',
  'puerta_id',
  'puerta',
  'sitio',
  'resultado',
  'motivo_code',
  'ejecucion',
  'qr_id',
  'qr_etiqueta',
  'generador_id',
  'generador',
] as const;

interface Pagina {
  readonly total: number;
  readonly encabezado: readonly string[];
  readonly filas: readonly (readonly Celda[])[];
}

async function paginaDeUsuarios(
  pool: Pool,
  alcance: readonly string[],
  limite: number,
  desplazamiento: number,
): Promise<Pagina> {
  const servicio = crearServicioDeUsuariosExportables(pool);
  const [total, usuarios] = await Promise.all([
    servicio.total(alcance),
    servicio.pagina(alcance, limite, desplazamiento),
  ]);
  return {
    total,
    encabezado: ENCABEZADO_DE_USUARIOS,
    // Nada del PIN ni de la contraseña: `UsuarioExportable` no los trae.
    filas: usuarios.map((u) => [
      u.id,
      u.etiqueta,
      u.rol,
      u.superiorId,
      u.estado,
      u.estadoMotivo,
      u.creadoAt,
    ]),
  };
}

async function paginaDePuertas(
  pool: Pool,
  alcance: readonly string[],
  limite: number,
  desplazamiento: number,
): Promise<Pagina> {
  const servicio = crearServicioDeOrganizacion(pool);
  const [total, puertas] = await Promise.all([
    servicio.contarPuertas(alcance),
    servicio.puertasPagina(alcance, limite, desplazamiento),
  ]);
  return {
    total,
    encabezado: ENCABEZADO_DE_PUERTAS,
    filas: puertas.map((p) => [
      p.id,
      p.nombre,
      p.sitioId,
      p.sitioNombre,
      p.zonaHoraria,
      p.segundosApertura,
      p.activa,
    ]),
  };
}

async function paginaDeLecturas(
  pool: Pool,
  principal: PrincipalUsuario,
  filtros: FiltrosDeEventos,
  limite: number,
  desplazamiento: number,
): Promise<Pagina> {
  // El mismo alcance que el listado de eventos: quien exporta sin `ver_todos` solo se lleva lo suyo.
  const alcance = await alcanceDe(pool, principal, filtros);
  const eventos = new RepositorioDeEventos(pool);
  const [total, filas] = await Promise.all([
    eventos.contarVisibles(alcance),
    eventos.listarParaExportar(alcance, limite, desplazamiento),
  ]);
  const presentados = await presentarEventos(pool, filas);
  return {
    total,
    encabezado: ENCABEZADO_DE_LECTURAS,
    // Sin el token ni su hash: ni `presentarEventos` ni la consulta los traen.
    filas: presentados.map((e) => [
      e.id,
      e.ocurrido_at,
      e.puerta.id,
      e.puerta.nombre,
      e.puerta.sitio.nombre,
      e.resultado,
      e.motivo_code,
      e.ejecucion,
      e.qr_id,
      e.qr?.etiqueta ?? null,
      e.qr?.generador.id ?? null,
      e.qr?.generador.etiqueta ?? null,
    ]),
  };
}

/**
 * Una página de datos de la cuenta en CSV (ADR 0033 §3, ola W11): `usuarios`, `puertas` o `lecturas`.
 *
 * - **Paginada y con tope:** nunca más de `TOPE_DE_FILAS_EXPORTABLES` filas de un recurso en total; una página que
 *   empieza más allá del tope responde 422 `exportacion.tope_excedido`. Para más datos, se acota con filtros.
 * - **Queda en la bitácora:** cada página descargada inserta su constancia (`exportaciones`: quién, qué recurso,
 *   cuántas filas, con qué filtros) en una transacción. Si la constancia no se puede guardar, no se entrega nada.
 * - **Sin secretos:** ni tokens, ni hashes, ni PIN, ni credenciales (las columnas están escritas a mano, no son
 *   `SELECT *`). Todo texto de una persona sale neutralizado contra la inyección de fórmulas (`domain/csv.ts`).
 * - **De la cuenta del contexto**, por el repositorio de cuenta: la cuenta A nunca recibe filas de la B. Dentro de
 *   ella, `usuarios` son quien exporta y su rama, y `puertas` las que dieron de alta ellos: un Administrador no
 *   exporta lo de otro Administrador de la misma cuenta (ADR 0028 §4, D-29).
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  recurso: RecursoExportable,
  paginacion: { readonly pagina: number; readonly por_pagina: number },
  filtros: FiltrosDeEventos,
): Promise<PaginaExportada> {
  const tramo = tramoDe(paginacion.pagina, paginacion.por_pagina);
  if (tramo === null) throw new ErrorDeDominio('exportacion.tope_excedido', 422);

  // `usuarios` y `puertas` se limitan al ALCANCE de quien exporta: él y su rama (ADR 0028 §4), también un Administrador.
  // Las `lecturas` ya salen con el alcance del listado de eventos.
  const alcance =
    recurso === 'lecturas'
      ? []
      : [...(await crearServicioDeArbol(pool).alcanceDe(principal.usuarioId)).ids];
  const leida =
    recurso === 'usuarios'
      ? await paginaDeUsuarios(pool, alcance, tramo.limite, tramo.desplazamiento)
      : recurso === 'puertas'
        ? await paginaDePuertas(pool, alcance, tramo.limite, tramo.desplazamiento)
        : await paginaDeLecturas(pool, principal, filtros, tramo.limite, tramo.desplazamiento);

  await enTransaccion(pool, (tx) =>
    new RepositorioDeExportaciones(pool).registrar(tx, {
      recurso,
      pagina: paginacion.pagina,
      porPagina: paginacion.por_pagina,
      filas: leida.filas.length,
      filtros:
        recurso === 'lecturas'
          ? {
              resultado: filtros.resultado,
              ejecucion: filtros.ejecucion ?? null,
              puerta_id: filtros.puertaId,
              desde: filtros.desde?.toISOString() ?? null,
              hasta: filtros.hasta?.toISOString() ?? null,
            }
          : null,
    }),
  );

  return {
    csv: armarCsv(leida.encabezado, leida.filas),
    pagina: paginacion.pagina,
    porPagina: paginacion.por_pagina,
    filas: leida.filas.length,
    ...resumirExportacion(leida.total, tramo, leida.filas.length),
  };
}
