import { z } from 'zod';

/** Variables de entorno de la API. Si falta una, la API no arranca (ver `.env.example`). */
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
  // Pimienta del índice de PIN (ADR 0018): 32 bytes en base64; nunca en la base
  PIN_PIMIENTA: z.string().min(32),
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
  return resultado.data;
}
