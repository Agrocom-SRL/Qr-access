import type { Pool } from 'mysql2/promise';
import { ContextoCuenta } from '../../../platform/contexto/contexto-cuenta.js';
import { enTransaccion } from '../../../platform/db/transaccion.js';
import { ErrorDeDominio } from '../../../platform/errores/error-de-dominio.js';
import type { PrincipalPlataforma } from '../../../platform/seguridad/principal.js';
import { RepositorioDeDispositivos, RepositorioDeDispositivosDePlataforma } from '../repository.js';

export interface ConfiguracionDeSensor {
  /** ¿El contacto magnético de la puerta está conectado y verificado? */
  readonly instalado: boolean;
  /** Nivel del pin cuando la puerta está ABIERTA (la polaridad depende de cómo se cableó el contacto). */
  readonly nivelAbierto: 'alto' | 'bajo';
}

/**
 * AGROCOM habilita (o no) el sensor de puerta de una placa y fija su polaridad (ADR 0031 §18). Solo con el sensor
 * habilitado la placa informa si la puerta se abrió; sin él informa `sin_sensor` y no se inventa ni un éxito ni
 * una falla. Se hace después de verificar en campo cómo lee el contacto la puerta cerrada y abierta. La placa
 * recibe el cambio en su próxima lectura de `GET /dispositivos/configuracion`. Al habilitarlo se guarda
 * `sensor_habilitado_at`: el detector solo juzga aperturas posteriores. Queda en la bitácora de la cuenta.
 */
export async function ejecutar(
  pool: Pool,
  principal: PrincipalPlataforma,
  placaId: string,
  sensor: ConfiguracionDeSensor,
  ahora: Date = new Date(),
): Promise<void> {
  const dispositivo = await new RepositorioDeDispositivosDePlataforma(pool).buscarEnServicioDePlaca(
    placaId,
  );
  if (dispositivo === null) throw new ErrorDeDominio('placa.sin_dispositivo', 409);

  await ContextoCuenta.comoPlataformaEn(dispositivo.cuentaId, principal.usuarioId, () =>
    enTransaccion(pool, async (tx) => {
      const guardado = await new RepositorioDeDispositivos(pool).configurarSensor(
        tx,
        dispositivo.id,
        sensor,
        ahora,
      );
      if (!guardado) throw new ErrorDeDominio('placa.sin_dispositivo', 409);
    }),
  );
}
