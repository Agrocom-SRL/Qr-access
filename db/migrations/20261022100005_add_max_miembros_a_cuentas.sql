-- migrate:up
-- Tope de Miembros que puede tener cada Titular (ADR 0028 §6), configurable por cuenta. Lo hace cumplir la
-- API al crear un Miembro; es independiente del cupo de usuarios del plan.
ALTER TABLE cuentas
  ADD COLUMN max_miembros_por_titular SMALLINT UNSIGNED NOT NULL DEFAULT 10 AFTER activo,
  ADD CONSTRAINT ck_cuentas_max_miembros CHECK (max_miembros_por_titular >= 1);

-- migrate:down
ALTER TABLE cuentas
  DROP CONSTRAINT ck_cuentas_max_miembros,
  DROP COLUMN max_miembros_por_titular;
