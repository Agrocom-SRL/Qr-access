-- migrate:up
-- Un usuario, un rol (ADR 0028 §2): desaparece el rol activo y el rol preferido. La sesión sigue guardando
-- `rol_activo_id`, que ahora es siempre el único rol del usuario. Falla si hay usuarios con más de un rol
-- vigente: hay que dejarles uno antes de migrar (producción se reinicia, así que no tiene ninguno).
ALTER TABLE usuario_roles ADD UNIQUE KEY uq_usuario_roles_usuario (usuario_id, vigente);
ALTER TABLE usuarios DROP FOREIGN KEY fk_usuarios_rol_preferido, DROP COLUMN rol_preferido_id;

-- migrate:down
ALTER TABLE usuarios
  ADD COLUMN rol_preferido_id BIGINT UNSIGNED NULL AFTER contrasena_hash,
  ADD CONSTRAINT fk_usuarios_rol_preferido FOREIGN KEY (rol_preferido_id) REFERENCES roles (id);
ALTER TABLE usuario_roles DROP KEY uq_usuario_roles_usuario;
