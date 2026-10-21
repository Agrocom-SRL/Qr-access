# Estado del proyecto — AGROCOM Acceso

**Última actualización:** 2026-10-13 (rama `feature/lector-rs485`)

## Qué ya existe

- **Repo en GitHub** con `develop` como rama de integración, ramas protegidas, Dependabot (actions agrupadas) y auto-merge cuando `ci` queda en verde. Integrados: la base del proyecto (#1) y las actualizaciones de actions (#2, #4, #6, #7).
- **Kit de procesos** heredado de ACRECIA y adaptado al monorepo: `CLAUDE.md`, `CONTRIBUTING.md`, 14 agentes y 9 skills en `.claude/`, guardarraíles en `.claude/hooks/`, `bin/verify` por partes y workflows `ci.yml`, `auto-merge.yml` y `release.yml`.
- **Alcance V1 replanteado con el cliente** (rama `feature/alcance-v1`):
  - Dudas **D-01 a D-05 cerradas**: lector QR en la puerta con ESP32; QR generado por un usuario, de un solo uso y con vencimiento en el día; comunicación HTTPS sobre WiFi (sin RS485, Firebase ni MQTT); cerradura por pulso; sin red no se abre. Además se cerraron D-07, D-09, D-10 y D-11, que se resolvían con lo anterior.
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

## Panel web de administración (`web/`) — ramas `feature/web-*` (2026-10-12, sin PR)

Una cadena de ramas apiladas, cada una con su proceso (la última contiene todo): `web-base` (tokens, fuentes, i18next y assets del handoff, ADR 0022) → `web-componentes` (cliente HTTP y átomos a plantillas) → `web-ingreso-equipo` (login del super admin, perfil y equipo) → `web-planes` / `web-planes-ui` → `web-cuentas` / `web-cuentas-ui` → `web-suscripciones-cobranza` → `web-bitacora-resumen` → `web-docker` → `web-planes-crud` → `web-pines` / `web-pines-ui`.

- **Diseño:** `docs/diseno/web-admin/` (capturas A01–A12, estados PE y tokens). Tests de `web/` en `web/test/` (espejo de `src/`, alias `@/`).
- **Pantallas hechas:** ingreso, perfil, equipo, planes (con crear, editar y retirar), cuentas (lista, alta en 4 pasos con PIN de una sola vez, ficha con resumen, suscripción, sitios y puertas y bitácora), cobranza (con CSV), registrar pago, cambiar plan, resumen y bitácora. Cada listado tiene sus cuatro estados; tema claro y oscuro.
- **API nueva** (módulos `seguridad`, `suscripciones`, `bitacora` y `resumen`, rutas `/api/v1/plataforma/*`): login de super admin con refresco, equipo, cuentas (listar, validar código, crear con roles base y primer administrador, ficha, sitios y puertas), planes (listar, precios, crear, editar, retirar), suscripción (renovar con pago, **subir de plan** cobrando la diferencia, suspender y reactivar), pagos, cobranza, bitácora, resumen, **cambio del código de la cuenta** y **regeneración del PIN de un administrador**.
- **Migraciones nuevas:** `contrasena_temporal` y `usuario_roles.tenant_id` nulo (super admin), `planes.precio_anual`, `cuenta_datos_empresa`, `pagos`. Seeds: catálogo con los 3 planes y el rol Super admin; demo con el super admin `lucia.paz`.
- **Decisiones:** ADR 0022 (estructura del panel, i18next, cobranza manual, solo se sube de plan) y ADR 0023 (el hash del PIN ya no incluye el código de cuenta, para poder cambiarlo sin invalidar PIN).
- **Docker:** `docker compose --profile panel up -d --build` sirve el panel en :8081 con Nginx y proxy de `/api`.
- **Pendiente / a confirmar (ver `TODO(docs)` en el código):** comprobante adjunto del pago (falta el almacenamiento), correo y teléfono del administrador inicial (no hay columna), edición de los datos de empresa (sin diseño), lista de ciudades, vistas a 768 px sin diseño propio, QR con datos de cuenta/usuario/puerta/hora (ver conversación: hoy el QR es un token aleatorio de un solo uso, ADR 0008), CI que construya la imagen del panel.

## Rama `feature/web-cuentas-puertas` (2026-10-12, PR contra `develop`)

Sale de `develop` (ya con el panel #28, #29 y el QR propio #31):

- **API (+ tests, 337 en total):** cuentas nuevas quedan pendientes de pago; correo de la persona responsable; editar y eliminar cuentas; sitios y puertas gestionados por cuenta (`organizacion`, rutas `/plataforma/cuentas/:id/sitios` y puertas); `GET` de estadísticas del panel (cuentas por estado y plan, altas y cobrado por mes).
- **Web (133 tests):** diálogos para editar y eliminar cuenta, sitios y puertas; alta con correo del responsable; pantalla de estadísticas con gráficas (`recharts`); cobranza con resumen "por cobrar" y exportación a Excel (`exceljs`); registrar pago con cuentas pendientes; selector buscable (`react-select`), botón volver y migas.
- **Pendiente:** los `TODO(docs)` del panel (comprobante de pago, teléfono del administrador, lista de ciudades, ilustraciones faltantes); el chunk de `exceljs` pesa ~930 kB (se podría cargar bajo demanda).

### Segunda tanda de la rama (2026-10-12): comprobantes, pagos y fichas de cuenta

- **Solo Ethernet y vinculación remota de placas (ADR 0025, rama `feature/vinculacion-de-placas`):** las placas ya no llevan WiFi ni se programan una por una con la cuenta. Cada placa tiene su MAC y un código de vinculación que sortea el servidor al registrarla; AGROCOM la asigna a una puerta desde el panel (**Placas**: registrar, vincular, liberar, dar de baja) y la placa recibe su vínculo sola. Una placa puede pasar por varias cuentas: reasignarla crea otro dispositivo y revoca el anterior. API: tabla `placas` y `dispositivos.placa_id` (migraciones `…100001` y `…100002`), `POST /dispositivos/reclamar` (sin credencial, con límite de intentos) y `/plataforma/placas` (permisos `dispositivos.placa.*`), 23 tests nuevos. Firmware: sin WiFi, la placa sortea su clave, `lib/vinculo` y reclamo cada 30 s; sin vínculo no valida ningún QR. Panel web: pantalla Placas en es/en/pt. **Pendiente:** retirar `ultimo_rssi` cuando el latido deje de enviarlo.
- **Vinculación automática con confirmación física (ADR 0026, rama `feature/vinculacion-automatica`):** reemplaza el código por placa del ADR 0025. Todas las placas llevan el mismo binario (URL de la API de fábrica), se **anuncian solas** y aparecen en el panel como detectadas; el super admin elige cuenta y puerta y alguien **mantiene pulsado 5 s el pulsador de salida** de la placa (10 min de ventana, LED azul lento y beep) para confirmar. Migración `20261014100001_placas_por_anuncio.sql` (`placas` sin secretos y tabla `placas_anuncios`), `POST /dispositivos/anunciar` y `/confirmar`, `POST /plataforma/placas/:id/cancelar-vinculo` (se retiran `reclamar` y el alta de placas). Panel: Placas sin registrar, con estados Detectada / Esperando el botón / Vinculada. Seed demo sin puertas ni dispositivos y con `SET NAMES utf8mb4`. **Pendiente:** probarlo con la placa real.
- **Almacén de archivos (ADR 0024):** interfaz `Almacenamiento` + implementación en disco (volumen `archivos`), `POST/GET /plataforma/comprobantes` con el archivo crudo (JPG, PNG, WEBP o PDF hasta 5 MB, tipo por los bytes), tablas `comprobantes` y `pagos.banco/cuenta_destino/comprobante_id` (migraciones `…100008` y `…100009`). Transferencia y depósito exigen banco, cuenta y comprobante; el efectivo no.
- **Panel:** formulario de pago con banco, cuenta de destino y comprobante (vista previa), historial con "Ver comprobante"; ficha de cuenta con indicadores arriba (sitios y puertas enlazan a su pestaña) y "Persona responsable de la cuenta" propio; acciones por fila en Cuentas (ver, sitios y puertas, editar, eliminar); botón Editar en advertencia; Suscripción sin "Renovar" si está activa (muestra "Al día"); Equipo con editar y reactivar; Perfil en orden datos → tema → contraseña con nombre editable (`PATCH /plataforma/perfil`, `PATCH /plataforma/equipo/{id}` con `nombre` y `activo`); se quitó el aviso de precios de Planes; el botón de volver alinea igual con o sin migas.
- **Pendiente:** catálogo de bancos y cuentas de AGROCOM (hoy lista fija en `web/src/features/pagos/domain/pago.ts`), purga de comprobantes huérfanos, selector de idioma del panel (solo hay español), y revisar el plan de la cuenta demo (precio 0).

## Núcleo V1 integrado en `develop` (#14, #15, #16)

- **API (#15):** 16 migraciones (una por tabla) y `03-schema-sql.md` al día; seeds `01_catalogo` (permisos) y `02_demo` (cuenta `DEM`, solo desarrollo, ver `entornos.md`). `RepositorioDeCuenta` / `RepositorioDePlataforma` (tenant, soft delete, autoría y bitácora por construcción), argon2id, HMAC con pimienta, JWT y autenticación que falla cerrado. Módulos `seguridad` (login por PIN, refresco rotativo, rol activo, sesión actual con sus roles), `organizacion` (listar puertas), `suscripciones` (vigencia vía contrato), `accesos` (generar, listar y anular QR; validación con consumo atómico; eventos) y `dispositivos` (credencial, latido, configuración). 148 tests.
- **App (#16):** ingreso por PIN con elección de rol (también al reabrir), tablero por permisos, generación de QR para una o más puertas, visor y compartir PNG, listado con anulación y bitácora paginada. Cliente de la API escrito a mano con los `code` de error traducidos en el ARB. 156 tests; compila web y APK.
- **Firmware (#14):** contrato V1 estricto (abre solo con `abrir:true`, `motivo_code=acceso.permitido`, `evento_id` y `segundos` válidos), tope de apertura de 10 s, credencial del dispositivo en NVS, TLS con CA embebida (HTTP plano solo en `esp32-dev`), latido, configuración, NTP, watchdog, aprovisionamiento por serie e indicaciones por LED y buzzer. 69 tests nativos.
- **Después de actualizar `develop`:** `flutter pub get` y `flutter gen-l10n` en `app/` (las traducciones generadas no se versionan), `npm ci` en `api/`, copiar `JWT_SECRETO` y `PIN_PIMIENTA` de `.env.example` al `.env`, y migrar y sembrar la base de desarrollo (`entornos.md`, "Datos de desarrollo").

## Rama `feature/diseno-pantallas` (2026-10-09, pendiente de PR)

Aplica el handoff de diseño V1 (`docs/diseno/handoff/`, antes `design_handoff_agrocom_acceso/` en la raíz) a la app, y amplía la API para lo que esas pantallas necesitan:

- **API (+25 tests, 173 en total):** permisos nuevos `organizacion.puerta.supervisar` y `seguridad.usuario.{ver,crear,editar,eliminar}` (`01_catalogo.sql`); `GET/POST /usuarios`, `PATCH/DELETE /usuarios/:id`, `POST /usuarios/:id/pin` (PIN sorteado por el servidor, mostrado una sola vez, límite `max_usuarios`, D-19 con `rol.permisos_excedidos`, baja y regeneración cortan las sesiones) y `GET /roles`; `GET /puertas` trae el lector y si está en línea (3 min sin latido = sin conexión); `GET /eventos-acceso` filtra por `resultado`, `puerta_id`, `desde` y `hasta` y trae sitio y QR con su generador; `GET /eventos-acceso/resumen` y `GET /qr-accesos/resumen` para los indicadores; `GET /sesiones/actual` trae `suscripcion` (plan y vencimiento). Seed demo: rol Guardia y PIN `DEMGRD1` (Guardia + Usuario, para probar la elección de rol).
- **App (237 tests, build web OK):** sistema de diseño completo del handoff (tokens propuestos, IBM Plex Sans y Mono empaquetadas, `ThemeData` claro y oscuro), todos los átomos, moléculas, organismos y plantillas con los nombres obligatorios, navegación por rol y breakpoint (`NavigationBar` / rail / rail extendido, destinos por permisos), y las pantallas C01–C10c y E01–E10b: bienvenida, ingreso con casillas de PIN y bloqueo con cuenta regresiva, elegir rol, inicio de usuario y tablero de administración, stepper de generación, QR generado (PNG 1080×1350; en web, Web Share API o descarga), Mis QR, Eventos, Perfil (tema oscuro recordado) y Administración (Puertas, Usuarios, nuevo/editar, PIN generado). Todo listado con sus cuatro estados; tablas en ≥ 1024.
- **Docs:** `sistema-diseno.md` y `guia-pantallas.md` reescritos sobre el handoff; D-19 cerrada en código.
- **Después de actualizar:** `flutter pub get` y `flutter gen-l10n` en `app/`; volver a correr `db/seeds/01_catalogo.sql` y `02_demo.sql` (permisos y guardia nuevos) y reiniciar la API.
- **Queda fuera de la rama:** alta y edición de sitios, puertas y dispositivos desde la app (el handoff dibuja "Nueva puerta", editar y eliminar en E10a, pero la API no tiene esos endpoints: HU-07, HU-08 y HU-10 siguen pendientes); el logo final; "Repetir último" se implementó prellenando el formulario (pendiente de confirmar con negocio, handoff §6); brillo de pantalla al mostrar el QR; revisión visual en dispositivo contra las capturas (los tests cubren comportamiento y layout en 360×800 y 1440×900, no el píxel).

## Rama `feature/ajustes-visuales` (2026-10-09, pendiente de PR)

Sale de `develop` y corrige lo que se vio al comparar capturas del teléfono con el handoff:

- **Pantallas móviles:** hero de bienvenida con el nombre en dos líneas y el logo real (`app/assets/imagenes/logo_agrocom.png`, sobre placa blanca); casillas del PIN del mismo ancho; ícono QR blanco en el tablero; tarjetas de indicadores del administrador del mismo alto y sin notas en compacto; filtro de Mis QR con las cuatro pastillas enteras; "Anular" en rojo; diálogo de anular con ícono y detalle; barras de acciones con los botones pegados a la derecha; stepper con "Confirmar" completo; filas de Perfil con título en la clave; FAB con el verde del tema.
- **Roles, web y PIN:** elegir rol sin panel de marca y con tarjetas en fila; tablero web con tabla de últimos eventos; Administración en expandido va directo a Puertas o Usuarios; formulario de nuevo usuario más compacto; Perfil web sin botón de cerrar sesión a todo el ancho.
- **Idiomas:** `app_es.arb`, `app_en.arb` y `app_pt.arb` (texto neutro, sin voseo); fila "Idioma" en Perfil con banderas (`country_flags`) y opción de seguir al dispositivo; se recuerda lo elegido. El test de tuteo revisa solo el español.
- **Paquetes:** `country_flags` (banderas SVG) y `animations` (transiciones entre pantallas).
- **Docs:** `acceso_tokens.dart` del handoff pasó a `docs/diseno/handoff/tokens.md` (parámetros, no código).
- **Seed demo:** el administrador `DEMADM1` también tiene el rol Usuario (para ver la elección de rol); el plan se llama "Demo (desarrollo)". Volver a correr `db/seeds/02_demo.sql`.
- **Pendiente:** revisar en el teléfono; decidir si la barra inferior pasa a `google_nav_bar` (cambiaría el aspecto respecto al handoff); `pinput` para las casillas del PIN y `skeletonizer` para la carga serían los siguientes paquetes razonables.

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

- **Jerarquía de usuarios y ajustes tras el primer despliegue (2026-10-20):** propietario > dueño de casa > usuario de la casa, guardias por propietario, cupo, estadísticas, compartir PIN y cambios de textos y formularios. Propuesta sin implementar, con puntos abiertos y orden de ramas en `docs/gestion/jerarquia-de-usuarios.md`.

- Dudas abiertas: `docs/modelo-datos/02-dudas-y-ambiguedades.md` (D-06, D-08, D-12 a D-24).
- Hex oficial del verde de marca (D-08).
- Servidor de producción y DNS (D-13): de eso dependen el `docker-compose.prod.yml` con TLS y la CA que embebe el firmware (hoy, ISRG Root X1 de Let's Encrypt).
- Lector de la mesa: es RS485 (con Wiegand) detrás de un módulo TTL-RS485, cableado en `docs/hardware/README.md`. Falta confirmar su modelo, que lea QR, su velocidad y su formato de salida (rama `feature/lector-rs485`, sin PR). Detalle eléctrico de la cerradura: se confirma al comprar.
