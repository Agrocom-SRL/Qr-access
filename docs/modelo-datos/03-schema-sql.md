# Schema SQL de referencia — MySQL 8.4

**Estado:** Vigente (2026-10-09) para las 16 tablas del núcleo V1. Es el contenido de las migraciones de `db/migrations/` (una por tabla, ADR 0011), en el orden en que corren: si una migración cambia, este archivo cambia en el mismo PR. Convenciones: skill `modelo-datos`; unicidad con soft delete: ADR 0016. Las fichas de cada tabla están en `tablas/`.

Verificado contra `mysql:8.4` en un contenedor descartable (2026-10-09): migrar las 16, revertirlas todas, migrar de nuevo y correr los seeds dos veces, sin errores.

## Cambios respecto de la propuesta anterior

- Salen `personas`, `grupos`, `grupo_personas`, `reglas_acceso`, `reglas_acceso_franjas`, `credenciales_qr`, `qr_usos` e `invitaciones` (quien entra no se registra; el anti-reuso es `qr_accesos.usado_at`, ADR 0008).
- Entran `planes` y `suscripciones` (ADR 0017), `qr_accesos` y `qr_acceso_puertas` (ADR 0008).
- `cuentas.codigo` pasa a `CHAR(3)` solo `A`–`Z` (ADR 0018). `usuarios` pasa a PIN: `etiqueta`, `pin_indice`, `pin_hash`, `pin_generado_at`; `username` y `contrasena_hash` quedan solo para el super admin y `email` sale. Se agrega `usuarios.rol_preferido_id` (último rol elegido, para arrancar la próxima sesión).
- `puertas` pierde `tipo_cerradura` (la cerradura se acciona con un pulso, D-04). `dispositivos` gana `ultima_puerta_abierta` y una columna generada `en_servicio` para que una puerta tenga un solo dispositivo sin revocar.
- `eventos_acceso` guarda `token_hash` (nunca el texto), `qr_acceso_id` y `resultado` en (`permitido`, `rechazado`); `metodo` en (`qr`, `pulsador`, `forzada`).
- `sesiones` gana `rol_activo_id` y `updated_at` (el refresh se rota en sitio).
- Las tablas `cuenta_datos_empresa` y `usuario_perfiles` se agregan con su ficha cuando se implemente la administración de cuentas y usuarios.

## cuentas

Migración: `db/migrations/20261009100001_create_cuentas.sql`

```sql
CREATE TABLE cuentas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo CHAR(3) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  UNIQUE KEY uq_cuentas_codigo (codigo, vigente),
  CONSTRAINT ck_cuentas_codigo CHECK (REGEXP_LIKE(codigo, '^[A-Z]{3}$', 'c'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## roles

Migración: `db/migrations/20261009100002_create_roles.sql`

```sql
CREATE TABLE roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  nombre VARCHAR(80) NOT NULL,
  protegido TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_roles_nombre (tenant_clave, nombre, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## planes

Migración: `db/migrations/20261009100003_create_planes.sql`

```sql
CREATE TABLE planes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  max_dispositivos INT UNSIGNED NULL,
  max_usuarios INT UNSIGNED NULL,
  max_vigencia_qr_horas INT UNSIGNED NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  UNIQUE KEY uq_planes_nombre (nombre, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## suscripciones

Migración: `db/migrations/20261009100004_create_suscripciones.sql`

```sql
CREATE TABLE suscripciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  desde DATETIME(3) NOT NULL,
  hasta DATETIME(3) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'vigente',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  estado_vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL AND estado = 'vigente', 1, NULL)) STORED,
  CONSTRAINT fk_suscripciones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_suscripciones_plan FOREIGN KEY (plan_id) REFERENCES planes (id),
  UNIQUE KEY uq_suscripciones_vigente (tenant_id, estado_vigente),
  CONSTRAINT ck_suscripciones_estado CHECK (estado IN ('vigente', 'suspendida', 'vencida')),
  CONSTRAINT ck_suscripciones_ventana CHECK (desde < hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## usuarios

Migración: `db/migrations/20261009100005_create_usuarios.sql`

```sql
CREATE TABLE usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  etiqueta VARCHAR(80) NULL,
  pin_indice CHAR(64) NULL,
  pin_hash VARCHAR(255) NULL,
  pin_generado_at DATETIME(3) NULL,
  username VARCHAR(60) NULL,
  contrasena_hash VARCHAR(255) NULL,
  rol_preferido_id BIGINT UNSIGNED NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_usuarios_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_usuarios_rol_preferido FOREIGN KEY (rol_preferido_id) REFERENCES roles (id),
  UNIQUE KEY uq_usuarios_pin (tenant_clave, pin_indice, vigente),
  UNIQUE KEY uq_usuarios_username (tenant_clave, username, vigente),
  CONSTRAINT ck_usuarios_credencial CHECK (
    (tenant_id IS NOT NULL AND pin_indice IS NOT NULL AND pin_hash IS NOT NULL)
    OR (tenant_id IS NULL AND username IS NOT NULL AND contrasena_hash IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## permisos

Migración: `db/migrations/20261009100006_create_permisos.sql`

```sql
CREATE TABLE permisos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL,
  ambito VARCHAR(20) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_permisos_codigo (codigo),
  CONSTRAINT ck_permisos_ambito CHECK (ambito IN ('plataforma', 'cuenta'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## rol_permisos

Migración: `db/migrations/20261009100007_create_rol_permisos.sql`

```sql
CREATE TABLE rol_permisos (
  rol_id BIGINT UNSIGNED NOT NULL,
  permiso_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (rol_id, permiso_id),
  CONSTRAINT fk_rol_permisos_rol FOREIGN KEY (rol_id) REFERENCES roles (id),
  CONSTRAINT fk_rol_permisos_permiso FOREIGN KEY (permiso_id) REFERENCES permisos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## usuario_roles

Migración: `db/migrations/20261009100008_create_usuario_roles.sql`

```sql
CREATE TABLE usuario_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  rol_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_usuario_roles_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_usuario_roles_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_usuario_roles_rol FOREIGN KEY (rol_id) REFERENCES roles (id),
  UNIQUE KEY uq_usuario_roles (usuario_id, rol_id, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## sesiones

Migración: `db/migrations/20261009100009_create_sesiones.sql`

```sql
CREATE TABLE sesiones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  rol_activo_id BIGINT UNSIGNED NULL,
  refresh_hash CHAR(64) NOT NULL,
  agente VARCHAR(255) NULL,
  ip VARCHAR(45) NULL,
  expira_at DATETIME(3) NOT NULL,
  revocada_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sesiones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_sesiones_rol_activo FOREIGN KEY (rol_activo_id) REFERENCES roles (id),
  UNIQUE KEY uq_sesiones_refresh (refresh_hash),
  KEY idx_sesiones_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## bitacoras

Migración: `db/migrations/20261009100010_create_bitacoras.sql`

```sql
CREATE TABLE bitacoras (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NULL,
  dispositivo_id BIGINT UNSIGNED NULL,
  tabla VARCHAR(64) NOT NULL,
  registro_id BIGINT UNSIGNED NOT NULL,
  accion VARCHAR(12) NOT NULL,
  origen VARCHAR(12) NOT NULL,
  antes JSON NULL,
  despues JSON NULL,
  ocurrido_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_bitacoras_registro (tabla, registro_id),
  KEY idx_bitacoras_tenant (tenant_id, ocurrido_at),
  CONSTRAINT ck_bitacoras_accion CHECK (accion IN ('creado', 'actualizado', 'eliminado', 'restaurado')),
  CONSTRAINT ck_bitacoras_origen CHECK (origen IN ('api', 'dispositivo', 'sistema'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## sitios

Migración: `db/migrations/20261009100011_create_sitios.sql`

```sql
CREATE TABLE sitios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  direccion VARCHAR(255) NULL,
  zona_horaria VARCHAR(64) NOT NULL DEFAULT 'America/La_Paz',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_sitios_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_sitios_nombre (tenant_clave, nombre, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## puertas

Migración: `db/migrations/20261009100012_create_puertas.sql`

```sql
CREATE TABLE puertas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  sitio_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  segundos_apertura TINYINT UNSIGNED NOT NULL DEFAULT 5,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_puertas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_puertas_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id),
  UNIQUE KEY uq_puertas_nombre (sitio_id, nombre, vigente),
  CONSTRAINT ck_puertas_segundos CHECK (segundos_apertura BETWEEN 1 AND 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## dispositivos

Migración: `db/migrations/20261009100013_create_dispositivos.sql`

```sql
CREATE TABLE dispositivos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  clave_hash VARCHAR(255) NOT NULL,
  firmware_version VARCHAR(20) NULL,
  ultimo_latido_at DATETIME(3) NULL,
  ultimo_rssi SMALLINT NULL,
  ultima_puerta_abierta TINYINT(1) NULL,
  revocado_at DATETIME(3) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  en_servicio TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL AND revocado_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_dispositivos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_dispositivos_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  UNIQUE KEY uq_dispositivos_puerta (puerta_id, en_servicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## qr_accesos

Migración: `db/migrations/20261009100014_create_qr_accesos.sql`

```sql
CREATE TABLE qr_accesos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  emitido_por BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  etiqueta VARCHAR(60) NULL,
  vence_at DATETIME(3) NOT NULL,
  usado_at DATETIME(3) NULL,
  usado_dispositivo_id BIGINT UNSIGNED NULL,
  anulado_at DATETIME(3) NULL,
  anulado_por BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_qr_accesos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_qr_accesos_emisor FOREIGN KEY (emitido_por) REFERENCES usuarios (id),
  CONSTRAINT fk_qr_accesos_dispositivo FOREIGN KEY (usado_dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_qr_accesos_anulador FOREIGN KEY (anulado_por) REFERENCES usuarios (id),
  UNIQUE KEY uq_qr_accesos_token (token_hash),
  KEY idx_qr_accesos_emisor (tenant_id, emitido_por, created_at),
  KEY idx_qr_accesos_vencimiento (tenant_id, vence_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## qr_acceso_puertas

Migración: `db/migrations/20261009100015_create_qr_acceso_puertas.sql`

```sql
CREATE TABLE qr_acceso_puertas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  qr_acceso_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_qr_acceso_puertas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_qr_acceso_puertas_qr FOREIGN KEY (qr_acceso_id) REFERENCES qr_accesos (id),
  CONSTRAINT fk_qr_acceso_puertas_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  UNIQUE KEY uq_qr_acceso_puertas (qr_acceso_id, puerta_id, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## eventos_acceso

Migración: `db/migrations/20261009100016_create_eventos_acceso.sql`

```sql
CREATE TABLE eventos_acceso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  dispositivo_id BIGINT UNSIGNED NULL,
  qr_acceso_id BIGINT UNSIGNED NULL,
  token_hash CHAR(64) NULL,
  metodo VARCHAR(20) NOT NULL DEFAULT 'qr',
  resultado VARCHAR(10) NOT NULL,
  motivo_code VARCHAR(60) NOT NULL,
  ocurrido_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  leido_en_dispositivo_at DATETIME(3) NULL,
  KEY idx_eventos_acceso_puerta (tenant_id, puerta_id, ocurrido_at),
  KEY idx_eventos_acceso_fecha (tenant_id, ocurrido_at),
  KEY idx_eventos_acceso_qr (qr_acceso_id),
  CONSTRAINT fk_eventos_acceso_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_eventos_acceso_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  CONSTRAINT fk_eventos_acceso_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_eventos_acceso_qr FOREIGN KEY (qr_acceso_id) REFERENCES qr_accesos (id),
  CONSTRAINT ck_eventos_acceso_metodo CHECK (metodo IN ('qr', 'pulsador', 'forzada')),
  CONSTRAINT ck_eventos_acceso_resultado CHECK (resultado IN ('permitido', 'rechazado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```
