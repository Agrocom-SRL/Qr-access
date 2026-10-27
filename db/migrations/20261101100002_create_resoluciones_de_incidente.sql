-- migrate:up
-- Resolución de un incidente de uso (ADR 0033 §4.2, ola W11): lo que decidió quien administra la rama. El incidente
-- (`incidentes_uso`) no se toca: cada decisión es UNA FILA NUEVA y la vigente es la de mayor `id`. Así queda el historial
-- completo (pendiente -> confirmado -> descartado) y nadie reescribe lo dicho antes. De solo inserción.
-- - `resultado`: `descartado` (falso positivo), `confirmado` o `pendiente`. Confirmar exige `motivo` (lo comprueba la
--   base con `ck_resoluciones_de_incidente_motivo` además de la API). Los demás pueden llevarlo.
-- - `resuelto_por`: quien decidió (siempre una persona: el sistema nunca confirma ni descarta).
-- Perfil `solo_insercion`: sin soft delete ni bitácora; la fila con su autor y su hora es el rastro.
CREATE TABLE resoluciones_de_incidente (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  incidente_id BIGINT UNSIGNED NOT NULL,
  resultado VARCHAR(12) NOT NULL,
  motivo VARCHAR(200) NULL,
  resuelto_por BIGINT UNSIGNED NOT NULL,
  resuelta_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_resoluciones_de_incidente_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_resoluciones_de_incidente_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes_uso (id),
  CONSTRAINT fk_resoluciones_de_incidente_resuelto_por FOREIGN KEY (resuelto_por) REFERENCES usuarios (id),
  CONSTRAINT ck_resoluciones_de_incidente_resultado CHECK (resultado IN ('descartado', 'confirmado', 'pendiente')),
  CONSTRAINT ck_resoluciones_de_incidente_motivo CHECK (
    resultado <> 'confirmado' OR (motivo IS NOT NULL AND CHAR_LENGTH(TRIM(motivo)) > 0)
  ),
  KEY idx_resoluciones_de_incidente_incidente (incidente_id, id),
  KEY idx_resoluciones_de_incidente_tenant (tenant_id, resuelta_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE resoluciones_de_incidente;
