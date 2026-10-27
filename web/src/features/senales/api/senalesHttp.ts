import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import {
  POR_PAGINA_DE_FLUJO,
  type DetalleDeFlujo,
  type DiaDeFlujo,
  type FiltrosDeFlujo,
  type FlujoDeCuenta,
  type ListadoDeFlujo,
} from '../domain/flujo';
import {
  POR_PAGINA_DE_SENALES,
  type CuentaDeSenal,
  type EstadoDeSenal,
  type FiltrosDeSenales,
  type Gravedad,
  type ResumenDeSenales,
  type SenalDeAbuso,
  type TipoDeSenal,
} from '../domain/senal';
import type { SenalesRepositorio } from './SenalesRepositorio';

interface CuentaDto {
  id: string;
  codigo: string;
  nombre: string;
  estado?: string;
}

interface SenalDto {
  id: string;
  cuenta: CuentaDto;
  usuario: { id: string; etiqueta: string | null };
  tipo: TipoDeSenal;
  gravedad: Gravedad;
  descripcion: string | null;
  estado: EstadoDeSenal;
  ocurrido_at: string;
  created_at: string;
}

interface ResumenDto {
  desde: string;
  hasta: string;
  dias: number;
  total: number;
  abiertas: number;
  por_tipo: { tipo: TipoDeSenal; total: number; abiertas: number; altas: number }[];
  cuentas: { cuenta: CuentaDto; total: number; abiertas: number; altas: number }[];
}

interface FlujoCuentaDto {
  cuenta: CuentaDto;
  usuarios_activos: number;
  umbrales: { aperturas_minimo: number; aperturas_por_usuario: number };
  aperturas_hoy: number;
  por_usuario_hoy: number;
  atipica_hoy: boolean;
  aperturas_periodo: number;
  dias_atipicos: number;
  ultimo_dia_atipico: string | null;
  base: number | null;
}

interface DetalleFlujoDto {
  cuenta: CuentaDto;
  usuarios_activos: number;
  umbrales: { aperturas_minimo: number; aperturas_por_usuario: number };
  zona_horaria: string;
  serie: {
    dia: string;
    aperturas: number;
    rechazos: number;
    generados: number;
    por_usuario: number;
    atipico: boolean;
    base: number | null;
    veces_la_base: number | null;
  }[];
}

/** El día del calendario de La Paz no cambia de hora: UTC−4 todo el año (igual que el resto del panel). */
const DESFASE_DE_LA_PLATAFORMA = '-04:00';
const DIA_MS = 86_400_000;

/** Inicio del día `aaaa-mm-dd` en la zona de la plataforma, como instante con desfase. */
function inicioDelDia(dia: string): string {
  return `${dia}T00:00:00${DESFASE_DE_LA_PLATAFORMA}`;
}

/** El "hasta" del filtro incluye su día: la API lo toma como límite exclusivo. */
function inicioDelDiaSiguiente(dia: string): string {
  return new Date(new Date(inicioDelDia(dia)).getTime() + DIA_MS).toISOString();
}

function cuentaDesdeDto(dto: CuentaDto): CuentaDeSenal {
  return { id: dto.id, codigo: dto.codigo, nombre: dto.nombre };
}

export function senalDesdeDto(dto: SenalDto): SenalDeAbuso {
  return {
    id: dto.id,
    cuenta: cuentaDesdeDto(dto.cuenta),
    usuario: { id: dto.usuario.id, etiqueta: dto.usuario.etiqueta },
    tipo: dto.tipo,
    gravedad: dto.gravedad,
    descripcion: dto.descripcion,
    estado: dto.estado,
    ocurridaEn: new Date(dto.ocurrido_at),
  };
}

function flujoDeCuentaDesdeDto(dto: FlujoCuentaDto): FlujoDeCuenta {
  return {
    cuenta: cuentaDesdeDto(dto.cuenta),
    usuariosActivos: dto.usuarios_activos,
    umbrales: {
      aperturasMinimo: dto.umbrales.aperturas_minimo,
      aperturasPorUsuario: dto.umbrales.aperturas_por_usuario,
    },
    aperturasHoy: dto.aperturas_hoy,
    porUsuarioHoy: dto.por_usuario_hoy,
    atipicaHoy: dto.atipica_hoy,
    aperturasPeriodo: dto.aperturas_periodo,
    diasAtipicos: dto.dias_atipicos,
    ultimoDiaAtipico: dto.ultimo_dia_atipico,
    base: dto.base,
  };
}

/** Los filtros del panel como query de la API: un filtro en `todas`/`todos` no se envía. */
function consultaDeSenales(filtros: FiltrosDeSenales, porPagina: number) {
  return {
    pagina: filtros.pagina,
    por_pagina: porPagina,
    cuenta_id: filtros.cuentaId ?? undefined,
    usuario_id: filtros.usuarioId.trim() === '' ? undefined : filtros.usuarioId.trim(),
    tipo: filtros.tipo === 'todos' ? undefined : filtros.tipo,
    gravedad: filtros.gravedad === 'todas' ? undefined : filtros.gravedad,
    estado: filtros.estado === 'todas' ? undefined : filtros.estado,
    desde: filtros.desde === '' ? undefined : inicioDelDia(filtros.desde),
    hasta: filtros.hasta === '' ? undefined : inicioDelDiaSiguiente(filtros.hasta),
  };
}

/**
 * Endpoints `/plataforma/senales`, `/plataforma/senales/resumen`, `/plataforma/flujo-de-cuentas` y
 * `/plataforma/cuentas/{id}/flujo` (módulo `senales` de la API, solo super admin).
 */
export function crearSenalesHttp(cliente: ClienteHttp): SenalesRepositorio {
  return {
    async listarSenales(filtros) {
      const dto = await cliente.solicitar<ListadoDto<SenalDto>>({
        metodo: 'GET',
        ruta: '/plataforma/senales',
        consulta: consultaDeSenales(filtros, POR_PAGINA_DE_SENALES),
      });
      return paginadoDesde(dto, senalDesdeDto);
    },
    async resumen(dias) {
      const dto = await cliente.solicitar<ResumenDto>({
        metodo: 'GET',
        ruta: '/plataforma/senales/resumen',
        consulta: { dias },
      });
      const resumen: ResumenDeSenales = {
        dias: dto.dias,
        total: dto.total,
        abiertas: dto.abiertas,
        porTipo: dto.por_tipo,
        cuentas: dto.cuentas.map((fila) => ({
          cuenta: cuentaDesdeDto(fila.cuenta),
          total: fila.total,
          abiertas: fila.abiertas,
          altas: fila.altas,
        })),
      };
      return resumen;
    },
    async opcionesDeCuenta() {
      // La lista de cuentas sale del flujo: es lo que este permiso ya puede ver (sin `seguridad.cuenta.ver`).
      const dto = await cliente.solicitar<ListadoDto<FlujoCuentaDto>>({
        metodo: 'GET',
        ruta: '/plataforma/flujo-de-cuentas',
        consulta: { por_pagina: 100, orden: 'nombre', sentido: 'asc' },
      });
      return dto.datos.map((fila) => cuentaDesdeDto(fila.cuenta));
    },
    async listarFlujo(filtros: FiltrosDeFlujo) {
      const dto = await cliente.solicitar<ListadoDto<FlujoCuentaDto> & { meta: { hoy: string } }>({
        metodo: 'GET',
        ruta: '/plataforma/flujo-de-cuentas',
        consulta: {
          pagina: filtros.pagina,
          por_pagina: POR_PAGINA_DE_FLUJO,
          dias: filtros.dias,
          solo_atipicas: filtros.soloAtipicas,
          buscar: filtros.buscar.trim() === '' ? undefined : filtros.buscar.trim(),
          orden: filtros.orden,
          sentido: filtros.sentido,
        },
      });
      const listado: ListadoDeFlujo = {
        ...paginadoDesde(dto, flujoDeCuentaDesdeDto),
        dias: filtros.dias,
        hoy: dto.meta.hoy,
      };
      return listado;
    },
    async flujoDeCuenta(cuentaId, dias) {
      const dto = await cliente.solicitar<DetalleFlujoDto>({
        metodo: 'GET',
        ruta: `/plataforma/cuentas/${cuentaId}/flujo`,
        consulta: { dias },
      });
      const serie: DiaDeFlujo[] = dto.serie.map((dia) => ({
        dia: dia.dia,
        aperturas: dia.aperturas,
        rechazos: dia.rechazos,
        generados: dia.generados,
        porUsuario: dia.por_usuario,
        atipico: dia.atipico,
        base: dia.base,
        vecesLaBase: dia.veces_la_base,
      }));
      const detalle: DetalleDeFlujo = {
        cuenta: cuentaDesdeDto(dto.cuenta),
        usuariosActivos: dto.usuarios_activos,
        umbrales: {
          aperturasMinimo: dto.umbrales.aperturas_minimo,
          aperturasPorUsuario: dto.umbrales.aperturas_por_usuario,
        },
        zonaHoraria: dto.zona_horaria,
        serie,
      };
      return detalle;
    },
  };
}
