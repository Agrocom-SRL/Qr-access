-- migrate:up
-- Valor inicial de `puertas.apertura_manual` para las puertas que la cuenta registre (ADR 0035 §5). La cuenta nace
-- con el modo manual activo; si el administrador lo apaga en todas las puertas, también se apaga este valor y nada
-- lo enciende solo después.
ALTER TABLE cuentas
  ADD COLUMN apertura_manual_por_omision TINYINT(1) NOT NULL DEFAULT 1;

-- migrate:down
ALTER TABLE cuentas
  DROP COLUMN apertura_manual_por_omision;
