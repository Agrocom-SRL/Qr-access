import type { Pool } from 'mysql2/promise';
import {
  armarListado,
  limiteDe,
  type Listado,
  type Paginacion,
} from '../../../platform/http/paginacion.js';
import { inicioDelDia, sumarDias } from '../../../platform/tiempo/fechas.js';
import { crearServicioDeIdentidades } from '../../seguridad/contracts.js';
import { crearServicioDeSuscripcionesDePlataforma } from '../../suscripciones/contracts.js';
import {
  clasificarCambio,
  detalleDelCambio,
  type CambioCrudo,
  type Detalle,
} from '../domain/clasificar.js';
import { RepositorioDeBitacora, type BitacoraFila } from '../repository.js';

export interface ConsultaDeBitacora {
  readonly cuentaId?: string | undefined;
  readonly accion?: BitacoraFila['accion'] | undefined;
  /** `aaaa-mm-dd`, día completo en la zona de la plataforma. */
  readonly desde?: string | undefined;
  readonly hasta?: string | undefined;
}

export interface EventoDeBitacora extends Detalle {
  id: string;
  ocurrido_at: string;
  usuario: { id: string; nombre: string } | null;
  cuenta: { id: string; codigo: string } | null;
  accion: BitacoraFila['accion'];
  /** Tipo de evento (`pago.registrado`, `suscripcion.plan_cambiado`…): el panel lo traduce. */
  codigo: string;
  origen: BitacoraFila['origen'];
  /** Desde dónde se hizo: el panel (super admin), la app (usuario de una cuenta), el sistema o un lector. */
  canal: 'panel' | 'app' | 'automatico' | 'dispositivo';
}

/** La cuenta a la que pertenece el cambio: `tenant_id`, o el propio registro si es la fila de `cuentas`. */
function cuentaDe(fila: BitacoraFila): string | null {
  return fila.tabla === 'cuentas' ? fila.registro_id : fila.tenant_id;
}

function canalDe(fila: BitacoraFila, deLaPlataforma: boolean): EventoDeBitacora['canal'] {
  if (fila.origen === 'sistema') return 'automatico';
  if (fila.origen === 'dispositivo') return 'dispositivo';
  return deLaPlataforma ? 'panel' : 'app';
}

function aCambio(fila: BitacoraFila): CambioCrudo {
  return {
    tabla: fila.tabla,
    accion: fila.accion,
    registroId: fila.registro_id,
    tenantId: fila.tenant_id,
    antes: fila.antes,
    despues: fila.despues,
  };
}

/** Los ids de plan que mencionan los eventos de la página, para ponerles nombre. */
function idsDePlanes(filas: readonly BitacoraFila[]): string[] {
  const ids = new Set<string>();
  for (const fila of filas) {
    if (fila.tabla === 'planes') ids.add(fila.registro_id);
    for (const valores of [fila.antes, fila.despues]) {
      const plan = valores?.plan_id;
      if (
        fila.tabla === 'suscripciones' &&
        (typeof plan === 'string' || typeof plan === 'number')
      ) {
        ids.add(String(plan));
      }
    }
  }
  return [...ids];
}

/**
 * La bitácora de la plataforma (A10) o de una cuenta (A05d), del cambio más reciente al más viejo.
 * Cruza quién, qué cuenta y qué plan por los contratos de `seguridad` y `suscripciones`.
 */
export async function ejecutar(
  pool: Pool,
  consulta: ConsultaDeBitacora,
  paginacion: Paginacion,
): Promise<Listado<EventoDeBitacora>> {
  const filtro = {
    cuentaId: consulta.cuentaId,
    accion: consulta.accion,
    desde: consulta.desde === undefined ? undefined : inicioDelDia(consulta.desde),
    hasta: consulta.hasta === undefined ? undefined : sumarDias(inicioDelDia(consulta.hasta), 1),
  };
  const repositorio = new RepositorioDeBitacora(pool);
  const { limite, desplazamiento } = limiteDe(paginacion);
  const [filas, total] = await Promise.all([
    repositorio.listar(filtro, limite, desplazamiento),
    repositorio.contarCon(filtro),
  ]);

  const identidades = crearServicioDeIdentidades(pool);
  const [usuarios, cuentas, planes] = await Promise.all([
    identidades.identidadesDeUsuarios([
      ...new Set(filas.flatMap((f) => (f.usuario_id === null ? [] : [f.usuario_id]))),
    ]),
    identidades.cuentas([
      ...new Set(filas.flatMap((f) => (f.tenant_id === null ? [] : [f.tenant_id]))),
    ]),
    crearServicioDeSuscripcionesDePlataforma(pool).nombresDePlanes(idsDePlanes(filas)),
  ]);

  const eventos = filas.map((fila): EventoDeBitacora => {
    const cambio = aCambio(fila);
    const codigo = clasificarCambio(cambio);
    const cuentaId = cuentaDe(fila);
    const cuenta = cuentaId === null ? undefined : cuentas.get(cuentaId);
    return {
      id: fila.id,
      ocurrido_at: fila.ocurrido_at.toISOString(),
      usuario:
        fila.usuario_id === null
          ? null
          : { id: fila.usuario_id, nombre: usuarios.get(fila.usuario_id)?.nombre ?? '—' },
      cuenta: cuenta === undefined ? null : { id: cuenta.id, codigo: cuenta.codigo },
      accion: fila.accion,
      codigo,
      origen: fila.origen,
      canal: canalDe(fila, usuarios.get(fila.usuario_id ?? '')?.deLaPlataforma ?? false),
      ...detalleDelCambio(codigo, cambio, planes),
    };
  });
  return armarListado(eventos, paginacion, total);
}
