-- migrate:up
-- Un super admin recién agregado entra con una contraseña temporal y tiene que cambiarla (web admin, A11).
ALTER TABLE usuarios
  ADD COLUMN contrasena_temporal TINYINT(1) NOT NULL DEFAULT 0 AFTER contrasena_hash;

-- migrate:down
ALTER TABLE usuarios DROP COLUMN contrasena_temporal;
