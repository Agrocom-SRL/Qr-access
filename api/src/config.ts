import { isIP } from 'node:net';
import { z } from 'zod';

/** Variables de entorno de la API. Si falta una, la API no arranca (ver `.env.example`). */
/** Cuánto espera el firmware una respuesta (ADR 0009, `cliente.cpp`): la API contesta antes. */
export const ESPERA_DEL_FIRMWARE_MS = 3000;

const entero = (porDefecto: number, minimo = 1) =>
  z.coerce.number().int().min(minimo).default(porDefecto);

/** Saltos de proxy que se aceptan como máximo: más de un puñado es una configuración errónea. */
const MAXIMO_DE_SALTOS = 5;
const ALIAS_DE_REDES = new Set(['loopback', 'linklocal', 'uniquelocal']);

/** ¿Es una IP o un CIDR válido (o un alias de `proxy-addr`)? */
function esRedDeConfianza(valor: string): boolean {
  if (ALIAS_DE_REDES.has(valor)) return true;
  const [direccion = '', prefijo, ...resto] = valor.split('/');
  const version = isIP(direccion);
  if (version === 0 || resto.length > 0) return false;
  if (prefijo === undefined) return true;
  const maximo = version === 4 ? 32 : 128;
  return /^\d{1,3}$/.test(prefijo) && Number(prefijo) <= maximo;
}

/**
 * `TRUST_PROXY` (ADR 0030 §3.2, ADR 0033): cuántos proxies de confianza hay delante de la API
 * (un número de saltos) o desde qué redes se acepta `X-Forwarded-For` (lista de IP/CIDR).
 * Nunca un booleano a secas: `true` confía en TODO `X-Forwarded-For`, y quien lo falsea elige
 * su IP y con ella evade o agota el rate limit. Por omisión, 1 salto (el Nginx de la app).
 * `0` o `false` ignoran la cabecera (API expuesta directamente).
 */
const confianzaEnProxy = z
  .string()
  .trim()
  .default('1')
  .transform((valor, contexto): number | false | string[] => {
    if (valor === 'false' || valor === '0') return false;
    if (/^\d+$/.test(valor)) {
      const saltos = Number(valor);
      if (saltos <= MAXIMO_DE_SALTOS) return saltos;
    } else {
      const redes = valor.split(',').map((red) => red.trim());
      if (redes.length > 0 && redes.every(esRedDeConfianza)) return redes;
    }
    contexto.addIssue({ code: 'custom', message: 'TRUST_PROXY inválido' });
    return z.NEVER;
  });

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
  // Saltos de proxy de confianza o lista de IP/CIDR (nunca `true`): de dónde sale la IP del cliente
  TRUST_PROXY: confianzaEnProxy,
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
  // Mínimo 2: una transacción de validación retiene una conexión mientras otra petición autentica.
  DB_POOL_DISPOSITIVOS: entero(4, 2),
  DB_POOL_APP: entero(6, 2),
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
  // Mínimo 500 ms: por debajo no cabe ni la espera por una conexión más una consulta.
  PETICION_MS_DISPOSITIVOS: entero(2500, 500),
  PETICION_MS_APP: entero(15000, 500),
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
  // Mínimo 60: un lector que relee su QR una vez por segundo no debe toparse nunca con el límite.
  LIMITE_VALIDACION_POR_MINUTO: entero(600, 60),
  LIMITE_DISPOSITIVO_POR_MINUTO: entero(120),
  // Autenticaciones fallidas por IP y por minuto (ADR 0030 §3.2): pasado el tope, esa IP recibe
  // 429 sin que se verifique su credencial. Solo cuentan los fallos; un acierto no consume.
  LIMITE_FALLOS_AUTENTICACION_POR_MINUTO: entero(30, 5),

  // Sesiones abiertas a la vez (ADR 0030 §4.1). Iniciar sesión nunca se bloquea: pasado el tope se cierra la
  // más antigua. Por usuario (teléfono, tablet, navegador…) y por instalación (varios usuarios en un aparato).
  // Valores de partida: se afinan con datos reales.
  SESIONES_MAX_POR_USUARIO: entero(10),
  SESIONES_MAX_POR_INSTALACION: entero(5),
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
 * Espera + consulta < petición < espera del firmware (ADR 0032 §1.3): la API siempre contesta
 * antes de que la placa se rinda. Una transacción tarda, en el peor caso de UN intento, lo que
 * espera por su conexión más lo que tarda su consulta más lenta: ese presupuesto cabe dentro de
 * la petición, en las rutas del dispositivo y en las de la app. Una configuración que lo rompe
 * deja a la puerta sin respuesta útil, así que no arranca.
 */
function exigirTiemposCoherentes(config: Config): void {
  const incoherentes: string[] = [];
  if (config.DB_CONSULTA_MS_DISPOSITIVOS >= config.PETICION_MS_DISPOSITIVOS) {
    incoherentes.push('DB_CONSULTA_MS_DISPOSITIVOS');
  }
  if (config.DB_ESPERA_MS_DISPOSITIVOS >= config.PETICION_MS_DISPOSITIVOS) {
    incoherentes.push('DB_ESPERA_MS_DISPOSITIVOS');
  }
  if (
    config.DB_ESPERA_MS_DISPOSITIVOS + config.DB_CONSULTA_MS_DISPOSITIVOS >=
    config.PETICION_MS_DISPOSITIVOS
  ) {
    incoherentes.push('DB_ESPERA_MS_DISPOSITIVOS+DB_CONSULTA_MS_DISPOSITIVOS');
  }
  if (config.PETICION_MS_DISPOSITIVOS >= ESPERA_DEL_FIRMWARE_MS) {
    incoherentes.push('PETICION_MS_DISPOSITIVOS');
  }
  if (config.DB_CONSULTA_MS_APP >= config.PETICION_MS_APP) incoherentes.push('DB_CONSULTA_MS_APP');
  if (config.DB_ESPERA_MS_APP >= config.PETICION_MS_APP) incoherentes.push('DB_ESPERA_MS_APP');
  if (config.DB_ESPERA_MS_APP + config.DB_CONSULTA_MS_APP >= config.PETICION_MS_APP) {
    incoherentes.push('DB_ESPERA_MS_APP+DB_CONSULTA_MS_APP');
  }
  if (incoherentes.length > 0) throw new ConfiguracionInvalida(incoherentes);
}
