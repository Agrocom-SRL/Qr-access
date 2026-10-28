import { construirApp } from './app.js';
import { cargarConfig } from './config.js';
import { crearPools } from './platform/db/pools.js';
import { crearTareas, programarTareas } from './tareas.js';

const config = cargarConfig();
const pools = crearPools(config);
const app = await construirApp({
  config,
  pool: pools.app,
  poolDispositivos: pools.dispositivos,
});
// Tareas periódicas (estado de placas, entrega y retención de notificaciones). No corren en los tests: estos
// llaman a cada función con un reloj inyectado.
const tareas = programarTareas(crearTareas(pools.app), (nombre, error) => {
  // Solo el nombre de la tarea y el tipo de error: nada del contenido de una consulta (ADR 0033).
  app.log.error(
    { tarea: nombre, error: error instanceof Error ? error.name : 'desconocido' },
    'falló una tarea periódica',
  );
});
app.addHook('onClose', async () => {
  tareas.detener();
  await Promise.all([pools.app.end(), pools.dispositivos.end()]);
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(senal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.API_HOST, port: config.API_PORT });
