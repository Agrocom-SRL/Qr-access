# Plan maestro — AGROCOM Acceso

> **Limpieza de ramas y próxima versión (anotado el 2026-10-23, pendiente de ejecutar).** Antes de lanzar la siguiente versión hay que depurar las ramas, con `bin/estado-plan` como guía y la confirmación de Miguel:
> - **Integradas** (su PR figura como MERGED): borrar las ramas locales marcadas `gone` y las remotas sobrantes (`feature/reiniciar-base-local`, `feature/version-1.0.3`). No se pierde trabajo: está en `develop`.
> - **No integradas** (PR cerrado sin merge, como #46, #62, #63, #70, #73 y #77, o ramas locales con commits que no están en `develop`): revisar una por una; cada una se rescata en una rama nueva desde `develop` o se descarta de forma explícita. Nada se borra a ciegas.
> - Después: podar `estado_proyecto.md` (§4.5 de este plan) y lanzar la versión (ola W-REL: tag del lanzamiento, versión propia de cada componente (api, web, app y firmware; ADR 0014, modificado el 2026-10-27) y fila nueva en su registro, despliegue con `bin/desplegar`).

**Qué es:** el único registro de *qué se hizo, qué está en curso y qué falta*, y el prompt maestro con el que cada sesión (humana o de un agente) retoma el trabajo. `estado_proyecto.md` queda como narrativa y relevo; **este archivo manda sobre el estado**. Última verificación contra GitHub: 2026-10-23 (`develop` en `09fad26`, #83).

## 1. Cómo se mantiene consistente

1. **Un solo registro.** El estado de cada ítem vive en la tabla del §4. Si `estado_proyecto.md` o un ADR dicen otra cosa, gana esta tabla y se corrige el otro.
2. **Se actualiza dentro del mismo PR** que hace el trabajo: el ítem pasa a «En PR #N» al abrirlo. La sesión siguiente lo pasa a «Integrado #N» después de comprobarlo con `bin/estado-plan` (nunca de memoria).
3. **`bin/estado-plan` es la fuente de verdad del estado real:** consulta GitHub y git, compara con esta tabla y marca las diferencias (PR citado que no está integrado, ramas viejas, trabajo sin PR).
4. **Estados permitidos:** `Integrado #N` · `En PR #N` · `En rama` (código sin PR) · `Documentado` (ADR aceptado, sin código) · `Propuesta` (ADR sin aceptar) · `Pendiente` · `Futuro` · `Descartado`.
5. **Una ola = una rama = un PR** (nombre `feature/<corto>`), con el orden y las dependencias del §4. No se empieza una ola con la anterior sin integrar.
6. **Ramas:** al integrar un PR se borra su rama (remota y local). `bin/estado-plan` lista las que sobran; el borrado lo confirma Miguel.

## 2. Prompt maestro

Pégalo al empezar una sesión, o úsalo como brief del agente `orquestador`.

```text
Eres el orquestador de AGROCOM Acceso. Responde en español.

ANTES DE TOCAR NADA
1. Lee CLAUDE.md y docs/gestion/plan-maestro.md (§4 es el registro de trabajo).
2. Ejecuta bin/estado-plan y dime en 5 líneas: rama actual, qué está integrado desde el último
   release, qué hay en curso y qué diferencias hay entre el plan y GitHub. Si el plan miente,
   corrígelo primero (es lo único que puedes editar sin pedirlo).
3. Verifica la rama (git branch --show-current). Nunca trabajes en master, main ni develop: crea
   la rama de la ola desde develop actualizado. Carga el skill flujo-git-pr.

ELEGIR EL TRABAJO
4. Toma el primer ítem «Pendiente» del §4 cuyas dependencias estén «Integrado». Si el usuario pidió
   otro, dilo en una línea y sigue lo pedido. Si algo del ítem está marcado «Propuesta» o con una
   decisión abierta, pregúntame antes de implementarlo; no decidas por mí.

EJECUTAR (en este orden; solo los agentes que el ítem necesite)
5. arquitectura (si hay duda de dónde va) → modelo-datos → backend → api-rest → modulos-roles →
   app-flutter / web-react / firmware → auditor-seguridad → validador.
   Cada agente carga los skills que su ficha indica (generacion-qr-segura, limites-y-abuso,
   seguridad-plataforma, seguridad-roles, codigo-limpio, verificacion, ...).
6. Reglas que no se negocian: las 12 invariantes de CLAUDE.md. En especial: validar un QR nunca se
   limita; la puerta no abre sin validación positiva; SQL parametrizado; todo por el repositorio
   de cuenta; textos solo en ARB y l10n; errores como códigos.
7. Cada acción nueva lleva sus tests (aislamiento por cuenta incluido) y los de los skills.

CERRAR
8. bin/verify de las partes tocadas debe pasar entero. Si falla, dilo con la salida; no lo
   esquives ni toques la configuración para que pase.
9. Actualiza en el mismo cambio: el ítem en el §4 (estado, rama, PR), los ADR afectados y, solo si
   hubo un hallazgo o un relevo, estado_proyecto.md.
10. Commits en español, imperativo, sin Co-Authored-By ni atribuciones, uno por grupo de archivos
    con el mismo propósito. NO hagas push, PR ni merge sin que yo lo confirme.
11. Cierra con: qué quedó hecho y verificado, qué no se hizo, qué sigue en el plan y qué decisión
    espero de mí.
```

## 3. Dónde está cada cosa

| Necesito saber… | Archivo |
|---|---|
| Qué se hizo y qué falta | este archivo, §4 |
| Estado real contra GitHub | `bin/estado-plan` |
| Por qué se decidió algo | `docs/decisiones/NNNN-*.md` |
| Relevo y hallazgos de una sesión | `docs/gestion/estado_proyecto.md` |
| Qué hace falta para un V1 usable (histórico) | `estado_proyecto.md`, «Lo que falta para un V1 usable» |
| Cómo se despliega y se publica | `despliegue.md`, `entornos.md`, `release-jerarquia.md`, ADR 0014 |
| Qué agente hace qué | `.claude/agents/README.md` |

## 4. Registro de trabajo

### 4.1 Integrado (verificado con GitHub el 2026-10-26)

| Bloque | ADR | PR | Estado |
|---|---|---|---|
| Base del monorepo, núcleo V1, panel web inicial | 0001–0016, 0021, 0022 | #1–#44 | Integrado |
| Vinculación automática de placas, lector QR600 | 0025, 0026 | #45, #47 | Integrado |
| Modo sin conexión, perfil propio, sesión web persistente, estado del QR | 0027, 0022 | #48–#53 | Integrado |
| Primer despliegue a producción (v1.0.0) y correcciones | 0010, 0014 | #54–#57 | Integrado |
| Jerarquía de usuarios (API, panel, app, estadísticas, compartir PIN) | 0028 | #59–#69 | Integrado |
| «Generar» en vez de «emitir»; QR propio del Guardia; textos en/pt | 0028 | #71, #72, #74 | Integrado |
| Diseño de la jerarquía, Titular sin selector, PIN en el panel | 0028 | #75, #76 | Integrado |
| App web bajo `/app/`, `bin/reiniciar-local` | 0010 | #78, #79 | Integrado |
| Plan único de 100 usuarios, versión 1.0.3 en el código | 0017 | #80 | Integrado |
| Panel: estadísticas, planes, alta de cuenta, pagos por QR | 0017, 0024 | #81 | Integrado |
| Cuentas de cobro y responsive del filtro | 0029 | #82 | Integrado |
| Relevo de la sesión del 22 de octubre | — | #83 | Integrado |
| **W0** — Documentación de límites, abuso, seguridad y plan | 0030–0033 | #84 | Integrado |
| `bin/reiniciar-local`, deploy manual fijado a master, versiones 1.0.4 y 1.0.5 | 0014 | #86, #90, #91, #94 | Integrado |
| iOS, paquete unificado, privacidad y términos | — | #92 | Integrado |
| MariaDB 10.11 y producción sobre la base compartida | 0034 | #93 | Integrado |

Cerrados sin integrar (no cuentan): #46, #62, #63, #70, #73, #77. Último tag: **v1.0.5** (`c852c37`, igual a `develop`). Los PR de Dependabot #85, #87–#89 también están cerrados.

### 4.2 Integradas: olas W1 a W14 (2026-10-27)

Las olas W1 a W14 se integraron en `develop` el 2026-10-27 con el PR [#110](https://github.com/Agrocom-SRL/Qr-access/pull/110) (rama `feature/integracion-olas`, squash `6204a64`). El repo no admite merge commit, por eso entraron en un solo PR en vez de #95 a #109, que se cerraron como «integrado vía #110». Las ramas `claude/…` se borraron del remoto. El orden, los conflictos y los pasos manuales siguen en `docs/gestion/integracion-de-olas.md`.

| Ola | PR | Rama | Estado |
|---|---|---|---|
| W1 (API) | [#95](https://github.com/Agrocom-SRL/Qr-access/pull/95) | `claude/w1-api` | Integrada (#110) |
| W1 (distribución) | [#96](https://github.com/Agrocom-SRL/Qr-access/pull/96) | `claude/w1-distribucion` | Integrada (#110) (sin el parche de `ci.yml`: ver el PR) |
| W2 | [#97](https://github.com/Agrocom-SRL/Qr-access/pull/97) | `claude/w2-ci-seguridad` | Integrada (#110) (el workflow queda en `docs/ci/propuestos/`) |
| W3 | [#98](https://github.com/Agrocom-SRL/Qr-access/pull/98) | `claude/w3-limites-http` | Integrada (#110) (incluye la corrección del 503 con cliente real) |
| W4 | [#99](https://github.com/Agrocom-SRL/Qr-access/pull/99) | `claude/w4-estados` | Integrada (#110) |
| W5 | [#100](https://github.com/Agrocom-SRL/Qr-access/pull/100) | `claude/w5-topes` | Integrada (#110) |
| W7 | [#101](https://github.com/Agrocom-SRL/Qr-access/pull/101) | `claude/w7-ventana-repeticion` | Integrada (#110) |
| W6 | [#102](https://github.com/Agrocom-SRL/Qr-access/pull/102) | `claude/w6-idempotencia` | Integrada (#110) |
| W8 | [#103](https://github.com/Agrocom-SRL/Qr-access/pull/103) | `claude/w8-sesiones` | Integrada (#110) (API y base) |
| W9 | [#104](https://github.com/Agrocom-SRL/Qr-access/pull/104) | `claude/w9-notificaciones` | Integrada (#110) (API y base) |
| W10 | [#105](https://github.com/Agrocom-SRL/Qr-access/pull/105) | `claude/w10-confirmaciones` | Integrada (#110) (API, firmware y panel) |
| W11 | [#106](https://github.com/Agrocom-SRL/Qr-access/pull/106) | `claude/w11-incidentes` | Integrada (#110) (API y base) |
| W12 | [#107](https://github.com/Agrocom-SRL/Qr-access/pull/107) | `claude/w12-senales` | Integrada (#110) (API y panel) |
| W13 | [#108](https://github.com/Agrocom-SRL/Qr-access/pull/108) | `claude/w13-carga` | Integrada (#110) (scripts k6; sin corrida en entorno real) |
| W14 + integración | [#109](https://github.com/Agrocom-SRL/Qr-access/pull/109) | `claude/w14-lecturas` (contiene `claude/integracion-olas`) | Integrada (#110) |

**Pendiente tras la integración** (no se hizo): W1b (cookie `HttpOnly` del refresco: toca la autenticación, pide revisión línea por línea); pantallas de la app y el panel para W8 (dispositivos conectados), W9 (bandeja de la cuenta en la app), W11 (incidentes, anulación masiva y exportación) y ajustes finales; correr `pio run` y `pio test -e native` y la prueba en banco del firmware (polaridad del reed); la corrida de carga en un entorno de prueba real y el ajuste de umbrales; W-REL (versión y despliegue).

### 4.3 Olas (en orden; cada una = una rama y un PR)

| Ola | Qué entrega | ADR | Depende de | Agentes | Estado |
|---|---|---|---|---|---|
| **W1** | `Cache-Control: no-store` + `Vary: Authorization` en toda la API, cabeceras de seguridad, CSP/HSTS/`nosniff`, NPMplus sin caché en `/api/`, redacción ampliada de logs, esquemas estrictos, regla de lint contra SQL con plantillas, test de la URL con `.js` | 0033 §2 | W0 | backend, distribucion, web-react, auditor-seguridad | Integrado #110 (rama `claude/w1-api` y `claude/w1-distribucion`; PR sin merge, a revisión de Miguel). Pendiente de W1: autohospedar canvaskit, `Icono.tsx` con `dangerouslySetInnerHTML` (vigilado), límites de borde de NPMplus (W3) |
| **W1b** | Refresco de las apps web en cookie `__Host-refresco` (`HttpOnly`, `SameSite=Strict`), cabecera `X-Requested-With` y comprobación de `Origin` en refresco y cierre de sesión; la app nativa sigue por cuerpo; pruebas de CSRF (otro origen, sin cabecera, sin cookie) | 0033 §5 | W1 | modulos-roles, backend, api-rest, web-react, app-flutter, auditor-seguridad | Pendiente (revisión línea por línea: toca la autenticación) |
| **W2** | CI de seguridad: `npm audit`, escaneo de secretos, CodeQL | 0033 §2 | W0 | distribucion | Integrado #110 (rama `claude/w2-ci-seguridad`, sin merge). El workflow `seguridad.yml` queda en `docs/ci/propuestos/` porque el token de la sesión no puede escribir en `.github/workflows/`: Miguel debe copiarlo (ver el README de ese directorio). Decisiones de Miguel: que bloquee o solo informe, activar GHAS/secret scanning, licencia de `buffers@0.1.1` |
| **W3** | `@fastify/rate-limit` por ruta, dos pools de MySQL, `queueLimit`, tiempos escalonados, `503` con `Retry-After`, reintento único ante deadlock | 0030 §3, 0032 §1–2 | W1 | backend, distribucion | Integrado #110 (rama `claude/w3-limites-http`, apilada sobre W1). Supuestos: tamaños de pool, colas, esperas y límites por minuto son valores propios configurables por variable de entorno; si salta el `handlerTimeout` tras consumir el QR, la placa recibe 503 y el QR queda consumido (lo cubre la ventana de W7); límites en memoria de una sola instancia |
| **W4** | Estados `restringido`/`suspendido`/`eliminado` en usuarios y cuentas, cascada por rama, el generador (y sus superiores) comprobado al validar, permisos nuevos | 0031 §0–2, 0033 §1 | W1 | modelo-datos, modulos-roles, backend, api-rest | Integrado #110 (rama `claude/w4-estados`, apilada sobre W3). Decisión D-25: restringir también arrastra a la rama. Solo API y base: faltan en app y panel las pantallas y textos de estado (códigos `qr.generacion_restringida`, `estado.impuesto_por_superior`, `estado.cambio_concurrente`, `sesion.usuario_suspendido`, `sesion.cuenta_suspendida`, `qr.generador_suspendido`, `qr.cuenta_suspendida`). Se cierra en W5 la ventana de `generar-qr` frente a una suspensión concurrente |
| **W5** | Topes de generación (`qr.limite_diario`, `qr.limite_pendientes`, bolsa mensual), QR propio reutilizable, `reutilizado`, límite de puertas por QR, configuración de topes | 0030 §2, §2.1, §7, 0031 §9 | W3, W4 | modelo-datos, backend, api-rest | Integrado #110 (rama `claude/w5-topes`, apilada sobre W4). Solo API y base. Supuestos D-26 a D-28 (topes iniciales 100 diarios, 50 pendientes, bolsa 5000/mes; día y mes en `America/La_Paz`). `POST /qr-accesos` puede responder 200 con `reutilizado: true` y `texto: null` (cambio de tipo, ADR 0030 §2.1): la app ya se adaptó en esta rama (token propio en almacén seguro, consulta de estado, reintento con `reemplazar`, textos de los códigos nuevos). Pendiente: pantalla de límites y planes en el panel, idempotencia (W6) |
| **W6** | `Idempotency-Key` y caché de reintento en la app | 0031 §11 | W5 | backend, api-rest, app-flutter | Integrado #110 (rama `claude/w6-idempotencia`, apilada sobre W5). `Idempotency-Key` opcional en `POST /qr-accesos` (16–128 caracteres, TTL 24 h, `idempotencia.conflicto` 422 y `idempotencia.en_curso` 409); el token del QR se deriva por HMAC y nunca se guarda; la app reintenta con la misma clave. Supuestos: solo la operación `qr.generar`; limpieza física de claves vencidas (caché, excepción a la invariante 8) |
| **W7** | Ventana de repetición de 15 s, registro sin ruido (`repetido_de_id`), antirrebote del firmware | 0032 §3–4 | W3 | modelo-datos, backend, firmware | Integrado #110 (rama `claude/w7-ventana-repeticion`, apilada sobre W5). Decisión de Miguel: 15 s de ventana. Solo un `permitido` se repite y solo por el mismo lector; rechazos idénticos en 60 s se enlazan con `repetido_de_id`. Firmware: antirrebote de 3 s desde la respuesta (1 s tras fallo); `pio test -e native` sin ejecutar en este entorno, debe correrse en CI. Pendiente: detalle de repeticiones y paneles de app y web |
| **W8** | Sesiones por instalación y plataforma, lista de dispositivos conectados, cerrar sesiones | 0030 §4.1 | W4 | modelo-datos, modulos-roles, backend, app-flutter, web-react | API y base en PR (rama `claude/w8-sesiones`, apilada sobre W5). Topes 10 por usuario y 5 por instalación y actividad cada 5 min (supuestos propios, configurables); cerrar todas las sesiones de un usuario anula sus QR. Pendiente: pantalla de dispositivos conectados en la app y el panel (la app debe generar y enviar `instalacion_id`), columna de sesión de origen del QR y avisos por patrones (W12) |
| **W9** | Bandeja `notificaciones` + *outbox*; estados de placa (caída sostenida a 15 min, desaparecida a 2 h, en observación, lector sin respuesta) con avisos agrupados por sitio | 0030 §6, 0031 §18 | W3 | modelo-datos, backend, web-react, app-flutter | API y base en PR (rama `claude/w9-notificaciones`, apilada sobre W5). Bandeja de notificaciones (cuenta y AGROCOM) y cola de entrega solo in-app; estados de placa por latido (15 min, 2 h, histéresis de 3 min, lector sin respuesta a 5 min, observación a 24 h). Supuestos propios configurables; push y correo reservados sin proveedor. El firmware aún no envía `lector_responde` (W10). Pendiente: pantallas de bandeja en app y panel y avisos de la bolsa de QR |
| **W10** | Firmware: latido ampliado (lector y sensor) y `confirmaciones_apertura`; panel con el éxito o la falla de la ejecución | 0031 §18 | W9 | firmware, backend, web-react | Integrado #110 (rama `claude/w10-confirmaciones`, apilada sobre W9). API: `confirmaciones_apertura`, `POST /dispositivos/confirmaciones`, detector `apertura.fallida` (2 fallas en 60 min, plazo de 90 s; supuestos propios), campo `ejecucion` en los eventos. Firmware y panel (ejecución, salud de placas, sensor, bandeja de AGROCOM) incluidos. **La polaridad del reed sigue sin confirmar en campo** (valor por omisión `alto`, configurable por placa). `pio run`/`pio test -e native` y la prueba en banco quedan pendientes (CI); la CSP del panel debe validarse al unirse con W1. Pendiente: app Flutter (bandeja y estados) |
| **W11** | Anulación masiva, incidentes de uso y reincidencia, exportación para la cuenta | 0031 §3, 0033 §3–4 | W4, W9 | modelo-datos, modulos-roles, backend, app-flutter, web-react | API y base en PR (rama `claude/w11-incidentes`, apilada sobre W10). Anulación masiva por lotes, incidentes de uso con reincidencia que propone (el automático leve, apagado por omisión, solo toca Miembro y Guardia y exige contraste de registradores), exportación CSV paginada con tope. **Decisión D-29 (Miguel, 2026-10-27):** el Administrador ve y actúa solo sobre su rama (ADR 0028 §4), nunca sobre otro Administrador de la cuenta ni su rama; la cuenta entera y los Administradores son solo del super admin. Rutas de plataforma para AGROCOM (`/plataforma/cuentas/{id}/…`: anulación masiva, resolución de incidentes y exportación; rama `feature/api-plataforma-w11`). Pendiente: pantallas en app y panel (incidentes, anulación masiva, exportación), textos de `incidente.fecha_antigua`, `incidente.tope_diario` y `estado_motivo` `incidente.reincidencia:<id>`, retención y trazabilidad lote→QR |
| **W12** | Señales nuevas de abuso y vista de AGROCOM en el panel (consumo de la bolsa, flujo atípico) | 0030 §4–5 | W5, W8, W11 | backend, web-react | Integrado #110 (rama `claude/w12-senales`, apilada sobre W11). Seis detectores (uso masivo, uso imposible, QR reenviado, PIN compartido por IP, bolsa 80 %/100 % y flujo atípico) que solo observan y avisan, y vista de AGROCOM en el panel (consumo de bolsa, señales, flujo). Umbrales propios en `configuracion_limites`. **Tareas de integración pendientes** (ver ADR 0030, ola W12, y D-37): al integrar W7 contar aperturas DISTINTAS y exigir intentos no repetidos en `qr_reenviado`; al integrar W8 sumar instalaciones al PIN compartido. Pendiente: señales "ciclo generar-usar", "altas en ráfaga" y "tasa de uso", y mostrar `incidente.propuesta` (W11) en la bandeja del panel |
| **W13** | Prueba de carga con k6 en un entorno de prueba y ajuste de umbrales | 0030 §3, 0032 | W3–W7 | distribucion, auditor-seguridad | Integrado #110 (rama `claude/w13-carga`, apilada sobre W12). Escenarios k6 (validación de QR, saturación de usuarios con validación concurrente, generación, login, latidos y confirmaciones, rampa y soak), preparación de datos con guardas contra producción y documento `pruebas-de-carga.md`. Cifras orientativas de sandbox, **no representativas**; falta la corrida en un entorno de prueba real y el ajuste de umbrales con esos datos. **Hallazgo grave de las pruebas:** la validación de QR respondía 503 con cualquier cliente HTTP real (señal abortada en Node 22); se corrige en la rama de W3 (ver PR). Pendiente: corregir `usuarios.activo` en `bin/desplegar` y `bin/reiniciar-local` |
| **W14** | Renombrar `eventos_acceso` a **`lecturas`** (decisión de Miguel, 2026-10-26/27), migración y PR propios, al final | 0032 §5 | W7, W10 | arquitectura, modelo-datos, backend | Integrado #110 (rama `claude/w14-lecturas`, sobre la rama de integración). `RENAME TABLE` atómico con índices y claves foráneas renombrados (probado con 200 000 filas y un escritor concurrente: 48 ms, sin pérdida), rutas alias `/lecturas` y `/plataforma/lecturas` con las antiguas deprecadas (retiro propuesto 2027-06-30, **a confirmar**), textos en web y app, documentación, skills y `CLAUDE.md`. Quedan sin renombrar, por compatibilidad, los campos JSON `evento_*`, el código `evento.no_encontrado` y los permisos `accesos.evento.*` (para una `v2`). **Ventana de despliegue:** detener la API, migrar y arrancar la nueva versión (ver `despliegue.md`) |
| **AM0** | Documentación de la apertura manual: ADR 0035, invariante 2 y RF-02/RF-11/RF-12, fichas 12, 13, 16, 32 y 38, `03-schema-sql.md`, hardware y este plan | 0035 | W10 | arquitectura, modelo-datos, negocio | En rama `feature/apertura-manual` |
| **AM1** | Base y API: `dispositivos.sentido` (hasta 2 placas por puerta), `puertas.apertura_manual_entrada` y `_salida`, `lecturas` con método `manual`, `usuario_id` y `sentido`, `ordenes_apertura`, permisos y topes, `POST /puertas/{id}/abrir`, configuración por puerta y rutas de la placa (`GET /dispositivos/ordenes` con petición larga, `POST …/resultado`), proceso que vence órdenes | 0035, 0030 §3 | AM0 | modelo-datos, backend, api-rest, modulos-roles, auditor-seguridad | Pendiente |
| **AM2** | Firmware: lazo de órdenes (petición larga), pulso del relé, plazo relativo, sentido y resultado; tests nativos. Revisión línea por línea | 0035, 0009 | AM1 | firmware, validador | Pendiente |
| **AM3** | App Flutter: botón «Abrir puerta» (entrada/salida), pantalla del administrador, historial «Apertura manual»; perfil → Acerca de con Términos y Privacidad dentro de la app | 0035, 0012, 0013 | AM1 | app-flutter | Pendiente |
| **AM4** | Panel web: estadísticas del modo manual (usos, por puerta y cuenta, frecuencia, cuentas activas, fallos) y señales de abuso; login con enlaces a Términos y Privacidad; gestión de las dos placas por puerta | 0035, 0030 §4, 0021 | AM1 | web-react | Pendiente |
| **W-REL** | Release de cada ola: tag del lanzamiento, versión propia de cada componente (api, web, app y firmware; ADR 0014, modificado el 2026-10-27) y fila nueva en su registro, despliegue con `bin/desplegar` | 0014 | lo que Miguel decida | distribucion | v1.0.5 publicado; los siguientes, por decisión de Miguel. Antes de un release: variables nuevas obligatorias (`QR_IDEMPOTENCIA_CLAVE`, `TRUST_PROXY`), parche de `ci.yml`, `seguridad.yml`, NPMplus, firmware con `pio` en CI (ver `integracion-de-olas.md`) |

Ideas aceptadas como futuro (no se implementan sin pedido del cliente): puerta sensible, etiqueta obligatoria por política, reautenticación, aprobación.

### 4.4 Pendientes anteriores (heredados de `estado_proyecto.md`, sin ola)

Siguen vigentes; se asignan a una ola cuando Miguel los priorice. Detalle en `estado_proyecto.md`, «Relevo de la sesión del 2026-10-22» y «Lo que falta para un V1 usable».

- Ver los cambios del panel en un navegador y recorrer los flujos nuevos; responsive de Cobranza, Eventos y Placas.
- Revisión línea por línea de lo crítico (aislamiento, QR, dispositivos, firmware de la cerradura, permisos).
- Despliegue a producción de las migraciones `100008`–`100010` y carga real de cuentas de cobro.
- Contradicción ADR 0005 / invariante 11 por los cambios incompatibles de #71, #72 y #81.
- Límite del plan para dispositivos; baja diaria de QR vencidos (ADR 0008 §7); bitácora del bloqueo del login; test del OpenAPI contra el contrato.
- Confirmar la placa real con la vinculación automática contra producción, la CA del firmware y el formato de salida del lector.
- Dudas abiertas D-06, D-08, D-12 a D-24 (`docs/modelo-datos/02-dudas-y-ambiguedades.md`).

### 4.5 Higiene de la documentación (pendiente)

`estado_proyecto.md` conserva secciones antiguas «pendiente de PR» (ramas `feature/web-*`, `feature/diseno-pantallas`, `feature/ajustes-visuales`) que ya están integradas, y dice que las versiones siguen en 1.0.0 cuando #80 las subió a 1.0.3. Hay que podarlas o archivarlas en un PR de documentación aparte, con la confirmación de Miguel.
