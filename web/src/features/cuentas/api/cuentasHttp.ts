import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import { paginadoDesde, type ListadoDto } from '../../../shared/api/tipos';
import {
  POR_PAGINA_DE_CUENTAS,
  type CuentaResumen,
  type DetalleDeCuenta,
  type SitioConPuertas,
} from '../domain/cuenta';
import { ESTADO_DESDE_DTO, ESTADO_HACIA_DTO, type EstadoDto } from '../../../shared/api/estados';
import { parsearMonto } from '../../pagos';
import type { CuentasRepositorio } from './CuentasRepositorio';

interface CuentaDto {
  id: string;
  codigo: string;
  nombre: string;
  plan: { id: string; nombre: string; cupo_usuarios: number | null } | null;
  usuarios_activos: number;
  vence_el: string | null;
  estado: EstadoDto;
}

interface ListadoCuentasDto extends ListadoDto<CuentaDto> {
  conteos: Record<'todas' | EstadoDto, number>;
}

interface DetalleDto {
  cuenta: { id: string; codigo: string; nombre: string; activa: boolean; cliente_desde: string };
  empresa: {
    nit: string;
    ciudad: string;
    contacto: string;
    telefono: string;
    correo: string | null;
  } | null;
  suscripcion: {
    id: string;
    plan: { id: string; nombre: string; cupo_usuarios: number | null; precio_anual: number };
    desde: string;
    hasta: string;
    estado: EstadoDto;
    dias_restantes: number;
  } | null;
  uso: {
    usuarios_activos: number;
    sitios: number;
    puertas: number;
    dispositivos_sin_conexion: number;
    administradores: number;
  };
}

interface SitioDto {
  id: string;
  nombre: string;
  direccion: string | null;
  zona_horaria: string;
  activo: boolean;
  puertas: {
    id: string;
    nombre: string;
    segundos_apertura: number;
    activa: boolean;
    dispositivo: {
      id: string;
      nombre: string;
      en_linea: boolean;
      ultimo_latido_at: string | null;
    } | null;
  }[];
}

export function cuentaDesdeDto(dto: CuentaDto): CuentaResumen {
  return {
    id: dto.id,
    codigo: dto.codigo,
    nombre: dto.nombre,
    plan:
      dto.plan === null
        ? null
        : { id: dto.plan.id, nombre: dto.plan.nombre, cupoUsuarios: dto.plan.cupo_usuarios },
    usuariosActivos: dto.usuarios_activos,
    venceEl: dto.vence_el === null ? null : new Date(dto.vence_el),
    estado: ESTADO_DESDE_DTO[dto.estado],
  };
}

export function detalleDesdeDto(dto: DetalleDto): DetalleDeCuenta {
  return {
    cuenta: {
      id: dto.cuenta.id,
      codigo: dto.cuenta.codigo,
      nombre: dto.cuenta.nombre,
      activa: dto.cuenta.activa,
      clienteDesde: new Date(dto.cuenta.cliente_desde),
    },
    empresa: dto.empresa,
    suscripcion:
      dto.suscripcion === null
        ? null
        : {
            id: dto.suscripcion.id,
            plan: {
              id: dto.suscripcion.plan.id,
              nombre: dto.suscripcion.plan.nombre,
              cupoUsuarios: dto.suscripcion.plan.cupo_usuarios,
              precioAnual: dto.suscripcion.plan.precio_anual,
            },
            desde: new Date(dto.suscripcion.desde),
            hasta: new Date(dto.suscripcion.hasta),
            estado: ESTADO_DESDE_DTO[dto.suscripcion.estado],
            diasRestantes: dto.suscripcion.dias_restantes,
          },
    uso: {
      usuariosActivos: dto.uso.usuarios_activos,
      sitios: dto.uso.sitios,
      puertas: dto.uso.puertas,
      dispositivosSinConexion: dto.uso.dispositivos_sin_conexion,
      administradores: dto.uso.administradores,
    },
  };
}

/** Endpoints `/plataforma/cuentas` de la API (módulo `seguridad`). */
export function crearCuentasHttp(cliente: ClienteHttp): CuentasRepositorio {
  return {
    async listar(filtros) {
      const dto = await cliente.solicitar<ListadoCuentasDto>({
        metodo: 'GET',
        ruta: '/plataforma/cuentas',
        consulta: {
          busqueda: filtros.busqueda,
          estado: filtros.estado === 'todas' ? 'todas' : ESTADO_HACIA_DTO[filtros.estado],
          pagina: filtros.pagina,
          por_pagina: POR_PAGINA_DE_CUENTAS,
        },
      });
      return {
        ...paginadoDesde(dto, cuentaDesdeDto),
        conteos: {
          todas: dto.conteos.todas,
          activa: dto.conteos.activa,
          porVencer: dto.conteos.por_vencer,
          vencida: dto.conteos.vencida,
          suspendida: dto.conteos.suspendida,
          pendientePago: dto.conteos.pendiente_pago,
        },
      };
    },

    async codigoDisponible(codigo, razonSocial) {
      const dto = await cliente.solicitar<{
        formato_valido: boolean;
        disponible: boolean;
        usado_por: string | null;
        sugerencias: string[];
      }>({
        metodo: 'GET',
        ruta: '/plataforma/cuentas/codigo-disponible',
        consulta: { codigo, razon_social: razonSocial },
      });
      return {
        formatoValido: dto.formato_valido,
        disponible: dto.disponible,
        usadoPor: dto.usado_por,
        sugerencias: dto.sugerencias,
      };
    },

    async crear(borrador) {
      const { empresa, vigencia } = borrador;
      const dto = await cliente.solicitar<{
        cuenta: { id: string; codigo: string; nombre: string };
        administrador: { id: string; etiqueta: string; pin: string };
        suscripcion: { estado: EstadoDto };
      }>({
        metodo: 'POST',
        ruta: '/plataforma/cuentas',
        cuerpo: {
          razon_social: empresa.razonSocial.trim(),
          codigo: empresa.codigo,
          nit: empresa.nit.trim(),
          ciudad: empresa.ciudad,
          contacto_nombre: empresa.contactoNombre.trim(),
          contacto_telefono: empresa.contactoTelefono.trim(),
          contacto_correo: empresa.contactoCorreo.trim(),
          plan_id: borrador.planId,
          inicio: vigencia.inicio,
          administrador_nombre: (vigencia.adminIgualAlResponsable
            ? empresa.contactoNombre
            : vigencia.administradorNombre
          ).trim(),
          ...(borrador.pago.modo === 'ahora'
            ? {
                pago: {
                  monto: parsearMonto(borrador.pago.monto),
                  fecha_pago: borrador.pago.fechaPago,
                  medio: borrador.pago.medio,
                  referencia: borrador.pago.referencia.trim(),
                },
              }
            : {}),
        },
      });
      return {
        cuenta: dto.cuenta,
        administrador: dto.administrador,
        estado: ESTADO_DESDE_DTO[dto.suscripcion.estado],
      };
    },

    async administradores(cuentaId) {
      const dto = await cliente.solicitar<{
        datos: {
          id: string;
          etiqueta: string | null;
          pin_generado_at: string | null;
          ultimo_ingreso_at: string | null;
        }[];
      }>({ metodo: 'GET', ruta: `/plataforma/cuentas/${cuentaId}/administradores` });
      return dto.datos.map((a) => ({
        id: a.id,
        etiqueta: a.etiqueta ?? '—',
        pinGeneradoEn: a.pin_generado_at === null ? null : new Date(a.pin_generado_at),
        ultimoIngresoEn: a.ultimo_ingreso_at === null ? null : new Date(a.ultimo_ingreso_at),
      }));
    },

    async regenerarPin(cuentaId, usuarioId) {
      const dto = await cliente.solicitar<{ pin: string }>({
        metodo: 'POST',
        ruta: `/plataforma/cuentas/${cuentaId}/administradores/${usuarioId}/pin`,
      });
      return dto.pin;
    },

    async cambiarCodigo(cuentaId, codigo) {
      await cliente.solicitar({
        metodo: 'PUT',
        ruta: `/plataforma/cuentas/${cuentaId}/codigo`,
        cuerpo: { codigo },
      });
    },

    async obtener(id) {
      return detalleDesdeDto(
        await cliente.solicitar<DetalleDto>({ metodo: 'GET', ruta: `/plataforma/cuentas/${id}` }),
      );
    },

    async editar(id, datos) {
      await cliente.solicitar({
        metodo: 'PATCH',
        ruta: `/plataforma/cuentas/${id}`,
        cuerpo: {
          razon_social: datos.razonSocial.trim(),
          nit: datos.nit.trim(),
          ciudad: datos.ciudad,
          contacto_nombre: datos.contactoNombre.trim(),
          contacto_telefono: datos.contactoTelefono.trim(),
          contacto_correo: datos.contactoCorreo.trim(),
        },
      });
    },

    async eliminar(id, codigo) {
      await cliente.solicitar({
        metodo: 'DELETE',
        ruta: `/plataforma/cuentas/${id}`,
        cuerpo: { codigo },
      });
    },

    async sitiosYPuertas(id) {
      const dto = await cliente.solicitar<{ datos: SitioDto[] }>({
        metodo: 'GET',
        ruta: `/plataforma/cuentas/${id}/sitios`,
      });
      return dto.datos.map((sitio): SitioConPuertas => ({
        id: sitio.id,
        nombre: sitio.nombre,
        direccion: sitio.direccion,
        zonaHoraria: sitio.zona_horaria,
        activo: sitio.activo,
        puertas: sitio.puertas.map((puerta) => ({
          id: puerta.id,
          nombre: puerta.nombre,
          segundosApertura: puerta.segundos_apertura,
          activa: puerta.activa,
          dispositivo:
            puerta.dispositivo === null
              ? null
              : {
                  id: puerta.dispositivo.id,
                  nombre: puerta.dispositivo.nombre,
                  enLinea: puerta.dispositivo.en_linea,
                  ultimaSenal:
                    puerta.dispositivo.ultimo_latido_at === null
                      ? null
                      : new Date(puerta.dispositivo.ultimo_latido_at),
                },
        })),
      }));
    },

    async crearSitio(cuentaId, datos) {
      await cliente.solicitar({
        metodo: 'POST',
        ruta: `/plataforma/cuentas/${cuentaId}/sitios`,
        cuerpo: {
          nombre: datos.nombre.trim(),
          direccion: datos.direccion.trim(),
          zona_horaria: datos.zonaHoraria,
        },
      });
    },

    async editarSitio(cuentaId, sitioId, cambios) {
      await cliente.solicitar({
        metodo: 'PATCH',
        ruta: `/plataforma/cuentas/${cuentaId}/sitios/${sitioId}`,
        cuerpo: {
          ...(cambios.nombre === undefined ? {} : { nombre: cambios.nombre.trim() }),
          ...(cambios.direccion === undefined ? {} : { direccion: cambios.direccion.trim() }),
          ...(cambios.zonaHoraria === undefined ? {} : { zona_horaria: cambios.zonaHoraria }),
          ...(cambios.activo === undefined ? {} : { activo: cambios.activo }),
        },
      });
    },

    async eliminarSitio(cuentaId, sitioId) {
      await cliente.solicitar({
        metodo: 'DELETE',
        ruta: `/plataforma/cuentas/${cuentaId}/sitios/${sitioId}`,
      });
    },

    async crearPuerta(cuentaId, sitioId, datos) {
      await cliente.solicitar({
        metodo: 'POST',
        ruta: `/plataforma/cuentas/${cuentaId}/sitios/${sitioId}/puertas`,
        cuerpo: { nombre: datos.nombre.trim(), segundos_apertura: datos.segundosApertura },
      });
    },

    async editarPuerta(cuentaId, puertaId, cambios) {
      await cliente.solicitar({
        metodo: 'PATCH',
        ruta: `/plataforma/cuentas/${cuentaId}/puertas/${puertaId}`,
        cuerpo: {
          ...(cambios.nombre === undefined ? {} : { nombre: cambios.nombre.trim() }),
          ...(cambios.segundosApertura === undefined
            ? {}
            : { segundos_apertura: cambios.segundosApertura }),
          ...(cambios.activa === undefined ? {} : { activa: cambios.activa }),
        },
      });
    },

    async eliminarPuerta(cuentaId, puertaId) {
      await cliente.solicitar({
        metodo: 'DELETE',
        ruta: `/plataforma/cuentas/${cuentaId}/puertas/${puertaId}`,
      });
    },
  };
}
