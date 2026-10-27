# 33 — `incidentes_uso`

**Módulo dueño:** `incidentes` · **Tenant:** sí · **Migración:** `db/migrations/20261101100001_create_incidentes_uso.sql`

## Propósito

Un hecho sospechoso o una falta de un usuario de la cuenta (ADR 0033 §4.1): lo abre el sistema cuando salta una señal (ADR 0030 §4, 0031 §19) o una persona que administra la rama lo registra a mano. Es el HECHO y es de **solo inserción**; qué se decidió después vive en `resoluciones_de_incidente` (ficha 34). Un incidente aislado no limita nada: solo la reincidencia de incidentes CONFIRMADOS hace que el sistema proponga un paso.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `usuario_id` | `BIGINT UNSIGNED` | no | FK a `usuarios`: de quién es el incidente |
| `tipo` | `VARCHAR(30)` | no | `uso_masivo`, `uso_imposible`, `pin_compartido`, `qr_reenviado`, `generacion_ruidosa`, `perdida_o_robo`, `otro` (`CHECK`) |
| `gravedad` | `VARCHAR(10)` | no | `baja`, `media`, `alta` (supuesto: el ADR no fija la escala) |
| `origen` | `VARCHAR(10)` | no | `sistema` o `persona` |
| `registrado_por` | `BIGINT UNSIGNED` | sí | FK a `usuarios`: quién lo registró; `NULL` si lo creó el sistema (`ck_incidentes_uso_origen`) |
| `descripcion` | `VARCHAR(300)` | sí | Nota libre de la persona |
| `evidencia` | `JSON` | no | `{"qr_ids":[],"evento_acceso_ids":[],"evento_limite_ids":[]}`: SOLO ids. Jamás el token del QR ni su hash |
| `clave_unica` | `VARCHAR(100)` | sí | Idempotencia de los incidentes del sistema (p. ej. `generacion_ruidosa:<usuario>:<día UTC>`) |
| `ocurrido_at` | `DATETIME(3)` | no | Cuándo pasó (UTC); es el que entra en la ventana de la reincidencia |
| `created_at` | `DATETIME(3)` | no | Cuándo se registró |

Sin `updated_*`, `deleted_*` ni bitácora: perfil `solo_insercion`, como `eventos_acceso`. El registro con su autor es el rastro.

## Índices y restricciones

- `uq_incidentes_uso_clave (tenant_id, clave_unica)`: el sistema no repite una señal (los `NULL` de las personas no chocan).
- `idx_incidentes_uso_usuario (tenant_id, usuario_id, ocurrido_at)` sirve el conteo de la reincidencia; `idx_incidentes_uso_reciente`.
- `ck_incidentes_uso_tipo`, `ck_incidentes_uso_gravedad`, `ck_incidentes_uso_origen`.

## Reglas

- Persona: `POST /api/v1/incidentes` (`seguridad.incidente.resolver`), solo sobre alguien de su rama y nunca sobre sí misma; la evidencia (ids de QR y de intentos) tiene que ser del usuario o de su rama; `ocurrido_at` no puede ser futuro ni de hace más de un año; hasta 20 incidentes a mano por usuario en 24 horas. Sistema: el contrato `crearServicioDeIncidentes(pool).registrarDelSistema(...)` (módulo `incidentes`), idempotente por `clave_unica`; comprueba que el usuario sea de la cuenta del contexto. Lo usan `generacion_ruidosa` (ola W11, tarea cada 5 min sobre `eventos_de_limite`) y, desde la ola W12, `uso_masivo`, `uso_imposible`, `qr_reenviado` y `pin_compartido` (tareas `senal-*`). Esos incidentes llevan en `descripcion` un código con lo medido (`aperturas=13;umbral=12`, no una frase) y las claves `<tipo>:<usuario>:<día local La Paz>`; AGROCOM los ve en `GET /api/v1/plataforma/senales`.
- Lo lee `seguridad.incidente.ver`: el Administrador y el Titular ven los de su rama y los suyos (el Administrador no ve la de otro Administrador, D-29), el Miembro y el Guardia los propios.
- Retención: pendiente (como `eventos_acceso`, D-06).
