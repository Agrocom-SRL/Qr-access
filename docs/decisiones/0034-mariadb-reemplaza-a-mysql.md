# ADR 0034 — MariaDB 10.11 reemplaza a MySQL 8.4

**Estado:** Aceptada (2026-10-26). Reemplaza lo que el ADR 0002 y el ADR 0010 dicen del motor (MySQL 8.4). El resto de esos ADR sigue vigente.

## Contexto

El motor de la plataforma era MySQL 8.4 en un contenedor propio. Miguel quiere un solo motor, MariaDB, y que producción use **la misma MariaDB compartida que ya tiene en su infraestructura** (servidor `data.wiiz.com.bo`, MariaDB **10.11.13** LTS, con otras bases que no se tocan; el CT 120 la alcanza por IP). Actualizar ese servidor no es una opción.

Por eso la versión de referencia es la del servidor, **10.11**, y no una más nueva: desarrollo y CI usan la misma para que lo que pasa en local pase en producción. Se probó con `mariadb:10.11`: las migraciones aplican y los 505 tests de la API pasan.

## Decisión

- **Motor:** MariaDB 10.11 (LTS) en `docker-compose.yml` (desarrollo) y en el servicio de `ci.yml`. Rasgos: `utf8mb4`, collation **`utf8mb4_unicode_ci`**, UTC.
- **Collation:** `utf8mb4_0900_ai_ci` es de MySQL 8 y MariaDB solo la tiene desde la 11.4.5, así que no existe en 10.11. `utf8mb4_unicode_ci` existe en todas las versiones y, como la anterior, no distingue mayúsculas ni acentos.
- **Producción no tiene contenedor de base de datos.** `docker-compose.prod.yml` no levanta `db`: la API, `dbmate`, el cliente `mariadb` y phpMyAdmin se conectan a la MariaDB compartida con `DB_HOST` y `DB_PORT` del `/opt/acceso/.env`, con una base (`acceso`) y un usuario propios de la aplicación, sin `root`. La base y el usuario los crea el administrador del servidor.
- **Cliente y driver:** `mysql2` y dbmate (URL `mysql://`) funcionan igual con MariaDB. En desarrollo, las herramientas dentro del contenedor son `mariadb` y `mariadb-dump`.
- **Volumen de desarrollo:** `qr-access-mariadb-data`. Los archivos de datos de MySQL no los abre MariaDB, por eso no se reutiliza el volumen anterior.

### Ajustes al SQL de las migraciones (compatibles con lo ya aplicado)

| Migración | Cambio |
|---|---|
| `create_cuentas` | `CHECK (REGEXP_LIKE(codigo, '^[A-Z]{3}$', 'c'))` → `CHECK (BINARY codigo REGEXP '^[A-Z]{3}$')`: MariaDB no admite `REGEXP_LIKE` en un `CHECK`. |
| `pendiente_de_pago_y_correo_de_contacto`, `cambia_deposito_por_qr_en_pagos` | `DROP CHECK x` → `DROP CONSTRAINT x`. |
| `add_es_propio_a_qr_accesos` (solo el `down`) | Antes de borrar el UNIQUE se restituye el índice `fk_qr_accesos_emisor`, que MariaDB había descartado. |
| Todas las `create_*` | `COLLATE=utf8mb4_0900_ai_ci` → `COLLATE=utf8mb4_unicode_ci`. |

## Consecuencias

- Se pierde la compatibilidad probada con MySQL 8: de aquí en adelante, el SQL se prueba contra MariaDB 10.11. No se usa nada que exista solo en versiones posteriores.
- La base de producción es compartida: no se hace `DROP DATABASE`, y el usuario de la aplicación solo tiene permisos sobre `acceso`. Los respaldos y la disponibilidad del servidor dependen de quien lo administra (ver `docs/gestion/despliegue.md`).
- Los datos de desarrollo se recargan con `bin/reiniciar-local`.
- Los ADR 0002, 0010 y 0016 nombran MySQL por historia; el motor vigente es el de este ADR.
