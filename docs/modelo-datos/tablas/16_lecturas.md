# 16 — `lecturas`

**Módulo dueño:** `accesos` · **Tenant:** sí · **Migraciones:** `db/migrations/20261009100016_create_eventos_acceso.sql` `20261028100001_add_repetido_de_id_a_eventos_acceso.sql` y, para el nombre actual, `20261103100001_rename_eventos_acceso_a_lecturas.sql`

## Propósito

Cada fila es una **lectura**: un intento de lectura de un QR (o una apertura física: pulsador de salida, puerta forzada), permitido o rechazado, con su motivo (invariante 4, ADR 0007). Es de solo inserción (perfil `solo_insercion`).

> **Nota de compatibilidad (nombre anterior).** Hasta la ola W14 la tabla se llamaba `eventos_acceso`. Miguel decidió el nombre `lecturas` («se entiende mejor como lecturas», ADR 0032 §5) y la migración `20261103100001` la renombró con `RENAME TABLE` sin copiarla ni bloquear la escritura. Las migraciones anteriores conservan el nombre viejo porque ya corrieron; la columna `confirmaciones_apertura.evento_acceso_id` y los campos JSON `evento_id` / `evento_acceso_ids` no se renombraron (cambio incompatible, quedan para una `v2`). Los valores históricos de `bitacoras.tabla` no se reescriben. El nombre `eventos_acceso` sigue vivo solo en las rutas obsoletas `/eventos-acceso` y `/plataforma/eventos-acceso`.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `tenant_id` | `BIGINT UNSIGNED` | no | FK a `cuentas` |
| `puerta_id` | `BIGINT UNSIGNED` | no |  |
| `dispositivo_id` | `BIGINT UNSIGNED` | sí |  |
| `qr_acceso_id` | `BIGINT UNSIGNED` | sí |  |
| `token_hash` | `CHAR(64)` | sí | SHA-256 del token del QR (sensible) |
| `usuario_id` | `BIGINT UNSIGNED` | sí | FK a `usuarios` (ADR 0035): quién pidió la apertura manual. Nulo en las demás |
| `metodo` | `VARCHAR(20)` | no | `qr`, `pulsador`, `forzada`, `manual` (ADR 0035) |
| `resultado` | `VARCHAR(10)` | no | `permitido` o `rechazado` |
| `motivo_code` | `VARCHAR(60)` | no | Código estable, p. ej. `qr.vencido` |
| `ocurrido_at` | `DATETIME(3)` | no |  |
| `leido_en_dispositivo_at` | `DATETIME(3)` | sí |  |
| `repetido_de_id` | `BIGINT UNSIGNED` | sí | FK a `lecturas`: el intento original del que este es una repetición dentro de la ventana (ADR 0032 §3 y §4). `NULL` en los originales |

## Índices y restricciones

- `idx_lecturas_puerta`
- `idx_lecturas_fecha`
- `idx_lecturas_qr`
- `idx_lecturas_global (ocurrido_at)` (ola W12): los detectores de señales buscan los intentos de una ventana de tiempo en TODAS las cuentas, y los demás índices empiezan por `tenant_id`.
- `idx_lecturas_repeticion` `(tenant_id, dispositivo_id, token_hash, ocurrido_at)`: busca el original de una repetición
- `idx_lecturas_repetido_de`
- `fk_lecturas_repetido_de`
- `fk_lecturas_tenant`, `fk_lecturas_puerta`, `fk_lecturas_dispositivo`, `fk_lecturas_qr`
- `ck_eventos_acceso_metodo` y `ck_eventos_acceso_resultado`: conservan el nombre anterior a propósito; en MariaDB renombrar un `CHECK` exige `ALGORITHM=COPY` (reescribe la tabla y bloquea las escrituras; 4 s con 200 000 filas). Solo se ven en el mensaje de un `INSERT` inválido.

El SQL completo está en `03-schema-sql.md`.

## Reglas

- Solo inserción: sin `updated_*` ni `deleted_*`; la API nunca actualiza ni borra una fila. En producción, el usuario de base no tiene `UPDATE` ni `DELETE`.
- Un token desconocido o ilegible se guarda como `token_hash`, nunca como texto.
- `ocurrido_at` es la hora del servidor; `leido_en_dispositivo_at` es la del reloj del dispositivo, solo informativa.
- Qué pasó con la orden de abrir (¿la puerta se abrió?) no se guarda aquí: vive en `confirmaciones_apertura` (ficha 32), enlazada a este evento. El evento nunca se edita.
- `repetido_de_id` se escribe en el INSERT de la fila repetida, nunca por UPDATE. Un repetido apunta siempre al original (nunca a otro repetido), así la ventana no se encadena. Hay repetición cuando el MISMO dispositivo relee el MISMO `token_hash`: de una apertura `permitido` dentro de 15 s (la API vuelve a responder `abrir: true` sin consumir otra vez) o de un rechazo idéntico (mismo `motivo_code`) dentro de 60 s. Listados y estadísticas muestran solo los originales, con «×N».
- **Apertura manual** (ADR 0035): `metodo = 'manual'` y `usuario_id`; `qr_acceso_id`, `token_hash` y `dispositivo_id` nulos (al insertar la lectura aún no se sabe qué placa tomará la orden; la tabla es de solo inserción, y esa placa queda en `ordenes_apertura` y `confirmaciones_apertura`). No guarda entrada ni salida: la app no lo sabe. `permitido` con `motivo_code = 'manual.ordenada'` cuando la API crea la orden; `rechazado` con su motivo (`manual.no_habilitada`, `manual.sin_conexion`, `manual.sin_dispositivo`, `manual.orden_en_curso`, `manual.limite`, `manual.suscripcion_vencida`…). El `CHECK` de `metodo` se rehace en la migración `add_apertura_manual_a_lecturas` (`DROP` + `ADD`, ALGORITHM=COPY en MariaDB; datos de prueba).
- La apertura por pulsador de salida y la puerta forzada (`metodo`) quedan para el firmware.

## Dudas

- D-06 — `02-dudas-y-ambiguedades.md`
