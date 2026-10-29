-- migrate:up
-- Método `manual` y quién lo pidió (ADR 0035 §6). La app no sabe de sentidos: `lecturas` NO guarda entrada ni salida.
-- `usuario_id` es nulo en las lecturas por QR, pulsador o forzada; en `manual` dice quién abrió.
-- Cambiar un CHECK en MariaDB exige ALGORITHM=COPY (reescribe la tabla y bloquea las escrituras). Los datos de local
-- y de producción son de prueba; con datos reales habría que hacerlo con la API detenida un instante (como en W14).
-- El CHECK viejo se llamaba `ck_eventos_acceso_metodo` (la migración del renombrado lo dejó con ese nombre a
-- propósito); el nuevo ya lleva el nombre de la tabla.
ALTER TABLE lecturas
  ADD COLUMN usuario_id BIGINT UNSIGNED NULL AFTER qr_acceso_id,
  DROP CONSTRAINT ck_eventos_acceso_metodo,
  ADD CONSTRAINT ck_lecturas_metodo CHECK (metodo IN ('qr', 'pulsador', 'forzada', 'manual')),
  ADD CONSTRAINT fk_lecturas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  ADD KEY idx_lecturas_manual (tenant_id, metodo, ocurrido_at),
  ALGORITHM=COPY, LOCK=SHARED;

-- migrate:down
-- Vuelve al CHECK anterior. Si ya hay lecturas `manual`, el ALTER FALLA (falla segura: `lecturas` es de solo
-- inserción y no se borra nada para poder revertir).
ALTER TABLE lecturas
  DROP CONSTRAINT ck_lecturas_metodo,
  ADD CONSTRAINT ck_eventos_acceso_metodo CHECK (metodo IN ('qr', 'pulsador', 'forzada')),
  DROP FOREIGN KEY fk_lecturas_usuario,
  DROP KEY idx_lecturas_manual,
  DROP COLUMN usuario_id,
  ALGORITHM=COPY, LOCK=SHARED;
