import { construirApp } from './app.js';
import { cargarConfig } from './config.js';
import { crearPools } from './platform/db/pools.js';

const config = cargarConfig();
const pools = crearPools(config);
const app = await construirApp({
  config,
  pool: pools.app,
  poolDispositivos: pools.dispositivos,
});
app.addHook('onClose', async () => {
  await Promise.all([pools.app.end(), pools.dispositivos.end()]);
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(senal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.API_HOST, port: config.API_PORT });
