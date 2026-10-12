import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import { POR_PAGINA_MAXIMO } from '../../../platform/http/paginacion.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { crearServicioDeOrganizacion } from '../../organizacion/contracts.js';
import { RepositorioDeCuentasDePlataforma } from '../repository.js';

export interface SitioConPuertas {
  id: string;
  nombre: string;
  puertas: {
    id: string;
    nombre: string;
    dispositivo: {
      id: string;
      nombre: string;
      en_linea: boolean;
      ultimo_latido_at: string | null;
    } | null;
  }[];
}

/** Sitios → puertas → lector de una cuenta, solo lectura (A05c): los administra la cuenta desde la app. */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  cuentaId: string,
  ahora: Date = new Date(),
): Promise<SitioConPuertas[]> {
  const cuenta = await new RepositorioDeCuentasDePlataforma(pool).buscarPorId(cuentaId);
  if (cuenta === null) throw new ErrorDeDominio('cuenta.no_encontrada', 404);

  return ContextoCuenta.comoPlataformaEn(cuenta.id, principal.usuarioId, async () => {
    const { datos } = await crearServicioDeOrganizacion(pool).listarPuertasConEstado(
      { pagina: 1, por_pagina: POR_PAGINA_MAXIMO },
      ahora,
    );
    const sitios = new Map<string, SitioConPuertas>();
    for (const puerta of datos) {
      const sitio = sitios.get(puerta.sitio.id) ?? {
        id: puerta.sitio.id,
        nombre: puerta.sitio.nombre,
        puertas: [],
      };
      sitio.puertas.push({ id: puerta.id, nombre: puerta.nombre, dispositivo: puerta.dispositivo });
      sitios.set(puerta.sitio.id, sitio);
    }
    return [...sitios.values()];
  });
}
