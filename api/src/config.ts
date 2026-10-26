import { z } from 'zod';

/** Variables de entorno de la API. Si falta una, la API no arranca (ver `.env.example`). */
/** Cuánto espera el firmware una respuesta (ADR 0009, `cliente.cpp`): la API contesta antes. */
export const ESPERA_DEL_FIRMWARE_MS = 3000;

const entero = (porDefecto: number) => z.coerce.number().int().positive().default(porDefecto);

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_DATABASE: z.string().min(1),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string(),
  // true solo detrás de un proxy de confianza (Nginx): habilita X-Forwarded-For para la IP del cliente
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
  // JWT de acceso (ADR 0004 §4): firma HS256 y duración corta
  JWT_SECRETO: z.string().min(32),
  JWT_ACCESO_MINUTOS: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_DIAS: z.coerce.number().int().positive().default(30),
  // Carpeta del almacén de archivos (comprobantes de pago, ADR 0024): en docker es un volumen
  ARCHIVOS_RUTA: z.string().min(1).default('./archivos'),
  // Pimienta del índice de PIN (ADR 0018): 32 bytes en base64; nunca en la base
  PIN_PIMIENTA: z.string().min(32),

  // Dos pools de MariaDB (ADR 0032 §1): uno reservado a las rutas del dispositivo y otro para la
  // app y el panel, de modo que una avalancha de listados no deje a una puerta esperando. Los
  // tamaños son de partida y se ajustan con las pruebas de carga.
  DB_POOL_DISPOSITIVOS: entero(4),
  DB_POOL_APP: entero(6),
  // Cola de espera acotada (`queueLimit`): llena, la API falla rápido con 503 en vez de acumular.
  DB_COLA_DISPOSITIVOS: entero(20),
  DB_COLA_APP: entero(50),
  // Tiempo máximo para obtener una conexión del pool.
  DB_ESPERA_MS_DISPOSITIVOS: entero(500),
  DB_ESPERA_MS_APP: entero(3000),
  // Tiempo máximo de una consulta (`max_statement_time` de MariaDB).
  DB_CONSULTA_MS_DISPOSITIVOS: entero(1500),
  DB_CONSULTA_MS_APP: entero(5000),
  // Tiempo máximo de una petición completa (ADR 0032 §1.3).
  PETICION_MS_DISPOSITIVOS: entero(2500),
  PETICION_MS_APP: entero(15000),
  // `Retry-After` de los 503 por saturación.
  REINTENTO_503_SEGUNDOS: entero(2),

  // Rate limit por minuto (ADR 0030 §3.2). Login y anuncio de placas, estrictos; generar QR,
  // moderado; lecturas, holgado; validación de dispositivo, por credencial y muy holgado.
  LIMITE_LOGIN_POR_MINUTO: entero(20),
  LIMITE_REFRESCO_POR_MINUTO: entero(60),
  LIMITE_ANUNCIO_POR_MINUTO: entero(20),
  LIMITE_GENERAR_QR_POR_MINUTO: entero(10),
  LIMITE_ESCRITURA_POR_MINUTO: entero(60),
  LIMITE_LECTURA_POR_MINUTO: entero(240),
  LIMITE_VALIDACION_POR_MINUTO: entero(600),
  LIMITE_DISPOSITIVO_POR_MINUTO: entero(120),
});

export type Config = z.infer<typeof esquema>;

export class ConfiguracionInvalida extends Error {
  constructor(readonly variables: readonly string[]) {
    // Solo los nombres: el valor de una variable puede ser un secreto (invariante 6).
    super(`Configuración inválida: ${variables.join(', ')}`);
    this.name = 'ConfiguracionInvalida';
  }
}

export function cargarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const resultado = esquema.safeParse(env);
  if (!resultado.success) {
    throw new ConfiguracionInvalida(resultado.error.issues.map((issue) => issue.path.join('.')));
  }
  exigirTiemposCoherentes(resultado.data);
  return resultado.data;
}

/**
 * Consulta máxima < petición < espera del firmware (ADR 0032 §1.3): la API siempre contesta
 * antes de que la placa se rinda, y la espera por una conexión cabe dentro de la petición.
 * Una configuración que lo rompe deja a la puerta sin respuesta útil, así que no arranca.
 */
function exigirTiemposCoherentes(config: Config): void {
  const incoherentes: string[] = [];
  if (config.DB_CONSULTA_MS_DISPOSITIVOS >= config.PETICION_MS_DISPOSITIVOS) {
    incoherentes.push('DB_CONSULTA_MS_DISPOSITIVOS');
  }
  if (config.DB_ESPERA_MS_DISPOSITIVOS >= config.PETICION_MS_DISPOSITIVOS) {
    incoherentes.push('DB_ESPERA_MS_DISPOSITIVOS');
  }
  if (config.PETICION_MS_DISPOSITIVOS >= ESPERA_DEL_FIRMWARE_MS) {
    incoherentes.push('PETICION_MS_DISPOSITIVOS');
  }
  if (incoherentes.length > 0) throw new ConfiguracionInvalida(incoherentes);
}
