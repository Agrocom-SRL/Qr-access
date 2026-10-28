# 09 — `sesiones`

**Módulo dueño:** `seguridad` · **Tenant:** sí · **Migración:** `db/migrations/20261009100009_create_sesiones.sql` y `20261029100001_add_instalacion_y_plataforma_a_sesiones.sql`

## Propósito

Una sesión de un usuario: su refresh token (hasheado), su rol (el único del usuario, ADR 0028) y su vencimiento.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | sí | FK a `cuentas` |
| `usuario_id` | `BIGINT UNSIGNED` | no |  |
| `rol_activo_id` | `BIGINT UNSIGNED` | sí |  |
| `refresh_hash` | `CHAR(64)` | no | SHA-256 del refresh (sensible) |
| `agente` | `VARCHAR(255)` | sí |  |
| `ip` | `VARCHAR(45)` | sí |  |
| `instalacion_id` | `VARCHAR(64)` | sí | Identificador ALEATORIO que genera la app y guarda local (no es IMEI ni huella del aparato); nunca se muestra. NULL en clientes anteriores (ADR 0030 §4.1) |
| `plataforma` | `VARCHAR(10)` | sí | `android`, `ios` o `web` |
| `nombre_dispositivo` | `VARCHAR(60)` | sí | Nombre corto que manda la app (modelo o navegador), sin caracteres de control |
| `ultima_actividad_at` | `DATETIME(3)` | sí | Última petición autenticada o refresco; se escribe como mucho cada 5 minutos |
| `expira_at` | `DATETIME(3)` | no |  |
| `revocada_at` | `DATETIME(3)` | sí |  |
| `motivo_cierre` | `VARCHAR(24)` | sí | `salida`, `propia`, `superior`, `plataforma`, `misma_instalacion`, `limite_usuario`, `limite_instalacion`; NULL = cierre por PIN regenerado, baja o suspensión, o anterior a W8 |
| `revocada_por` | `BIGINT UNSIGNED` | sí | FK a `usuarios`: quien cerró la sesión |

## Índices y restricciones

- `uq_sesiones_refresh`
- `idx_sesiones_usuario`
- `idx_sesiones_reciente (updated_at)` (ola W12): el detector de PIN compartido busca las sesiones que se movieron en la ventana (el refresco rota la fila y con ella `updated_at`) sin recorrer toda la tabla.
- `idx_sesiones_instalacion (instalacion_id, revocada_at)` y `idx_sesiones_vivas (usuario_id, revocada_at, expira_at)`
- `ck_sesiones_plataforma` y `ck_sesiones_motivo_cierre`

El SQL completo está en `03-schema-sql.md`.

## Reglas

- `refresh_hash` es el SHA-256 del refresh (256 bits de entropía); el token en claro solo existe en la respuesta del login o del refresco. Es único.
- El refresh se rota en sitio (`UPDATE … WHERE refresh_hash = <anterior>`): dos refrescos simultáneos con el mismo token, uno solo gana.
- Revocar (`revocada_at`) corta el refresh y el JWT de acceso, porque este se revalida contra la sesión en cada petición.
- Tabla transitoria: sin soft delete ni autoría, y sin bitácora para los cambios rutinarios (rotar, actividad, salir). SÍ queda en la bitácora (origen `api`) cerrar una sesión por un tope, por el propio usuario desde otra sesión, por un superior o por AGROCOM.
- Topes (ADR 0030 §4.1): iniciar sesión nunca se rechaza; pasado el tope se cierra la más antigua. Una instalación tiene una sola sesión viva por usuario; como mucho `SESIONES_MAX_POR_USUARIO` (10) por usuario y `SESIONES_MAX_POR_INSTALACION` (5) por instalación.
- Las sesiones existentes antes de la migración quedan con instalación y plataforma NULL (cuentan solo contra el tope por usuario).

## Dudas

- Ninguna abierta.
