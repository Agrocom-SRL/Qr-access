# Estado del proyecto — AGROCOM Acceso

**Última actualización:** 2026-10-09 (rama `feature/diseno-pantallas`)

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

## Núcleo V1 integrado en `develop` (#14, #15, #16)

- **API (#15):** 16 migraciones (una por tabla) y `03-schema-sql.md` al día; seeds `01_catalogo` (permisos) y `02_demo` (cuenta `DEM`, solo desarrollo, ver `entornos.md`). `RepositorioDeCuenta` / `RepositorioDePlataforma` (tenant, soft delete, autoría y bitácora por construcción), argon2id, HMAC con pimienta, JWT y autenticación que falla cerrado. Módulos `seguridad` (login por PIN, refresco rotativo, rol activo, sesión actual con sus roles), `organizacion` (listar puertas), `suscripciones` (vigencia vía contrato), `accesos` (emitir, listar y anular QR; validación con consumo atómico; eventos) y `dispositivos` (credencial, latido, configuración). 148 tests.
- **App (#16):** ingreso por PIN con elección de rol (también al reabrir), tablero por permisos, emisión de QR para una o más puertas, visor y compartir PNG, listado con anulación y bitácora paginada. Cliente de la API escrito a mano con los `code` de error traducidos en el ARB. 156 tests; compila web y APK.
- **Firmware (#14):** contrato V1 estricto (abre solo con `abrir:true`, `motivo_code=acceso.permitido`, `evento_id` y `segundos` válidos), tope de apertura de 10 s, credencial del dispositivo en NVS, TLS con CA embebida (HTTP plano solo en `esp32-dev`), latido, configuración, NTP, watchdog, aprovisionamiento por serie e indicaciones por LED y buzzer. 69 tests nativos.
- **Después de actualizar `develop`:** `flutter pub get` y `flutter gen-l10n` en `app/` (las traducciones generadas no se versionan), `npm ci` en `api/`, copiar `JWT_SECRETO` y `PIN_PIMIENTA` de `.env.example` al `.env`, y migrar y sembrar la base de desarrollo (`entornos.md`, "Datos de desarrollo").

## Rama `feature/diseno-pantallas` (2026-10-09, pendiente de PR)

Aplica el handoff de diseño V1 (`docs/diseno/handoff/`, antes `design_handoff_agrocom_acceso/` en la raíz) a la app, y amplía la API para lo que esas pantallas necesitan:

- **API (+25 tests, 173 en total):** permisos nuevos `organizacion.puerta.supervisar` y `seguridad.usuario.{ver,crear,editar,eliminar}` (`01_catalogo.sql`); `GET/POST /usuarios`, `PATCH/DELETE /usuarios/:id`, `POST /usuarios/:id/pin` (PIN sorteado por el servidor, mostrado una sola vez, límite `max_usuarios`, D-19 con `rol.permisos_excedidos`, baja y regeneración cortan las sesiones) y `GET /roles`; `GET /puertas` trae el lector y si está en línea (3 min sin latido = sin conexión); `GET /eventos-acceso` filtra por `resultado`, `puerta_id`, `desde` y `hasta` y trae sitio y QR con su emisor; `GET /eventos-acceso/resumen` y `GET /qr-accesos/resumen` para los indicadores; `GET /sesiones/actual` trae `suscripcion` (plan y vencimiento). Seed demo: rol Guardia y PIN `DEMGRD1` (Guardia + Usuario, para probar la elección de rol).
- **App (237 tests, build web OK):** sistema de diseño completo del handoff (tokens propuestos, IBM Plex Sans y Mono empaquetadas, `ThemeData` claro y oscuro), todos los átomos, moléculas, organismos y plantillas con los nombres obligatorios, navegación por rol y breakpoint (`NavigationBar` / rail / rail extendido, destinos por permisos), y las pantallas C01–C10c y E01–E10b: bienvenida, ingreso con casillas de PIN y bloqueo con cuenta regresiva, elegir rol, inicio de usuario y tablero de administración, stepper de emisión, QR emitido (PNG 1080×1350; en web, Web Share API o descarga), Mis QR, Eventos, Perfil (tema oscuro recordado) y Administración (Puertas, Usuarios, nuevo/editar, PIN generado). Todo listado con sus cuatro estados; tablas en ≥ 1024.
- **Docs:** `sistema-diseno.md` y `guia-pantallas.md` reescritos sobre el handoff; D-19 cerrada en código.
- **Después de actualizar:** `flutter pub get` y `flutter gen-l10n` en `app/`; volver a correr `db/seeds/01_catalogo.sql` y `02_demo.sql` (permisos y guardia nuevos) y reiniciar la API.
- **Queda fuera de la rama:** alta y edición de sitios, puertas y dispositivos desde la app (el handoff dibuja "Nueva puerta", editar y eliminar en E10a, pero la API no tiene esos endpoints: HU-07, HU-08 y HU-10 siguen pendientes); el logo final; "Repetir último" se implementó prellenando el formulario (pendiente de confirmar con negocio, handoff §6); brillo de pantalla al mostrar el QR; revisión visual en dispositivo contra las capturas (los tests cubren comportamiento y layout en 360×800 y 1440×900, no el píxel).

## Lo que falta para un V1 usable

1. **Prueba de punta a punta:** API local con el seed `DEM`, la app y el firmware `esp32-dev` en la placa. Nunca se probaron las tres partes juntas.
2. **Revisión línea por línea de lo crítico** (CLAUDE.md): aislamiento por cuenta, validación y consumo del QR, autenticación de dispositivos y firmware de la cerradura. El núcleo se integró sin ella.
3. **Administración:** altas y gestión de cuentas, sitios, puertas y dispositivos. Usuarios y PIN ya están (rama `feature/diseno-pantallas`); el resto solo existe en el seed.
4. **Límites del plan** para dispositivos y usuarios (RF-10).
5. **Login del super admin** (usuario + contraseña) y **baja diaria de QR vencidos** (ADR 0008 §7).
6. **Seguridad de la API:** rate limit en las validaciones por dispositivo, CORS, límite de intentos del login compartido entre instancias (hoy en memoria) y detección de reuso de un refresh robado.
7. **Bitácora del bloqueo del login:** el ADR 0018 la pide, pero `bitacoras.accion` no tiene un valor para el bloqueo; hoy solo deja un `warn` en el log. Decidir si se agrega `bloqueado` al CHECK.
8. **Test del OpenAPI** contra el contrato publicado.
9. **App:** brillo de pantalla al mostrar el QR, compilación en iOS, revisión visual en dispositivo contra el handoff, y revisar que el token del QR viaje por `extra` de go_router (en web queda en el historial de la pestaña).
10. **Firmware:** confirmar la polaridad del sensor reed con el sensor real (`SENSOR_PUERTA_NIVEL_ABIERTA`), la CA para producción y el portal AP de aprovisionamiento; OTA queda fuera de V1.

## Pendiente de decidir o confirmar

- Dudas abiertas: `docs/modelo-datos/02-dudas-y-ambiguedades.md` (D-06, D-08, D-12 a D-24).
- Hex oficial del verde de marca (D-08).
- Servidor de producción y DNS (D-13): de eso dependen el `docker-compose.prod.yml` con TLS y la CA que embebe el firmware (hoy, ISRG Root X1 de Let's Encrypt).
- Modelo exacto del lector QR y detalle eléctrico de la cerradura: se confirman al comprar el hardware.
