import type { ClienteHttp } from '../../../shared/api/clienteHttp';
import type { ResultadoDeAnulacion } from '../domain/anulacion';
import type { AnulacionRepositorio } from './AnulacionRepositorio';

/** Lo que responde `POST /plataforma/cuentas/{id}/qr-accesos/anulacion-masiva` (`respuestaDeAnulacionMasiva`). */
interface AnulacionDto {
  id: string;
  alcance: 'usuario' | 'rama' | 'cuenta';
  usuario_id: string | null;
  usuarios_alcanzados: number;
  qr_anulados: number;
}

export function anulacionDesdeDto(dto: AnulacionDto): ResultadoDeAnulacion {
  return {
    id: dto.id,
    usuariosAlcanzados: dto.usuarios_alcanzados,
    qrAnulados: dto.qr_anulados,
  };
}

export function crearAnulacionHttp(cliente: ClienteHttp): AnulacionRepositorio {
  return {
    async anularCuenta(cuentaId, motivo) {
      const dto = await cliente.solicitar<AnulacionDto>({
        metodo: 'POST',
        ruta: `/plataforma/cuentas/${encodeURIComponent(cuentaId)}/qr-accesos/anulacion-masiva`,
        // Alcance `cuenta`: toda la cuenta, así que no va `usuario_id` (la API lo rechaza con 422).
        cuerpo: { alcance: 'cuenta', motivo },
      });
      return anulacionDesdeDto(dto);
    },
  };
}
