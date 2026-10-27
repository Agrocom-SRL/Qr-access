/**
 * Exportación de los datos de una cuenta en CSV, para AGROCOM (ADR 0033 §3, ola W11). La API entrega UNA página
 * por pedido, con un tope total por recurso: el panel baja las páginas de a una, sin pedirlas todas juntas (el
 * límite de exportaciones por minuto de la API cuenta cada pedido). Puro: no toca la red ni el DOM.
 */

export const RECURSOS_EXPORTABLES = ['usuarios', 'puertas', 'lecturas'] as const;
export type RecursoExportable = (typeof RECURSOS_EXPORTABLES)[number];

/** Permiso de ámbito plataforma para exportar los datos de una cuenta (`db/seeds/01_catalogo.sql`). */
export const PERMISO_EXPORTAR_DE_CUENTA = 'accesos.evento.exportar_cuenta';

/** Filas por página: el máximo que acepta la API (`FILAS_POR_PAGINA_MAXIMAS`), para que el tope pese lo menos posible. */
export const POR_PAGINA_DE_EXPORTACION = 1000;

/** Filtro de resultado (solo vale para las lecturas). `todos` no se manda a la API. */
export type ResultadoDeFiltro = 'todos' | 'permitido' | 'rechazado';

export interface FiltrosDeExportacion {
  resultado: ResultadoDeFiltro;
  /** Día de inicio, `aaaa-mm-dd` en La Paz; `''` = sin límite. */
  desde: string;
  /** Día de fin incluido, `aaaa-mm-dd` en La Paz; `''` = sin límite. */
  hasta: string;
}

export const FILTROS_INICIALES_DE_EXPORTACION: FiltrosDeExportacion = {
  resultado: 'todos',
  desde: '',
  hasta: '',
};

/** Lo que la API cuenta de una página en sus cabeceras `X-*`. `total` ya viene con el tope aplicado. */
export interface ResumenDePagina {
  pagina: number;
  porPagina: number;
  total: number;
  filas: number;
  hayMas: boolean;
  truncado: boolean;
}

/** Una página lista para bajar: el CSV y su resumen. */
export interface PaginaDeExportacion {
  csv: Blob;
  resumen: ResumenDePagina;
}

/**
 * La zona de La Paz no tiene horario de verano: siempre UTC-4. Los filtros de fecha de la API son instantes con
 * desfase (`[desde, hasta)`), así que un día entero va de su 00:00 a las 00:00 del día siguiente, en esa zona.
 */
const DESFASE_DE_LA_PAZ = '-04:00';

/** El instante en que empieza un día de La Paz, como ISO 8601 con desfase (lo que pide la API). */
export function inicioDelDia(dia: string): string {
  return `${dia}T00:00:00${DESFASE_DE_LA_PAZ}`;
}

/** El día siguiente a `dia` (`aaaa-mm-dd`), sin pasar por la zona horaria del navegador. */
export function diaSiguiente(dia: string): string {
  const [anio = 0, mes = 1, numero = 1] = dia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, numero + 1)).toISOString().slice(0, 10);
}

/** Que el rango no esté al revés. Un extremo vacío es un rango abierto y siempre vale. */
export function rangoValido(filtros: FiltrosDeExportacion): boolean {
  if (filtros.desde === '' || filtros.hasta === '') return true;
  return filtros.desde <= filtros.hasta;
}

/**
 * La consulta de una página. Los filtros solo valen para las lecturas: con `usuarios` o `puertas` no se mandan.
 * El fin del rango se pasa como el inicio del día siguiente, porque la API usa `[desde, hasta)`.
 */
export function consultaDeExportacion(
  recurso: RecursoExportable,
  pagina: number,
  filtros: FiltrosDeExportacion,
): Record<string, string | number> {
  const consulta: Record<string, string | number> = {
    pagina,
    por_pagina: POR_PAGINA_DE_EXPORTACION,
  };
  if (recurso !== 'lecturas') return consulta;
  if (filtros.resultado !== 'todos') consulta.resultado = filtros.resultado;
  if (filtros.desde !== '') consulta.desde = inicioDelDia(filtros.desde);
  if (filtros.hasta !== '') consulta.hasta = inicioDelDia(diaSiguiente(filtros.hasta));
  return consulta;
}

/** Cuántas páginas hacen falta para el total (al menos una: una exportación vacía también tiene una). */
export function paginasDe(total: number, porPagina: number): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

/** La página que sigue a la última bajada: la siguiente si hay más; si no, vuelve a la primera. */
export function paginaSiguiente(ultimo: ResumenDePagina | null): number {
  return ultimo?.hayMas ? ultimo.pagina + 1 : 1;
}

/** Identifica un recurso con sus filtros: si cambia, la última página bajada deja de valer para seguir. */
export function claveDeExportacion(
  recurso: RecursoExportable,
  filtros: FiltrosDeExportacion,
): string {
  return [recurso, filtros.resultado, filtros.desde, filtros.hasta].join('|');
}

/** Nombre del archivo: el recurso, el código de la cuenta y la página, como `lecturas-agr-p2.csv`. */
export function nombreDeArchivo(
  recurso: RecursoExportable,
  codigoCuenta: string,
  pagina: number,
): string {
  return `${recurso}-${codigoCuenta.toLowerCase()}-p${String(pagina)}.csv`;
}

/** Excel lee el UTF-8 con tildes solo si el archivo empieza con la marca de orden de bytes (BOM). */
const MARCA_DE_ORDEN_DE_BYTES = '﻿';

export function conBomDeExcel(csv: Blob): Blob {
  return new Blob([MARCA_DE_ORDEN_DE_BYTES, csv], { type: 'text/csv;charset=utf-8' });
}
