import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type {
  PrincipalPlataforma,
  PrincipalUsuario,
} from '../../../platform/seguridad/principal.js';
import { aIsoONulo, sumarDias } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeActividadDeQr } from '../../accesos/contracts.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import {
  DIAS_SIN_USO_PARA_INACTIVO,
  QR_POR_DIA_PARA_RUIDOSO,
  SIN_ACTIVIDAD,
  VENTANA_EN_DIAS,
  estaCercaDelTope,
  evaluarUsuario,
  porcentajeDelTope,
  usuariosPorRama,
} from '../domain/actividad-de-usuarios.js';
import { nivelDeRol, type NivelDeUsuario } from '../domain/jerarquia.js';
import {
  RepositorioDeCuentas,
  RepositorioDeCuentasDePlataforma,
  RepositorioDeRolesDeUsuario,
  RepositorioDeUsuarios,
  type UsuarioFila,
} from '../repository.js';

/** Los días se cortan en la zona de la plataforma (La Paz), igual que las gráficas del panel. */
const DESFASE_UTC = '-04:00';

export interface UsuarioConUso {
  id: string;
  etiqueta: string | null;
  rol: string | null;
  /** La unidad, si es un Titular. */
  unidad: string | null;
  qr_generados: number;
  qr_usados: number;
  max_qr_en_un_dia: number;
  ultimo_qr_at: string | null;
  inactivo: boolean;
  ruidoso: boolean;
}

export interface TitularConMiembros {
  id: string;
  etiqueta: string | null;
  unidad: string | null;
  miembros: number;
  tope: number;
  porcentaje: number;
  cerca_del_tope: boolean;
}

export interface EstadisticasDeUsuarios {
  ventana_dias: number;
  umbral_inactivo_dias: number;
  umbral_ruidoso_por_dia: number;
  resumen: {
    usuarios: number;
    inactivos: number;
    ruidosos: number;
    titulares_cerca_del_tope: number;
  };
  usuarios: UsuarioConUso[];
  titulares: TitularConMiembros[];
}

export interface EstadisticasDeCuenta extends EstadisticasDeUsuarios {
  /** Cuántos usuarios cuelgan de cada Administrador (el cupo de su rama). */
  ramas: { id: string; etiqueta: string | null; usuarios: number }[];
}

/**
 * Arma las estadísticas de uso de un grupo de usuarios de la cuenta del contexto. Informativas: los
 * umbrales son fijos (30 días sin QR = inactivo; más de 10 QR en un día = ruidoso) y nada se hace
 * solo. Los Administradores no se evalúan: nadie decide su baja desde acá.
 */
async function armar(
  pool: Pool,
  filas: readonly UsuarioFila[],
  tope: number,
  ahora: Date,
): Promise<{
  estadisticas: EstadisticasDeUsuarios;
  niveles: Map<string, NivelDeUsuario | null>;
}> {
  const ids = filas.map((fila) => fila.id);
  const [roles, unidades, actividad] = await Promise.all([
    new RepositorioDeRolesDeUsuario(pool).rolesDeVarios(ids),
    crearServicioDeOrganizacion(pool).unidadesDeTitulares(ids),
    crearServicioDeActividadDeQr(pool).deGeneradores(
      ids,
      sumarDias(ahora, -VENTANA_EN_DIAS),
      DESFASE_UTC,
    ),
  ]);
  const niveles = new Map<string, NivelDeUsuario | null>();
  for (const fila of filas) {
    const [rol] = roles.get(fila.id) ?? [];
    niveles.set(fila.id, rol === undefined ? null : nivelDeRol(rol.nombre));
  }

  const miembrosPorTitular = new Map<string, number>();
  for (const fila of filas) {
    if (niveles.get(fila.id) === 'miembro' && fila.superior_id !== null) {
      miembrosPorTitular.set(fila.superior_id, (miembrosPorTitular.get(fila.superior_id) ?? 0) + 1);
    }
  }

  const usuarios: UsuarioConUso[] = filas
    .filter((fila) => niveles.get(fila.id) !== 'administrador')
    .map((fila) => {
      const uso = actividad.get(fila.id) ?? SIN_ACTIVIDAD;
      const { inactivo, ruidoso } = evaluarUsuario(uso, fila.created_at, ahora);
      const [rol] = roles.get(fila.id) ?? [];
      return {
        id: fila.id,
        etiqueta: fila.etiqueta,
        rol: rol?.nombre ?? null,
        unidad: unidades.get(fila.id)?.nombre ?? null,
        qr_generados: uso.generados,
        qr_usados: uso.usados,
        max_qr_en_un_dia: uso.maxEnUnDia,
        ultimo_qr_at: aIsoONulo(uso.ultimoGeneradoAt),
        inactivo,
        ruidoso,
      };
    })
    // Lo que merece una mirada primero: ruidosos, después inactivos; el resto, por nombre
    .sort(
      (a, b) =>
        Number(b.ruidoso) - Number(a.ruidoso) ||
        Number(b.inactivo) - Number(a.inactivo) ||
        (a.etiqueta ?? '').localeCompare(b.etiqueta ?? ''),
    );

  const titulares: TitularConMiembros[] = filas
    .filter((fila) => niveles.get(fila.id) === 'titular')
    .map((fila) => {
      const miembros = miembrosPorTitular.get(fila.id) ?? 0;
      return {
        id: fila.id,
        etiqueta: fila.etiqueta,
        unidad: unidades.get(fila.id)?.nombre ?? null,
        miembros,
        tope,
        porcentaje: porcentajeDelTope(miembros, tope),
        cerca_del_tope: estaCercaDelTope(miembros, tope),
      };
    })
    .sort(
      (a, b) => b.porcentaje - a.porcentaje || (a.etiqueta ?? '').localeCompare(b.etiqueta ?? ''),
    );

  return {
    niveles,
    estadisticas: {
      ventana_dias: VENTANA_EN_DIAS,
      umbral_inactivo_dias: DIAS_SIN_USO_PARA_INACTIVO,
      umbral_ruidoso_por_dia: QR_POR_DIA_PARA_RUIDOSO,
      resumen: {
        usuarios: usuarios.length,
        inactivos: usuarios.filter((u) => u.inactivo).length,
        ruidosos: usuarios.filter((u) => u.ruidoso).length,
        titulares_cerca_del_tope: titulares.filter((t) => t.cerca_del_tope).length,
      },
      usuarios,
      titulares,
    },
  };
}

/**
 * El uso de la rama de quien pregunta (ADR 0028 §4): cada Administrador ve solo a quienes cuelgan de
 * él. Con `seguridad.estadistica.ver`; es una segunda capa sobre el aislamiento por cuenta.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalUsuario,
  ahora: Date = new Date(),
): Promise<EstadisticasDeUsuarios> {
  const [cuenta, filas] = await Promise.all([
    new RepositorioDeCuentas(pool).buscarActivaPorId(principal.cuentaId),
    new RepositorioDeUsuarios(pool).todosDeRama(principal.usuarioId),
  ]);
  if (cuenta === null) throw new ErrorDeDominio('autenticacion.requerida', 401);
  return (await armar(pool, filas, cuenta.max_miembros_por_titular, ahora)).estadisticas;
}

/** El uso de todos los usuarios de una cuenta, para la ficha de AGROCOM, con el cupo de cada rama. */
export async function deCuenta(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  ahora: Date = new Date(),
): Promise<EstadisticasDeCuenta> {
  const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);
  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const filas = await new RepositorioDeUsuarios(pool).listarTodos();
    const { estadisticas, niveles } = await armar(
      pool,
      filas,
      cuenta.max_miembros_por_titular,
      ahora,
    );
    const porRama = usuariosPorRama(
      filas.map((fila) => ({ id: fila.id, superiorId: fila.superior_id })),
    );
    return {
      ...estadisticas,
      ramas: filas
        .filter((fila) => niveles.get(fila.id) === 'administrador')
        .map((fila) => ({
          id: fila.id,
          etiqueta: fila.etiqueta,
          usuarios: porRama.get(fila.id) ?? 0,
        })),
    };
  });
}
