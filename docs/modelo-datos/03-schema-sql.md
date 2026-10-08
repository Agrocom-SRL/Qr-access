# Schema SQL de referencia — MySQL 8.4

**Estado:** Propuesta (2026-10-08). Es lo que deben producir las migraciones de `db/migrations/`, una por tabla (ADR 0011). Convenciones: skill `modelo-datos`; unicidad con soft delete: ADR 0016. Las tablas `cuenta_datos_empresa` y `usuario_perfiles` se agregan con su ficha cuando se implemente Seguridad.

Verificado contra `mysql:8.4` en un contenedor descartable (2026-10-08): las 20 tablas se crean en este orden sin errores.

## cuentas

```sql
CREATE TABLE cuentas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(40) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  UNIQUE KEY uq_cuentas_codigo (codigo, vigente),
  CONSTRAINT ck_cuentas_codigo CHECK (codigo REGEXP '^[a-z0-9-]{3,40}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## usuarios

```sql
CREATE TABLE usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  username VARCHAR(60) NOT NULL,
  email VARCHAR(190) NULL,
  contrasena_hash VARCHAR(255) NOT NULL,
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
  UNIQUE KEY uq_usuarios_username (tenant_clave, username, vigente),
  UNIQUE KEY uq_usuarios_email (tenant_clave, email, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## roles

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

## permisos

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
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_usuario_roles_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_usuario_roles (usuario_id, rol_id, vigente),
  CONSTRAINT fk_usuario_roles_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_usuario_roles_rol FOREIGN KEY (rol_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## sesiones

```sql
CREATE TABLE sesiones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  refresh_hash CHAR(64) NOT NULL,
  agente VARCHAR(255) NULL,
  ip VARCHAR(45) NULL,
  expira_at DATETIME(3) NOT NULL,
  revocada_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_sesiones_refresh (refresh_hash),
  KEY idx_sesiones_usuario (usuario_id),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_sesiones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## sitios

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

```sql
CREATE TABLE puertas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  sitio_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  tipo_cerradura VARCHAR(20) NOT NULL DEFAULT 'fail_secure',
  segundos_apertura TINYINT UNSIGNED NOT NULL DEFAULT 5,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_puertas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_puertas_nombre (sitio_id, nombre, vigente),
  CONSTRAINT fk_puertas_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id),
  CONSTRAINT ck_puertas_tipo CHECK (tipo_cerradura IN ('fail_secure', 'fail_safe')),
  CONSTRAINT ck_puertas_segundos CHECK (segundos_apertura BETWEEN 1 AND 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## personas

```sql
CREATE TABLE personas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  documento VARCHAR(30) NULL,
  foto_ruta VARCHAR(255) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_personas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_personas_documento (tenant_clave, documento, vigente),
  UNIQUE KEY uq_personas_usuario (usuario_id, vigente),
  CONSTRAINT fk_personas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## grupos

```sql
CREATE TABLE grupos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_grupos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_grupos_nombre (tenant_clave, nombre, vigente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## grupo_personas

```sql
CREATE TABLE grupo_personas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  grupo_id BIGINT UNSIGNED NOT NULL,
  persona_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_grupo_personas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_grupo_personas (grupo_id, persona_id, vigente),
  CONSTRAINT fk_grupo_personas_grupo FOREIGN KEY (grupo_id) REFERENCES grupos (id),
  CONSTRAINT fk_grupo_personas_persona FOREIGN KEY (persona_id) REFERENCES personas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## dispositivos

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
  revocado_at DATETIME(3) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_dispositivos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_dispositivos_puerta (puerta_id, vigente),
  CONSTRAINT fk_dispositivos_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## reglas_acceso

```sql
CREATE TABLE reglas_acceso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  persona_id BIGINT UNSIGNED NULL,
  grupo_id BIGINT UNSIGNED NULL,
  vigente_desde DATETIME(3) NOT NULL,
  vigente_hasta DATETIME(3) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_reglas_acceso_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  KEY idx_reglas_acceso_puerta (tenant_id, puerta_id),
  CONSTRAINT fk_reglas_acceso_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  CONSTRAINT fk_reglas_acceso_persona FOREIGN KEY (persona_id) REFERENCES personas (id),
  CONSTRAINT fk_reglas_acceso_grupo FOREIGN KEY (grupo_id) REFERENCES grupos (id),
  CONSTRAINT ck_reglas_acceso_sujeto CHECK ((persona_id IS NULL) <> (grupo_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## reglas_acceso_franjas

```sql
CREATE TABLE reglas_acceso_franjas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  regla_acceso_id BIGINT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  hora_desde TIME NOT NULL,
  hora_hasta TIME NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_reglas_acceso_franjas_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_franjas_regla FOREIGN KEY (regla_acceso_id) REFERENCES reglas_acceso (id),
  CONSTRAINT ck_franjas_dia CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT ck_franjas_horas CHECK (hora_desde < hora_hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## credenciales_qr

```sql
CREATE TABLE credenciales_qr (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  persona_id BIGINT UNSIGNED NOT NULL,
  secreto_cifrado VARBINARY(128) NOT NULL,
  rotada_at DATETIME(3) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  tenant_clave BIGINT UNSIGNED GENERATED ALWAYS AS (IFNULL(tenant_id, 0)) STORED,
  vigente TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED,
  CONSTRAINT fk_credenciales_qr_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_credenciales_qr_persona (persona_id, vigente),
  CONSTRAINT fk_credenciales_qr_persona FOREIGN KEY (persona_id) REFERENCES personas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## qr_usos

```sql
CREATE TABLE qr_usos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  credencial_qr_id BIGINT UNSIGNED NOT NULL,
  paso BIGINT UNSIGNED NOT NULL,
  usado_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_qr_usos (credencial_qr_id, paso),
  CONSTRAINT fk_qr_usos_credencial FOREIGN KEY (credencial_qr_id) REFERENCES credenciales_qr (id),
  CONSTRAINT fk_qr_usos_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## invitaciones

```sql
CREATE TABLE invitaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  invitado_nombre VARCHAR(150) NOT NULL,
  desde DATETIME(3) NOT NULL,
  hasta DATETIME(3) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  usos_max TINYINT UNSIGNED NOT NULL DEFAULT 1,
  usos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_invitaciones_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  UNIQUE KEY uq_invitaciones_token (token_hash),
  CONSTRAINT fk_invitaciones_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  CONSTRAINT ck_invitaciones_estado CHECK (estado IN ('pendiente', 'usada', 'vencida', 'anulada')),
  CONSTRAINT ck_invitaciones_ventana CHECK (desde < hasta),
  CONSTRAINT ck_invitaciones_usos CHECK (usos <= usos_max)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## eventos_acceso

```sql
CREATE TABLE eventos_acceso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  puerta_id BIGINT UNSIGNED NOT NULL,
  dispositivo_id BIGINT UNSIGNED NULL,
  persona_id BIGINT UNSIGNED NULL,
  credencial_qr_id BIGINT UNSIGNED NULL,
  invitacion_id BIGINT UNSIGNED NULL,
  validado_por BIGINT UNSIGNED NULL,
  metodo VARCHAR(20) NOT NULL,
  resultado VARCHAR(10) NOT NULL,
  motivo_code VARCHAR(60) NOT NULL,
  token_prefijo VARCHAR(16) NULL,
  ocurrido_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  leido_en_dispositivo_at DATETIME(3) NULL,
  KEY idx_eventos_acceso_puerta (tenant_id, puerta_id, ocurrido_at),
  KEY idx_eventos_acceso_persona (tenant_id, persona_id, ocurrido_at),
  CONSTRAINT fk_eventos_acceso_tenant FOREIGN KEY (tenant_id) REFERENCES cuentas (id),
  CONSTRAINT fk_eventos_acceso_puerta FOREIGN KEY (puerta_id) REFERENCES puertas (id),
  CONSTRAINT ck_eventos_acceso_metodo CHECK (metodo IN ('qr_dispositivo', 'qr_guardia', 'invitacion', 'pulsador', 'forzada')),
  CONSTRAINT ck_eventos_acceso_resultado CHECK (resultado IN ('permitido', 'denegado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## bitacoras

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
