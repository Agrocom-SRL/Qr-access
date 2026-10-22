# Estado del proyecto — AGROCOM Acceso

**Última actualización:** 2026-10-22 (rama `feature/diseno-jerarquia-y-cierre`, sin PR)

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

## Integrado en `develop` desde el 2026-10-13 (estado al 2026-10-22)

Lo que entró después de la versión anterior de este documento. Los números son PR de GitHub; las ramas sin número se citan por su nombre.

- **Ajustes del panel (rama `feature/ajustes-panel-web`):** tarjetas de plan en tres columnas y con el nombre visible; el uso por plan sale de Planes y pasa a una página Estadísticas (con las gráficas que estaban en el Resumen); el administrador inicial parte con el nombre de la persona responsable, sin interruptor; el pago de alta y el registro de pago parten en efectivo, con referencia opcional, sin banco ni cuenta de destino, y el depósito pasa a QR (migración `20261022100009`).
- **Integración final (#34-#36):** cierre de las ramas de trabajo que quedaban fuera de `develop`.
- **Ethernet y vinculación de placas (#37-#45):** la placa va por Ethernet, sin WiFi (ADR 0025). La vinculación automática con confirmación física (ADR 0026): la placa se anuncia sola y se confirma manteniendo 5 s el pulsador de salida. Lector RS485 con QR600. Tabla `asignaciones_puerta` (`20261015100001`).
- **Modo sin conexión, perfil propio, sesión persistente y accesos en vivo (#47-#55):** modo sin conexión de la app (ADR 0027), perfil propio y sesión persistente en la app, y accesos en vivo.
- **Release v1.0.0 y despliegue en producción (#47-#55):** `acceso.agrocom.com.bo` en el CT 120 (`docs/gestion/despliegue.md`). La primera prueba con un administrador real fue el 2026-10-20. Tags publicados: `v0.5.0`, `v1.0.0`, `v1.0.1` y `v1.0.2`.
- **Hora de Bolivia, textos y formularios (#57-#58):** la hora de la app y de la API sigue la zona de Bolivia; cambios de textos y formularios de la cuenta (nombre de la cuenta, NIT opcional, responsable con nombre y apellido; migración `20261021100001`).
- **Jerarquía de usuarios, ADR 0028 (#59-#61):** árbol Administrador → Titular → Miembro, con Guardia bajo un Administrador; un rol por usuario; unidades y `superior_id`; visibilidad por rama. Migraciones `20261022100001` a `20261022100004`.
- **Panel web (#64-#68):** varios Administradores por cuenta, árbol de la cuenta en la ficha, reasignar Guardias y unidades (solo AGROCOM, con bitácora) y tope de Miembros por Titular editable por cuenta.
- **App (#64-#68):** usuarios por nivel (el selector de rol solo lo ve el Administrador), unidad del Titular, baja en cascada con confirmación y tarjeta de cupo.
- **API (#64-#68):** jerarquía, cupo (cuentan todos los niveles; tope de Miembros por Titular), estadísticas de uso (inactivos, ruidosos y Titulares cerca del 80 % del cupo; informativas) y compartir el PIN con registro en la bitácora. Migración `20261022100005` (`max_miembros` por cuenta) y `20261022100006` (PIN compartido).
- **Estadísticas de uso (#67)** en la app (Administrador, con baja directa) y en el panel web (AGROCOM).
- **Compartir el PIN (#68):** botón Compartir junto a la creación o regeneración del PIN; cada envío queda en la bitácora.
- **Sin botón Copiar del PIN (#69):** Compartir es la única salida.
- **"Generar" en lugar de "emitir" (#71):** textos, nombres, base de datos y permiso. Migración `20261022100007` (`emitido_por` pasa a `generado_por`; `accesos.qr.emitir` pasa a `accesos.qr.generar`). Es un cambio incompatible para los clientes instalados.
- **Permiso `accesos.qr.generar_propio` (#72):** el Guardia genera solo su QR propio; no genera ni comparte QR de visitas.
- **Textos en inglés y portugués completos (#74, abierto):** sin integrar.
- **Rama `feature/diseno-jerarquia-y-cierre` (2026-10-22, sin PR):** este documento, las marcas de avance en `docs/gestion/jerarquia-de-usuarios.md` y el plan del release en `docs/gestion/release-jerarquia.md`. No publica nada ni cambia versiones.

## Lo que falta para un V1 usable (revisado 2026-10-22)

1. **Prueba de punta a punta:** la API, la app y el panel están en producción desde el 2026-10-20 (primera prueba con un administrador real). **Sin confirmar:** la placa real con la vinculación automática (ADR 0026) contra la API de producción.
2. **Revisión línea por línea de lo crítico** (CLAUDE.md y ADR 0028, Consecuencias): aislamiento por cuenta y por rama, validación y consumo del QR, autenticación de dispositivos, firmware de la cerradura y modelo de permisos. **Pendiente:** no consta como hecha.
3. **Administración:** en el panel web, cuentas, sitios (ahora Propiedades), puertas y placas (desde la integración final, #34-#36). En la app, usuarios, unidades, baja en cascada y cupo (#64-#68). **Pendiente:** alta y edición de propiedades, puertas y dispositivos desde la app (HU-07, HU-08 y HU-10).
4. **Límites del plan** (RF-10): **hecho para usuarios** (`max_usuarios` y tope de Miembros por Titular, #64-#68). **Pendiente para dispositivos.**
5. **Login del super admin** (usuario + contraseña): **hecho** en el panel. **Pendiente:** baja diaria de QR vencidos (ADR 0008 §7).
6. **Seguridad de la API:** rate limit en las validaciones por dispositivo, CORS, límite de intentos del login compartido entre instancias (hoy en memoria) y detección de reuso de un refresh robado. **Pendiente:** el historial #34-#74 no incluye estos puntos.
7. **Bitácora del bloqueo del login:** pendiente. El ADR 0018 la pide, pero `bitacoras.accion` no tiene un valor para el bloqueo; hoy solo deja un `warn` en el log.
8. **Test del OpenAPI** contra el contrato publicado: pendiente.
9. **App:** brillo de pantalla al mostrar el QR, compilación en iOS, token del QR en `extra` de go_router (en web queda en el historial de la pestaña) y **revisión visual en un entorno levantado** contra el handoff y las capturas (pendiente real; ver "Pendiente de decidir").
10. **Firmware:** confirmar la polaridad del sensor reed con el sensor real (`SENSOR_PUERTA_NIVEL_ABIERTA`) y la CA para producción (hoy ISRG Root X1). OTA queda fuera de V1. **Ya no aplica** el portal AP de aprovisionamiento: desde el ADR 0025 la placa va por Ethernet y se vincula sola (ADR 0026).

## Pendiente de decidir o confirmar

- **Jerarquía de usuarios (ADR 0028, 2026-10-20):** implementada en `develop` (#59-#68, #71 y #72). Quedan la revisión visual (pendiente real), el rótulo "Registrar pago" en cobranza (`docs/gestion/jerarquia-de-usuarios.md` §6.3) y los textos en/pt (#74, abierto). Las marcas por punto están en ese documento.
- **Release con cambio incompatible (versión 1.0.3, decidida por Miguel; reinicio de la base de producción aprobado):** plan en `docs/gestion/release-jerarquia.md`. **No se publicó tag ni se desplegó.** Pendiente de Miguel: la versión, el reinicio de la base de producción (borra cuentas, bitácora y `eventos_acceso` de la primera prueba; el respaldo es la única copia) y el aviso a los clientes con la app instalada.
- **Contradicción entre documentos:** ADR 0005 y la invariante 11 de `CLAUDE.md` prohíben un cambio incompatible dentro de la misma versión de la API; los cambios de #71 y #72 (nombres de permisos y campos en `/api/v1`) lo son para los clientes instalados. Decidir: excepción documentada en un ADR o `/api/v2`.
- **Versiones desfasadas:** `api/package.json`, `web/package.json` y `app/pubspec.yaml` siguen en 1.0.0 (+7), y `firmware/include/version.h` en 1.0.0, aunque existen los tags `v1.0.1` y `v1.0.2`. ADR 0014 dice que el tag fija la versión. Confirmar qué contienen `v1.0.1` y `v1.0.2`.
- Dudas abiertas: `docs/modelo-datos/02-dudas-y-ambiguedades.md` (D-06, D-08, D-12 a D-24). D-19 está cerrada en código desde `feature/diseno-pantallas`; falta reflejarlo en ese documento.
- Hex oficial del verde de marca (D-08).
- Servidor de producción y DNS (D-13): **resuelto en parte.** Producción corre en `acceso.agrocom.com.bo` (CT 120, NPMplus, `docs/gestion/despliegue.md`). Falta confirmar la CA que embebe el firmware (hoy, ISRG Root X1 de Let's Encrypt).
- Lector de la mesa: el lector RS485 con QR600 entró en #37-#45 según el historial; falta confirmar su formato de salida con el hardware real. Detalle eléctrico de la cerradura: se confirma al comprar.
