-- migrate:up
-- Árbol de usuarios de la cuenta (ADR 0028 §1): el nivel de arriba de cada usuario. Es distinto de
-- `created_by` (quién lo creó) porque sobrevive a una reasignación hecha por AGROCOM. NULL en el
-- Administrador (la raíz de su rama) y en los usuarios de la plataforma.
ALTER TABLE usuarios
  ADD COLUMN superior_id BIGINT UNSIGNED NULL AFTER tenant_id,
  ADD KEY idx_usuarios_superior (superior_id),
  ADD CONSTRAINT fk_usuarios_superior FOREIGN KEY (superior_id) REFERENCES usuarios (id);

-- migrate:down
ALTER TABLE usuarios
  DROP FOREIGN KEY fk_usuarios_superior,
  DROP KEY idx_usuarios_superior,
  DROP COLUMN superior_id;
