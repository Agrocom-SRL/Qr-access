-- migrate:up
-- El super admin tiene un rol de plataforma (`roles.tenant_id NULL`): su asignación también va sin cuenta.
ALTER TABLE usuario_roles MODIFY tenant_id BIGINT UNSIGNED NULL;

-- migrate:down
-- Falla si hay asignaciones de plataforma: hay que quitarlas antes de revertir.
ALTER TABLE usuario_roles MODIFY tenant_id BIGINT UNSIGNED NOT NULL;
