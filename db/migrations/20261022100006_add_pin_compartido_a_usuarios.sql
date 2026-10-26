-- migrate:up
-- Cuándo se compartió por última vez el PIN de un usuario por un canal de terceros (la hoja de compartir
-- del sistema), ADR 0028 §7. El PIN en sí nunca se guarda; esta fecha existe para que cada envío quede en
-- la bitácora (la base la escribe como un cambio más de `usuarios`: quién, cuándo, antes y después).
ALTER TABLE usuarios ADD COLUMN pin_compartido_at DATETIME(3) NULL AFTER pin_generado_at;

-- migrate:down
ALTER TABLE usuarios DROP COLUMN pin_compartido_at;
