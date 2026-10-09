import { crearServicioDeCuentas } from '../seguridad/contracts.js';
import type { DependenciasDeModulo } from '../../platform/http/dependencias.js';
import { verificarContraRelleno, verificarHash } from '../../platform/seguridad/hash.js';
import type { PrincipalDispositivo } from '../../platform/seguridad/principal.js';
import { RepositorioDeDispositivosDePlataforma } from './repository.js';

/**
 * Verifica `Dispositivo <id>.<clave>` (invariante 5): la clave se compara con su hash argon2id
 * y el dispositivo tiene que estar en servicio (no revocado ni dado de baja) y su cuenta activa.
 * Cualquier fallo es `null` y tarda lo mismo, exista o no el dispositivo.
 */
export function crearAutenticadorDeDispositivo({ pool }: DependenciasDeModulo) {
  const dispositivos = new RepositorioDeDispositivosDePlataforma(pool);
  const cuentas = crearServicioDeCuentas(pool);

  return async function autenticarDispositivo(
    id: string,
    clave: string,
  ): Promise<PrincipalDispositivo | null> {
    const fila = await dispositivos.buscarEnServicio(id);
    if (fila === null) {
      await verificarContraRelleno(clave);
      return null;
    }
    if (!(await verificarHash(fila.clave_hash, clave))) return null;
    if (!(await cuentas.estaActiva(fila.tenant_id))) return null;
    return {
      tipo: 'dispositivo',
      dispositivoId: fila.id,
      cuentaId: fila.tenant_id,
      puertaId: fila.puerta_id,
    };
  };
}
