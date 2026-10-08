# Estado del proyecto — AGROCOM Acceso

**Última actualización:** 2026-10-08

## Qué ya existe

- **Repo en GitHub** con `develop` como rama de integración, ramas protegidas, Dependabot (actions agrupadas) y auto-merge cuando `ci` queda en verde. Integrados: la base del proyecto (#1) y las actualizaciones de actions (#2, #4, #6, #7).
- **Kit de procesos** heredado de ACRECIA y adaptado al monorepo: `CLAUDE.md`, `CONTRIBUTING.md`, 14 agentes y 9 skills en `.claude/`, guardarraíles en `.claude/hooks/`, `bin/verify` por partes y workflows `ci.yml`, `auto-merge.yml` y `release.yml`.
- **Alcance V1 replanteado con el cliente** (rama `feature/alcance-v1`):
  - Dudas **D-01 a D-05 cerradas**: lector QR en la puerta con ESP32; QR emitido por un usuario, de un solo uso y con vencimiento en el día; comunicación HTTPS sobre WiFi (sin RS485, Firebase ni MQTT); cerradura por pulso; sin red no se abre. Además se cerraron D-07, D-09, D-10 y D-11, que se resolvían con lo anterior.
  - **ADR 0008 reescrito**: el QR es un token aleatorio, guardado como hash, que se consume de forma atómica al primer uso. Quien entra no tiene app ni queda registrado.
  - **ADR 0017**: cuentas con suscripción y plan con límites (dispositivos, usuarios, vigencia máxima del QR); los QR son ilimitados.
  - **ADR 0018 (propuesta)**: login de los usuarios de cuenta con código de cuenta + PIN de 8 dígitos generado por el servidor.
  - Documento funcional V1, entidades revisadas (salen `personas`, `grupos`, `reglas_acceso`…; entran `planes`, `suscripciones` y `qr_accesos`) y 14 dudas nuevas (D-12 a D-24).
- **Esqueletos con su cascada en verde** (rama `feature/esqueletos-base`):
  - `api/`: Fastify 5 + zod 4 (OpenAPI 3.1 en `/api/v1/openapi.json`), mysql2 sin ORM, errores RFC 9457, `ContextoCuenta` que falla cerrado, `GET /api/v1/salud`, ESLint estricto, Prettier, dependency-cruiser con las fronteras del ADR 0003, y Vitest sobre MySQL con guarda de base `_testing` (15 tests). Dockerfile de desarrollo y de producción.
  - `app/`: Flutter 3.47.4 (Android, iOS y web) con el tema por tokens (verde Santa Cruz, claro y oscuro), l10n en `app_es.arb`, Riverpod, go_router y la pantalla de ingreso con cuenta + PIN, todavía sin conexión a la API. Tests de tokens, fronteras, tuteo, textos literales y contraste AA (26 tests). Dockerfile con Nginx y proxy de `/api`.
  - `firmware/`: PlatformIO (ESP32 + Arduino) con la máquina de estados de falla segura y el intérprete de la respuesta en `lib/`, más 22 tests nativos. En `src/`: lector por UART, pulso de cerradura con tope, pulsador de salida, WiFi con backoff, NTP, cliente HTTPS en su propia tarea y watchdog. Compila para la placa (RAM 14.6 %, flash 71.4 %).
  - **Docker**: `docker compose up` levanta MySQL y la API; con `--profile web`, también la app web en `:8080`. El firmware se compila y prueba en el contenedor `firmware`.
  - `.gitignore` global (entorno, sistema operativo, editores) y uno por parte (`api/`, `app/`, `firmware/`).

## Próximo paso

1. Revisar e integrar las PR de `feature/alcance-v1` y `feature/esqueletos-base`.
2. Llevarle al cliente las dudas abiertas que bloquean el modelo: **D-14** (límites del plan), **D-16** (vencimiento "fin del día" o 24 h), **D-17** (una o varias puertas por QR), **D-22 a D-24** (formato del PIN y quién lo genera).
3. Rehacer `03-schema-sql.md` y escribir las primeras migraciones con el modelo nuevo: `cuentas`, `planes`, `suscripciones`, `usuarios` (PIN), `roles`, `permisos`, `sesiones` y `bitacoras`. Después, `RepositorioDeCuenta` con la bitácora en la misma transacción.
4. Primera historia vertical: HU-04 (login por PIN) → HU-07 (sitios y puertas) → HU-08 (alta de dispositivo) → HU-11/HU-14 (emitir y validar un QR) → probar con el ESP32 en la mesa.

## Pendiente de decidir o confirmar

- Dudas abiertas: `docs/modelo-datos/02-dudas-y-ambiguedades.md` (D-06, D-08, D-12 a D-24).
- Hex oficial del verde de marca (D-08).
- Servidor de producción y DNS (D-13): de eso dependen el `docker-compose.prod.yml` con TLS y la CA que embebe el firmware (hoy, ISRG Root X1 de Let's Encrypt).
- Modelo exacto del lector QR y detalle eléctrico de la cerradura: se confirman al comprar el hardware.
