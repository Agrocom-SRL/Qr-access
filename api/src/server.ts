import { construirApp } from './app.js';
import { cargarConfig } from './config.js';
import { crearPool } from './platform/db/pool.js';

const config = cargarConfig();
const pool = crearPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_DATABASE,
  user: config.DB_USERNAME,
  password: config.DB_PASSWORD,
});
const app = await construirApp({ config, pool });
app.addHook('onClose', async () => {
  await pool.end();
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(senal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.API_HOST, port: config.API_PORT });
