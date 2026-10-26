-- migrate:up
-- Unidad dentro de una propiedad (casa, departamento, pabellón, puesto): ADR 0028 §1. Tiene a lo sumo un
-- Titular vigente; los Miembros cuelgan de él (`usuarios.superior_id`), así que su unidad se deduce por ahí.
-- `titular_id` NULL = la unidad aún no tiene Titular. La unicidad ignora lo borrado (ADR 0016).
CREATE TABLE unidades (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  sitio_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  titular_id BIGINT UNSIGNED NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_unidades_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_unidades_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id),
  CONSTRAINT fk_unidades_titular FOREIGN KEY (titular_id) REFERENCES usuarios (id),
  UNIQUE KEY uq_unidades_nombre (sitio_id, nombre, vigente),
  UNIQUE KEY uq_unidades_titular (titular_id, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- migrate:down
DROP TABLE unidades;
