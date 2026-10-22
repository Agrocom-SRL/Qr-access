-- migrate:up
-- Deja un único plan anual de 100 usuarios a 1000 Bs (ADR 0022). El seed solo crea los planes que faltan, así que
-- este cambio sobre una base ya sembrada (desarrollo y producción) se hace aquí. Los planes de 200 y 350 usuarios
-- se dan de baja (soft delete, invariante 8) solo si ninguna suscripción los usa: una cuenta que ya los contrató
-- los conserva hasta que el panel la cambie de plan.
UPDATE planes SET precio_anual = 1000 WHERE nombre = '100 usuarios' AND deleted_at IS NULL;

UPDATE planes
   SET activo = 0, deleted_at = CURRENT_TIMESTAMP(3)
 WHERE nombre IN ('200 usuarios', '350 usuarios')
   AND deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM suscripciones s WHERE s.plan_id = planes.id);

-- migrate:down
-- Datos de catálogo: no se restauran los precios ni los planes dados de baja.
SELECT 1;
