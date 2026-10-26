# ADR 0034 — MariaDB 11.8 reemplaza a MySQL 8.4

**Estado:** Aceptada (2026-10-26). Reemplaza lo que el ADR 0002 y el ADR 0010 dicen del motor (MySQL 8.4). El resto de esos ADR sigue vigente.

## Contexto

El motor de la plataforma era MySQL 8.4 en un contenedor propio. Miguel quiere un solo motor, MariaDB, también en la infraestructura compartida y en las herramientas locales (MAMP y XAMPP traen MySQL o MariaDB según la versión, y phpMyAdmin se conecta igual a ambos).

El esquema se creó pensando en MySQL 8 y `docs/gestion/despliegue.md` decía que MariaDB «no sirve». Se probó con `mariadb:11.8` (LTS): las 36 migraciones aplican, los seeds son idempotentes, el rollback completo funciona y los 505 tests de la API pasan.

## Decisión

- **Motor:** MariaDB 11.8 (LTS) en `docker-compose.yml`, `docker-compose.prod.yml` y el servicio de `ci.yml`. Mismos cuatro rasgos de siempre: `utf8mb4`, collation `utf8mb4_0900_ai_ci` (MariaDB 11.8 la soporta), UTC y sin puerto publicado en producción.
- **Variables:** el contenedor usa `MARIADB_*`; los archivos `.env` siguen con `MYSQL_*` (el compose las traduce), así que no hay que tocar `/opt/acceso/.env`.
- **Cliente y driver:** `mysql2` y dbmate (URL `mysql://`) funcionan igual con MariaDB. Herramientas dentro del contenedor: `mariadb`, `mariadb-dump`, `healthcheck.sh`.
- **Volúmenes nuevos:** `qr-access-mariadb-data` (desarrollo) y `datos-mariadb` (producción). Los archivos de datos de MySQL no los abre MariaDB; por eso no se reutiliza el volumen anterior, que queda intacto como respaldo hasta que se confirme la migración.

### Ajustes al SQL de las migraciones (compatibles con lo ya aplicado)

| Migración | Cambio |
|---|---|
| `create_cuentas` | `CHECK (REGEXP_LIKE(codigo, '^[A-Z]{3}$', 'c'))` → `CHECK (BINARY codigo REGEXP '^[A-Z]{3}$')`: MariaDB no admite `REGEXP_LIKE` en un `CHECK`. |
| `pendiente_de_pago_y_correo_de_contacto`, `cambia_deposito_por_qr_en_pagos` | `DROP CHECK x` → `DROP CONSTRAINT x`. |
| `add_es_propio_a_qr_accesos` (solo el `down`) | Antes de borrar el UNIQUE se restituye el índice `fk_qr_accesos_emisor`, que MariaDB había descartado. |

El `up` de MySQL equivale al de MariaDB, así que las bases que ya corrieron esas migraciones no se rehacen.

## Consecuencias

- Se pierde la compatibilidad probada con MySQL 8: de aquí en adelante, el SQL se prueba contra MariaDB.
- Migrar producción exige volcar y restaurar (procedimiento en `docs/gestion/despliegue.md`); los datos de desarrollo se recargan con `bin/reiniciar-local`.
- Los ADR 0002, 0010 y 0016 nombran MySQL por historia; el motor vigente es el de este ADR.
