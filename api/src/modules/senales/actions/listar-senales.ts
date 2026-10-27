import type { Pool } from 'mysql2/promise';
import { armarListado, limiteDe, type Paginacion } from '../../../platform/http/paginacion.js';
import {
  crearServicioDeSenalesDePlataforma,
  type FiltroDeSenales,
} from '../../incidentes/contracts.js';
import { crearServicioDeIdentidades } from '../../seguridad/contracts.js';

/**
 * Las señales de abuso (incidentes que abrió el sistema) de todas las cuentas, o de una, para el panel de AGROCOM (ADR
 * 0030 §5). Del más reciente al más antiguo; `estado = abiertas` deja las que nadie resolvió todavía. Solo lectura: el
 * incidente se resuelve desde la cuenta (ADR 0033 §4). Lleva la cuenta y la etiqueta del usuario, ids de evidencia y
 * nunca un token, un hash, un PIN ni una IP.
 */
export async function ejecutar(pool: Pool, filtro: FiltroDeSenales, paginacion: Paginacion) {
  const { limite, desplazamiento } = limiteDe(paginacion);
  const { senales, total } = await crearServicioDeSenalesDePlataforma(pool).listar(
    filtro,
    limite,
    desplazamiento,
  );
  const identidades = crearServicioDeIdentidades(pool);
  const [cuentas, usuarios] = await Promise.all([
    identidades.cuentas([...new Set(senales.map((s) => s.cuentaId))]),
    identidades.identidadesDeUsuarios([...new Set(senales.map((s) => s.usuarioId))]),
  ]);
  const datos = senales.map((senal) => {
    const cuenta = cuentas.get(senal.cuentaId);
    return {
      id: senal.id,
      cuenta: {
        id: senal.cuentaId,
        codigo: cuenta?.codigo ?? '',
        nombre: cuenta?.nombre ?? '',
      },
      usuario: { id: senal.usuarioId, etiqueta: usuarios.get(senal.usuarioId)?.nombre ?? null },
      tipo: senal.tipo,
      gravedad: senal.gravedad,
      descripcion: senal.descripcion,
      evidencia: senal.evidencia,
      estado: senal.estado,
      ocurrido_at: senal.ocurridoAt,
      created_at: senal.creadoAt,
    };
  });
  return armarListado(datos, paginacion, total);
}
