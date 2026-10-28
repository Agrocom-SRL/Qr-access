-- migrate:up
-- Exportaciones de datos de la cuenta (ADR 0033 §3, ola W11): una fila por PÁGINA descargada (usuarios, puertas o
-- lecturas, en CSV). Existe para que cada descarga quede en la bitácora (quién, cuándo, qué recurso, cuántas filas y con
-- qué filtros): el repositorio de dominio escribe la bitácora en la misma transacción. Nunca guarda el contenido
-- exportado, solo la constancia.
-- - `recurso`: `usuarios`, `puertas` o `lecturas`.
-- - `pagina`/`por_pagina`/`filas`: lo pedido y lo entregado. `filtros`: JSON con los filtros de las lecturas (sin datos
--   personales; ids y fechas).
CREATE TABLE exportaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  recurso VARCHAR(10) NOT NULL,
  pagina INT UNSIGNED NOT NULL,
  por_pagina INT UNSIGNED NOT NULL,
  filas INT UNSIGNED NOT NULL,
  filtros JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_exportaciones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT ck_exportaciones_recurso CHECK (recurso IN ('usuarios', 'puertas', 'lecturas')),
  KEY idx_exportaciones_tenant (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE exportaciones;
