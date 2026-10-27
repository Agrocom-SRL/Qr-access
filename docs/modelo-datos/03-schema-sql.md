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
- `cuenta_datos_empresa` se agregó con la administración de cuentas del web admin (ficha 17). `usuario_perfiles` se agrega con su ficha cuando se necesite.

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  precio_anual DECIMAL(14,2) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  UNIQUE KEY uq_planes_nombre (nombre, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  contrasena_temporal TINYINT(1) NOT NULL DEFAULT 0,
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
  UNIQUE KEY uq_usuarios_pin (tenant_clave, pin_indice, vigente),
  UNIQUE KEY uq_usuarios_username (tenant_clave, username, vigente),
  CONSTRAINT ck_usuarios_credencial CHECK (
    (tenant_id IS NOT NULL AND pin_indice IS NOT NULL AND pin_hash IS NOT NULL)
    OR (tenant_id IS NULL AND username IS NOT NULL AND contrasena_hash IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## usuario_roles

Migración: `db/migrations/20261009100008_create_usuario_roles.sql`

```sql
CREATE TABLE usuario_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## placas

Migraciones: `db/migrations/20261013100001_create_placas.sql` y `20261014100001_placas_por_anuncio.sql` (ADR 0026). De la plataforma: sin `tenant_id`.

```sql
CREATE TABLE placas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  mac CHAR(17) NOT NULL,
  firmware_version VARCHAR(20) NULL,
  ultimo_anuncio_at DATETIME(3) NULL,
  ultima_ip VARCHAR(45) NULL,
  por_confirmar_hasta DATETIME(3) NULL,
  vinculo_cuenta_id BIGINT UNSIGNED NULL,
  vinculo_puerta_id BIGINT UNSIGNED NULL,
  vinculo_nombre VARCHAR(100) NULL,
  vinculo_solicitado_por BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  UNIQUE KEY uq_placas_mac (mac, vigente),
  CONSTRAINT ck_placas_mac CHECK (mac REGEXP '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## placas_anuncios

Migración: `db/migrations/20261014100001_placas_por_anuncio.sql` (ADR 0026). De la plataforma; transitoria.

```sql
CREATE TABLE placas_anuncios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  placa_id BIGINT UNSIGNED NOT NULL,
  clave_huella CHAR(64) NOT NULL,
  firmware_version VARCHAR(20) NULL,
  ip VARCHAR(45) NULL,
  ultimo_anuncio_at DATETIME(3) NOT NULL,
  descartada_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_placas_anuncios_placa FOREIGN KEY (placa_id) REFERENCES placas (id),
  UNIQUE KEY uq_placas_anuncios_clave (placa_id, clave_huella)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## dispositivos

Migraciones: `db/migrations/20261009100013_create_dispositivos.sql` y `20261013100002_add_placa_id_a_dispositivos.sql` (`placa_id`, `fk_dispositivos_placa` y `uq_dispositivos_placa`, ya incluidos abajo)

```sql
CREATE TABLE dispositivos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  placa_id BIGINT UNSIGNED NULL,
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
  CONSTRAINT fk_dispositivos_placa FOREIGN KEY (placa_id) REFERENCES placas (id),
  UNIQUE KEY uq_dispositivos_puerta (puerta_id, en_servicio),
  UNIQUE KEY uq_dispositivos_placa (placa_id, en_servicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## qr_accesos

Migraciones: `db/migrations/20261009100014_create_qr_accesos.sql` y `20261012100006_add_es_propio_a_qr_accesos.sql` (`es_propio` y `propio_activo`, ya incluidos abajo)

```sql
CREATE TABLE qr_accesos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  generado_por BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  etiqueta VARCHAR(60) NULL,
  es_propio TINYINT(1) NOT NULL DEFAULT 0,
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
  propio_activo TINYINT GENERATED ALWAYS AS (IF(es_propio = 1 AND anulado_at IS NULL AND usado_at IS NULL AND deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_qr_accesos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_qr_accesos_generador FOREIGN KEY (generado_por) REFERENCES usuarios (id),
  CONSTRAINT fk_qr_accesos_dispositivo FOREIGN KEY (usado_dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_qr_accesos_anulador FOREIGN KEY (anulado_por) REFERENCES usuarios (id),
  UNIQUE KEY uq_qr_accesos_token (token_hash),
  UNIQUE KEY uq_qr_accesos_propio_activo (generado_por, propio_activo),
  KEY idx_qr_accesos_generador (tenant_id, generado_por, created_at),
  KEY idx_qr_accesos_vencimiento (tenant_id, vence_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## cuenta_datos_empresa

Migraciones: `db/migrations/20261012100004_create_cuenta_datos_empresa.sql` y `db/migrations/20261021100001_ajusta_cuenta_datos_empresa.sql` (NIT y teléfono opcionales, apellido del contacto). Se muestra el esquema resultante.

```sql
CREATE TABLE cuenta_datos_empresa (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  nit VARCHAR(20) NULL,
  ciudad VARCHAR(80) NOT NULL,
  contacto_nombre VARCHAR(120) NOT NULL,
  contacto_apellido VARCHAR(120) NOT NULL DEFAULT '',
  contacto_telefono VARCHAR(30) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_cuenta_datos_empresa_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_cuenta_datos_empresa_cuenta (tenant_clave, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## pagos

Migración: `db/migrations/20261012100005_create_pagos.sql`

```sql
CREATE TABLE pagos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  suscripcion_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  fecha_pago DATE NOT NULL,
  medio VARCHAR(20) NOT NULL,
  referencia VARCHAR(80) NOT NULL,
  periodo_desde DATETIME(3) NOT NULL,
  periodo_hasta DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_pagos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_pagos_suscripcion FOREIGN KEY (suscripcion_id) REFERENCES suscripciones (id),
  CONSTRAINT fk_pagos_plan FOREIGN KEY (plan_id) REFERENCES planes (id),
  KEY idx_pagos_tenant_fecha (tenant_id, fecha_pago),
  KEY idx_pagos_fecha (fecha_pago),
  CONSTRAINT ck_pagos_tipo CHECK (tipo IN ('renovacion', 'mejora_de_plan')),
  CONSTRAINT ck_pagos_medio CHECK (medio IN ('transferencia', 'qr', 'efectivo')),
  CONSTRAINT ck_pagos_monto CHECK (monto > 0),
  CONSTRAINT ck_pagos_periodo CHECK (periodo_desde < periodo_hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## comprobantes

Migración: `db/migrations/20261012100008_create_comprobantes.sql`

```sql
CREATE TABLE comprobantes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ruta VARCHAR(255) NOT NULL,
  tipo_mime VARCHAR(40) NOT NULL,
  tamano INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_comprobantes_ruta (ruta),
  CONSTRAINT ck_comprobantes_tipo CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## pagos: banco, cuenta de destino y comprobante

Migración: `db/migrations/20261012100009_add_banco_y_comprobante_a_pagos.sql`

```sql
ALTER TABLE pagos
  ADD COLUMN banco VARCHAR(60) NULL AFTER referencia,
  ADD COLUMN cuenta_destino VARCHAR(60) NULL AFTER banco,
  ADD COLUMN comprobante_id BIGINT UNSIGNED NULL AFTER cuenta_destino,
  ADD CONSTRAINT fk_pagos_comprobante FOREIGN KEY (comprobante_id) REFERENCES comprobantes (id);
```

## unidades

Migración: `db/migrations/20261022100001_create_unidades.sql`

```sql
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
```

## usuarios: superior en el árbol

Migración: `db/migrations/20261022100002_alter_usuarios_superior.sql`

```sql
ALTER TABLE usuarios
  ADD COLUMN superior_id BIGINT UNSIGNED NULL AFTER tenant_id,
  ADD KEY idx_usuarios_superior (superior_id),
  ADD CONSTRAINT fk_usuarios_superior FOREIGN KEY (superior_id) REFERENCES usuarios (id);
```

## usuarios y usuario_roles: un rol por usuario

Migración: `db/migrations/20261022100003_un_rol_por_usuario.sql`

```sql
-- Antes (solo si ya hay datos): da de baja los roles de más y deja el de mayor nivel por usuario.
ALTER TABLE usuario_roles ADD UNIQUE KEY uq_usuario_roles_usuario (usuario_id, vigente);
ALTER TABLE usuarios DROP FOREIGN KEY fk_usuarios_rol_preferido, DROP COLUMN rol_preferido_id;
```

Migración de datos: `db/migrations/20261022100004_vincula_usuarios_existentes.sql` cuelga a los usuarios de cuenta que aún no tienen superior del primer Administrador de su cuenta.

## cuentas: tope de Miembros por Titular

Migración: `db/migrations/20261022100005_add_max_miembros_a_cuentas.sql`

```sql
ALTER TABLE cuentas
  ADD COLUMN max_miembros_por_titular SMALLINT UNSIGNED NOT NULL DEFAULT 10 AFTER activo,
  ADD CONSTRAINT ck_cuentas_max_miembros CHECK (max_miembros_por_titular >= 1);
```

## usuarios: PIN compartido

Migración: `db/migrations/20261022100006_add_pin_compartido_a_usuarios.sql`

```sql
ALTER TABLE usuarios ADD COLUMN pin_compartido_at DATETIME(3) NULL AFTER pin_generado_at;
```

## qr_accesos: `generado_por`

Migración: `db/migrations/20261022100007_renombra_emitir_a_generar.sql`. Un QR se genera, no se emite: `emitido_por` pasa a `generado_por` (con su índice `idx_qr_accesos_generador` y su clave foránea `fk_qr_accesos_generador`) y el permiso `accesos.qr.emitir` pasa a `accesos.qr.generar`. El `CREATE TABLE` de arriba muestra la tabla ya con el nombre nuevo; la migración original conserva el nombre con el que se creó.

```sql
ALTER TABLE qr_accesos DROP FOREIGN KEY fk_qr_accesos_emisor;
ALTER TABLE qr_accesos RENAME COLUMN emitido_por TO generado_por;
ALTER TABLE qr_accesos RENAME INDEX idx_qr_accesos_emisor TO idx_qr_accesos_generador;
ALTER TABLE qr_accesos ADD CONSTRAINT fk_qr_accesos_generador FOREIGN KEY (generado_por) REFERENCES usuarios (id);
UPDATE permisos SET codigo = 'accesos.qr.generar' WHERE codigo = 'accesos.qr.emitir';
```


## cuentas_de_cobro

Migración: `db/migrations/20261022100010_create_cuentas_de_cobro.sql`. Dónde recibe AGROCOM los pagos (ADR 0029); es de plataforma, sin `tenant_id`.

```sql
CREATE TABLE cuentas_de_cobro (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  metodo VARCHAR(20) NOT NULL,
  banco VARCHAR(60) NOT NULL,
  titular VARCHAR(120) NULL,
  numero_cuenta VARCHAR(40) NULL,
  tipo_cuenta VARCHAR(20) NULL,
  imagen_id BIGINT UNSIGNED NULL,
  nota VARCHAR(200) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_cuentas_de_cobro_imagen FOREIGN KEY (imagen_id) REFERENCES comprobantes (id),
  UNIQUE KEY uq_cuentas_de_cobro_numero (banco, numero_cuenta, vigente),
  CONSTRAINT ck_cuentas_de_cobro_metodo CHECK (metodo IN ('transferencia', 'qr')),
  CONSTRAINT ck_cuentas_de_cobro_tipo CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('ahorro', 'corriente')),
  CONSTRAINT ck_cuentas_de_cobro_transferencia CHECK (metodo <> 'transferencia' OR (titular IS NOT NULL AND numero_cuenta IS NOT NULL)),
  CONSTRAINT ck_cuentas_de_cobro_qr CHECK (metodo <> 'qr' OR imagen_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## cuentas: estado

Migración: `db/migrations/20261026100001_alter_cuentas_estado.sql` (ADR 0033 §1). `estado` reemplaza a `activo`: `activo = 0` pasa a `suspendido`. El `CREATE TABLE` de arriba muestra la tabla original; este es el cambio.

```sql
ALTER TABLE cuentas
  ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'activo' AFTER activo,
  ADD COLUMN estado_impuesto_por BIGINT UNSIGNED NULL AFTER estado,
  ADD COLUMN estado_desde DATETIME(3) NULL AFTER estado_impuesto_por,
  ADD COLUMN estado_motivo VARCHAR(200) NULL AFTER estado_desde;
-- UPDATE: activo = 0 -> 'suspendido' (estado_impuesto_por = updated_by, estado_desde = updated_at)
ALTER TABLE cuentas
  ADD CONSTRAINT fk_cuentas_estado_impuesto_por FOREIGN KEY (estado_impuesto_por) REFERENCES usuarios (id),
  ADD KEY idx_cuentas_estado (estado),
  ADD CONSTRAINT ck_cuentas_estado CHECK (estado IN ('activo', 'restringido', 'suspendido')),
  ADD CONSTRAINT ck_cuentas_estado_datos CHECK (
    (estado = 'activo' AND estado_impuesto_por IS NULL AND estado_desde IS NULL AND estado_motivo IS NULL)
    OR (estado <> 'activo' AND estado_desde IS NOT NULL
         AND estado_motivo IS NOT NULL AND CHAR_LENGTH(TRIM(estado_motivo)) > 0)
  ),
  DROP COLUMN activo;
```

## usuarios: estado

Migración: `db/migrations/20261026100002_alter_usuarios_estado.sql` (ADR 0033 §1). Igual que en `cuentas`; la cascada por rama no se escribe en las filas, se deriva de `superior_id` y `cuentas.estado`.

```sql
ALTER TABLE usuarios
  ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'activo' AFTER activo,
  ADD COLUMN estado_impuesto_por BIGINT UNSIGNED NULL AFTER estado,
  ADD COLUMN estado_desde DATETIME(3) NULL AFTER estado_impuesto_por,
  ADD COLUMN estado_motivo VARCHAR(200) NULL AFTER estado_desde;
-- UPDATE: activo = 0 -> 'suspendido' (estado_impuesto_por = updated_by, estado_desde = updated_at)
ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_estado_impuesto_por FOREIGN KEY (estado_impuesto_por) REFERENCES usuarios (id),
  ADD KEY idx_usuarios_tenant_estado (tenant_id, estado),
  ADD CONSTRAINT ck_usuarios_estado CHECK (estado IN ('activo', 'restringido', 'suspendido')),
  ADD CONSTRAINT ck_usuarios_estado_datos CHECK (
    (estado = 'activo' AND estado_impuesto_por IS NULL AND estado_desde IS NULL AND estado_motivo IS NULL)
    OR (estado <> 'activo' AND estado_desde IS NOT NULL
         AND estado_motivo IS NOT NULL AND CHAR_LENGTH(TRIM(estado_motivo)) > 0)
  ),
  DROP COLUMN activo;
```

## permisos: restringir y suspender

Seed `db/seeds/01_catalogo.sql` (sin migración: el catálogo vive en el seed idempotente): `seguridad.usuario.restringir` y `seguridad.usuario.suspender`, ámbito `cuenta`, asignados al Administrador de cada cuenta (todos los de ámbito cuenta) y al rol base Titular.

## Topes de generación de QR (ola W5, ADR 0030 y 0031 §9)

Migraciones `20261027100001` a `20261027100005`. Los valores iniciales de `configuracion_limites` (y los supuestos entre ellos) están en `tablas/25_configuracion_limites.md`.

```sql
-- 20261027100001_create_configuracion_limites.sql
CREATE TABLE configuracion_limites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(60) NOT NULL,
  valor INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  UNIQUE KEY uq_configuracion_limites_clave (clave, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261027100002_create_excepciones_de_limite.sql
CREATE TABLE excepciones_de_limite (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  clave VARCHAR(60) NOT NULL,
  valor INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  usuario_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(usuario_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_excepciones_de_limite_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_excepciones_de_limite_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  UNIQUE KEY uq_excepciones_de_limite (tenant_id, usuario_clave, clave, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261027100003_create_eventos_de_limite.sql (solo inserción)
CREATE TABLE eventos_de_limite (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  tipo VARCHAR(40) NOT NULL,
  valor INT UNSIGNED NULL,
  tope INT UNSIGNED NULL,
  clave_unica VARCHAR(80) NULL,
  ocurrido_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_eventos_de_limite_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_eventos_de_limite_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT ck_eventos_de_limite_tipo CHECK (tipo IN (
    'qr.limite_diario', 'qr.limite_pendientes', 'qr.limite_propios_sin_uso',
    'qr.reemplazo_sin_uso', 'bolsa.aviso', 'bolsa.superada'
  )),
  UNIQUE KEY uq_eventos_de_limite_marca (tenant_id, clave_unica),
  KEY idx_eventos_de_limite_usuario (tenant_id, usuario_id, tipo, ocurrido_at),
  KEY idx_eventos_de_limite_tipo (tenant_id, tipo, ocurrido_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261027100004_add_limites_de_qr_a_planes.sql
ALTER TABLE planes
  ADD COLUMN bolsa_qr_mensual INT UNSIGNED NULL AFTER max_vigencia_qr_horas,
  ADD COLUMN max_puertas_por_qr INT UNSIGNED NULL AFTER bolsa_qr_mensual,
  ADD CONSTRAINT ck_planes_bolsa_qr CHECK (bolsa_qr_mensual IS NULL OR bolsa_qr_mensual >= 1),
  ADD CONSTRAINT ck_planes_max_puertas_qr CHECK (max_puertas_por_qr IS NULL OR max_puertas_por_qr >= 1);

-- 20261027100005_add_indice_de_creacion_a_qr_accesos.sql
ALTER TABLE qr_accesos ADD KEY idx_qr_accesos_creado (tenant_id, created_at);

-- 20261027100006_create_claves_idempotencia.sql (transitoria: sin soft delete ni autoría; las vencidas se borran)
CREATE TABLE claves_idempotencia (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  operacion VARCHAR(40) NOT NULL,
  clave_hash CHAR(64) NOT NULL,
  huella CHAR(64) NOT NULL,
  respuesta JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  vence_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_claves_idempotencia_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_claves_idempotencia_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT ck_claves_idempotencia_operacion CHECK (operacion IN ('qr.generar')),
  UNIQUE KEY uq_claves_idempotencia_clave (tenant_id, usuario_id, operacion, clave_hash),
  KEY idx_claves_idempotencia_vence (vence_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## permisos: configuración de los topes

Seed `db/seeds/01_catalogo.sql`: `limites.configuracion.ver` y `limites.configuracion.editar`, ámbito `plataforma` (el rol Super admin recibe todos los de plataforma). El mismo seed siembra los valores iniciales de `configuracion_limites` sin pisar los editados.

## Estados de placa y bandeja de notificaciones (ola W9, ADR 0030 §6 y ADR 0031 §18)

Migraciones `20261030100001`, `20261030100002` y `20261030100003`. Seed: permisos `notificaciones.aviso.ver` y `notificaciones.aviso.gestionar` (cuenta; los recibe el Administrador), `notificaciones.aviso_plataforma.ver` y `notificaciones.aviso_plataforma.gestionar` (plataforma; los recibe el Super admin) y las claves `placa.*` de `configuracion_limites`.

```sql
-- 20261030100001_create_notificaciones.sql
CREATE TABLE notificaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  cuenta_id BIGINT UNSIGNED NOT NULL,
  destinatario_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  severidad VARCHAR(10) NOT NULL,
  sitio_id BIGINT UNSIGNED NULL,
  agrupacion_clave VARCHAR(100) NOT NULL,
  clave_unica VARCHAR(120) NULL,
  abierta TINYINT(1) NOT NULL DEFAULT 0,
  cantidad INT UNSIGNED NOT NULL DEFAULT 1,
  miembros JSON NOT NULL,
  datos JSON NOT NULL,
  novedad_at DATETIME(3) NOT NULL,
  resuelta_at DATETIME(3) NULL,
  leida_at DATETIME(3) NULL,
  descartada_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  incidente_abierto TINYINT GENERATED ALWAYS AS (IF(abierta = 1 AND deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_notificaciones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_notificaciones_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas (id),
  CONSTRAINT fk_notificaciones_destinatario FOREIGN KEY (destinatario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_notificaciones_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id),
  CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada'
  )),
  CONSTRAINT ck_notificaciones_severidad CHECK (severidad IN ('info', 'aviso', 'critica')),
  CONSTRAINT ck_notificaciones_abierta CHECK (abierta IN (0, 1)),
  CONSTRAINT ck_notificaciones_ambito CHECK (tenant_id IS NULL OR tenant_id = cuenta_id),
  UNIQUE KEY uq_notificaciones_incidente (destinatario_id, agrupacion_clave, incidente_abierto),
  UNIQUE KEY uq_notificaciones_clave (destinatario_id, clave_unica),
  KEY idx_notificaciones_bandeja (destinatario_id, descartada_at, leida_at, novedad_at),
  KEY idx_notificaciones_cuenta (cuenta_id),
  KEY idx_notificaciones_retencion (abierta, novedad_at, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261030100002_create_cola_de_notificaciones.sql
CREATE TABLE cola_de_notificaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  audiencia VARCHAR(12) NOT NULL,
  canal VARCHAR(10) NOT NULL DEFAULT 'app',
  agrupacion_clave VARCHAR(100) NOT NULL,
  carga JSON NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
  intentos SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  proximo_intento_at DATETIME(3) NOT NULL,
  ultimo_error VARCHAR(60) NULL,
  entregada_at DATETIME(3) NULL,
  clave_unica VARCHAR(160) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_cola_de_notificaciones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT ck_cola_de_notificaciones_audiencia CHECK (audiencia IN ('cuenta', 'plataforma')),
  CONSTRAINT ck_cola_de_notificaciones_canal CHECK (canal IN ('app', 'push', 'correo')),
  CONSTRAINT ck_cola_de_notificaciones_estado CHECK (estado IN ('pendiente', 'entregada', 'fallida', 'omitida')),
  UNIQUE KEY uq_cola_de_notificaciones_clave (tenant_id, clave_unica),
  KEY idx_cola_de_notificaciones_pendientes (estado, proximo_intento_at, id),
  KEY idx_cola_de_notificaciones_grupo (tenant_id, agrupacion_clave, estado),
  KEY idx_cola_de_notificaciones_retencion (estado, updated_at, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261030100003_add_estado_de_placa_a_dispositivos.sql
ALTER TABLE dispositivos
  ADD COLUMN estado_conexion VARCHAR(20) NULL AFTER ultima_puerta_abierta,
  ADD COLUMN en_linea_desde DATETIME(3) NULL AFTER estado_conexion,
  ADD COLUMN lector_responde TINYINT(1) NULL AFTER en_linea_desde,
  ADD COLUMN lector_cambio_at DATETIME(3) NULL AFTER lector_responde,
  ADD COLUMN lector_informado_at DATETIME(3) NULL AFTER lector_cambio_at,
  ADD COLUMN estado_lector VARCHAR(20) NULL AFTER lector_informado_at,
  ADD COLUMN en_observacion TINYINT(1) NOT NULL DEFAULT 0 AFTER estado_lector,
  ADD CONSTRAINT ck_dispositivos_estado_conexion CHECK (
    estado_conexion IS NULL OR estado_conexion IN ('en_linea', 'sin_conexion', 'caida_sostenida', 'desaparecida')
  ),
  ADD CONSTRAINT ck_dispositivos_estado_lector CHECK (
    estado_lector IS NULL OR estado_lector IN ('responde', 'sin_respuesta')
  );

-- 20261031100001_create_confirmaciones_apertura.sql
CREATE TABLE confirmaciones_apertura (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  evento_acceso_id BIGINT UNSIGNED NOT NULL,
  dispositivo_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  origen VARCHAR(10) NOT NULL,
  resultado VARCHAR(20) NOT NULL,
  causa VARCHAR(30) NOT NULL,
  reportado_en_dispositivo_at DATETIME(3) NULL,
  registrada_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_confirmaciones_apertura_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_confirmaciones_apertura_evento FOREIGN KEY (evento_acceso_id) REFERENCES eventos_acceso (id),
  CONSTRAINT fk_confirmaciones_apertura_dispositivo FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id),
  CONSTRAINT fk_confirmaciones_apertura_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  CONSTRAINT ck_confirmaciones_apertura_origen CHECK (origen IN ('placa', 'servidor')),
  CONSTRAINT ck_confirmaciones_apertura_resultado CHECK (resultado IN ('ejecutada', 'fallida', 'sin_confirmacion')),
  CONSTRAINT ck_confirmaciones_apertura_causa CHECK (
    (resultado = 'ejecutada' AND causa = 'puerta_abrio')
    OR (resultado = 'fallida' AND causa IN ('puerta_no_abrio', 'puerta_no_cerro', 'rele_no_accionado'))
    OR (resultado = 'sin_confirmacion' AND causa IN ('sin_sensor', 'sin_respuesta'))
  ),
  CONSTRAINT ck_confirmaciones_apertura_servidor CHECK (origen = 'placa' OR causa = 'sin_respuesta'),
  UNIQUE KEY uq_confirmaciones_apertura_origen (evento_acceso_id, origen),
  KEY idx_confirmaciones_apertura_reciente (tenant_id, registrada_at),
  KEY idx_confirmaciones_apertura_dispositivo (dispositivo_id, registrada_at),
  KEY idx_confirmaciones_apertura_puerta (puerta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261031100002_add_sensor_y_apertura_a_dispositivos.sql
ALTER TABLE dispositivos
  ADD COLUMN sensor_instalado TINYINT(1) NOT NULL DEFAULT 0 AFTER en_observacion,
  ADD COLUMN sensor_habilitado_at DATETIME(3) NULL AFTER sensor_instalado,
  ADD COLUMN sensor_abierto_nivel VARCHAR(5) NOT NULL DEFAULT 'alto' AFTER sensor_habilitado_at,
  ADD COLUMN sensor_estado VARCHAR(12) NULL AFTER sensor_abierto_nivel,
  ADD COLUMN sensor_informado_at DATETIME(3) NULL AFTER sensor_estado,
  ADD COLUMN apertura_fallida TINYINT(1) NOT NULL DEFAULT 0 AFTER sensor_informado_at,
  ADD CONSTRAINT ck_dispositivos_sensor_nivel CHECK (sensor_abierto_nivel IN ('alto', 'bajo')),
  ADD CONSTRAINT ck_dispositivos_sensor_estado CHECK (
    sensor_estado IS NULL OR sensor_estado IN ('abierta', 'cerrada', 'sin_sensor')
  );

-- 20261031100003_add_apertura_fallida_a_tipos_de_notificacion.sql
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada',
    'apertura.fallida'
  ));
```

-- 20261101100001_create_incidentes_uso.sql
CREATE TABLE incidentes_uso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  gravedad VARCHAR(10) NOT NULL,
  origen VARCHAR(10) NOT NULL,
  registrado_por BIGINT UNSIGNED NULL,
  descripcion VARCHAR(300) NULL,
  evidencia JSON NOT NULL,
  clave_unica VARCHAR(100) NULL,
  ocurrido_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_incidentes_uso_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_incidentes_uso_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_incidentes_uso_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuarios (id),
  CONSTRAINT ck_incidentes_uso_tipo CHECK (tipo IN (
    'uso_masivo', 'uso_imposible', 'pin_compartido', 'qr_reenviado', 'generacion_ruidosa', 'perdida_o_robo', 'otro'
  )),
  CONSTRAINT ck_incidentes_uso_gravedad CHECK (gravedad IN ('baja', 'media', 'alta')),
  CONSTRAINT ck_incidentes_uso_origen CHECK (
    (origen = 'sistema' AND registrado_por IS NULL) OR (origen = 'persona' AND registrado_por IS NOT NULL)
  ),
  UNIQUE KEY uq_incidentes_uso_clave (tenant_id, clave_unica),
  KEY idx_incidentes_uso_usuario (tenant_id, usuario_id, ocurrido_at),
  KEY idx_incidentes_uso_reciente (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261101100002_create_resoluciones_de_incidente.sql
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

-- 20261101100003_create_anulaciones_masivas.sql
CREATE TABLE anulaciones_masivas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  alcance VARCHAR(10) NOT NULL,
  usuario_objetivo_id BIGINT UNSIGNED NULL,
  motivo VARCHAR(200) NOT NULL,
  usuarios_alcanzados INT UNSIGNED NOT NULL,
  qr_anulados INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_anulaciones_masivas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_anulaciones_masivas_objetivo FOREIGN KEY (usuario_objetivo_id) REFERENCES usuarios (id),
  CONSTRAINT ck_anulaciones_masivas_alcance CHECK (alcance IN ('usuario', 'rama', 'cuenta')),
  CONSTRAINT ck_anulaciones_masivas_objetivo CHECK (
    (alcance = 'cuenta' AND usuario_objetivo_id IS NULL) OR (alcance <> 'cuenta' AND usuario_objetivo_id IS NOT NULL)
  ),
  CONSTRAINT ck_anulaciones_masivas_motivo CHECK (CHAR_LENGTH(TRIM(motivo)) > 0),
  KEY idx_anulaciones_masivas_tenant (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261101100004_create_exportaciones.sql
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

-- 20261101100005_add_incidente_propuesta_a_tipos_de_notificacion.sql
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada',
    'apertura.fallida', 'incidente.propuesta'
  ));

-- 20261102100001_add_senales_a_tipos_de_notificacion.sql
ALTER TABLE notificaciones
  DROP CONSTRAINT ck_notificaciones_tipo,
  ADD CONSTRAINT ck_notificaciones_tipo CHECK (tipo IN (
    'placa.caida_sostenida', 'placa.desaparecida', 'placa.lector_sin_respuesta', 'placa.recuperada',
    'apertura.fallida', 'incidente.propuesta',
    'senal.uso', 'bolsa.aviso', 'bolsa.superada', 'flujo.atipico'
  ));

-- 20261102100002_create_avisos_de_senal.sql
CREATE TABLE avisos_de_senal (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  clave_unica VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_avisos_de_senal_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_avisos_de_senal_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  UNIQUE KEY uq_avisos_de_senal_clave (tenant_id, clave_unica),
  KEY idx_avisos_de_senal_creado (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20261102100003_add_indices_de_senales.sql
ALTER TABLE eventos_acceso ADD KEY idx_eventos_acceso_global (ocurrido_at), ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE eventos_de_limite ADD KEY idx_eventos_de_limite_global (tipo, ocurrido_at);
ALTER TABLE sesiones ADD KEY idx_sesiones_reciente (updated_at);
