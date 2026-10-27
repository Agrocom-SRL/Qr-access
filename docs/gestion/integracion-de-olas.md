# Integración de las olas W1 a W12

Ensayo de integración hecho en la rama `claude/integracion-olas` (sin PR, nada hacia `develop`). Sirve para que Miguel sepa de antemano qué conflictos habrá al integrar los PR #95 a #107, cómo se resuelven y qué verificar después. Todo lo descrito aquí está en esa rama: se puede abrir un solo PR desde ella (ver el orden recomendado).

## 1. Grafo de ramas y PR

Todos los PR apuntan a `develop` (base `c852c37`, v1.0.5), pero las ramas están **apiladas por contenido**: cada una arrastra los commits de las anteriores.

| PR | Rama | Sale de |
|---|---|---|
| #95 | `claude/w1-api` | develop |
| #96 | `claude/w1-distribucion` | develop (aparte) |
| #97 | `claude/w2-ci-seguridad` | develop (aparte) |
| #98 | `claude/w3-limites-http` | w1-api |
| #99 | `claude/w4-estados` | w3 |
| #100 | `claude/w5-topes` | w4 |
| #102 | `claude/w6-idempotencia` | w5 (hermana) |
| #101 | `claude/w7-ventana-repeticion` | w5 (hermana) |
| #103 | `claude/w8-sesiones` | w5 (hermana) |
| #104 | `claude/w9-notificaciones` | w5 |
| #105 | `claude/w10-confirmaciones` | w9 |
| #106 | `claude/w11-incidentes` | w10 |
| #107 | `claude/w12-senales` | w11 |

```
develop ─ w1-api(#95) ─ w3(#98) ─ w4(#99) ─ w5(#100) ─┬─ w9(#104) ─ w10(#105) ─ w11(#106) ─ w12(#107)
   │                                                   ├─ w6(#102)
   │                                                   ├─ w7(#101)
   │                                                   └─ w8(#103)
   ├─ w1-distribucion(#96)
   └─ w2-ci-seguridad(#97)
```

## 2. Orden recomendado para integrar

Los PR no tienen base apilada, así que cada uno muestra en GitHub todos los commits de su cadena. Hay dos caminos.

**Camino simple (recomendado, un solo PR):** abrir un PR de `claude/integracion-olas` hacia `develop` y integrarlo con **merge commit** (no squash, no rebase). Como la rama contiene los commits de todas las ramas de ola, GitHub marca como integrados los PR #95 a #107 por sí solos (sus commits ya están en `develop`); cierra a mano cualquiera que quede abierto. Los 4 conflictos de contenido ya están resueltos en la rama y la cascada pasó sobre el resultado (sección 6).

**Camino por PR, si prefieres revisar ola por ola** (cada paso con merge commit, y tras cada uno `git merge develop` en la rama siguiente):

1. #95 (w1-api), luego #98, #99, #100 (la cadena W3 a W5): sin conflictos entre sí.
2. #96 (w1-distribucion) y #97 (w2): independientes. **#97 choca con #96 en `docs/gestion/despliegue.md` y `plan-maestro.md`** (solo documentos; ver 3).
3. #104, #105, #106, #107 (W9 a W12): sin conflictos en la cadena.
4. Las tres hermanas **#102 (W6), #101 (W7), #103 (W8)** al final, una por una: cada una choca con lo anterior (W6 con W11 en `accesos/repository.ts`, W7 con W10 y W12 en listados de eventos, W8 con W11 y W12 en permisos y seed).
5. Ya integradas las tres, aplicar el commit de integración `cuenta aperturas e intentos distintos...` y los ajustes de pruebas (secciones 3 y 5): sin ellos, `vitest` falla en 6 pruebas y las señales de W12 cuentan mal.

Si se integra por PR, rebasar o fusionar `develop` en cada rama antes de su merge; el camino simple evita repetir 5 resoluciones de conflictos.

## 3. Conflictos reales encontrados y su resolución

Fusión hecha sobre la base `claude/w12-senales` (que ya contiene W1-api, W3, W4, W5, W9, W10, W11 y W12). `w1-api`, `w3`, `w4`, `w5`, `w9`, `w10`, `w11` y `w12` dieron «Already up to date» (el merge de `w1-api` solo trajo el commit que quita el enlace `node_modules` colado, sin diferencia de contenido).

| Merge | Archivo | Conflicto | Resolución |
|---|---|---|---|
| w1-distribucion | (ninguno) | Limpio | — |
| w2-ci-seguridad | `docs/gestion/despliegue.md` | Dos secciones nuevas en el mismo punto: «Borde: NPMplus, caché y cabeceras» (W1) y «Hallazgos de seguridad» (W2) | Se conservan ambas, una tras otra |
| w2-ci-seguridad | `docs/gestion/plan-maestro.md` | La fila W2 (estado «En PR») frente a las filas W3, W4, W5 con su estado | Fila W2 de la rama w2; filas W3 a W5 de la base |
| w6-idempotencia | `api/src/modules/accesos/repository.ts` | (1) `existentes()` de W11 y `buscarParaRepetir()` de W6 en el mismo hueco; (2) y (3) las clases `RepositorioDeConfirmaciones`/…/`RepositorioDeQrDeTodas` de W10-W12 frente a `RepositorioDeClavesDeIdempotencia` y `purgarClavesDeIdempotenciaVencidas` de W6 | Ambos métodos juntos (con el cierre de llave entre ellos); las clases de W6 se anexan al final del archivo, sin tocar las de W10-W12 |
| w6-idempotencia | `api/src/modules/accesos/schemas.ts` | Dos `import { ... }` seguidos (`exportacion.js` de W11 e `idempotencia.js` de W6) | Ambos imports |
| w7-ventana-repeticion | `accesos/actions/listar-eventos.ts` | W10 refactorizó el armado del listado en `presentarEventos` (con `ejecucion`); W7 añadió `repeticiones*` en el armado en línea | Se queda `presentarEventos` y se le agregan las tres cuentas de repeticiones (`contarRepeticiones`), de modo que el listado, `ver-evento` y la exportación comparten la forma |
| w7-ventana-repeticion | `accesos/contracts.ts` | `EventoDePlataforma`: `ejecucion`/`ejecucionCausa` (W10) frente a `repeticionesPermitidas/Rechazadas` (W7); dos bloques de cálculo distintos en `listar` | Ambos campos y ambos cálculos |
| w7-ventana-repeticion | `accesos/repository.ts` | `EJECUCION_EFECTIVA` (W10) frente a la nueva firma de `armarFiltroDeEventos(filtro, repeticiones)` (W7) | Se conserva la constante y la nueva firma |
| w7-ventana-repeticion | `resumen/actions/listar-eventos-de-acceso.ts` y `resumen/schemas.ts` | Campos de la vista de plataforma: `ejecucion`/`ejecucion_causa` y `repeticiones_*` | Ambos juegos de campos |
| w7-ventana-repeticion | `docs/gestion/plan-maestro.md` | Filas W6 (ya en la base) y W7 | W6 de la base, W7 de la rama |
| w7-ventana-repeticion | `docs/modelo-datos/tablas/16_eventos_acceso.md` | Índices (`idx_eventos_acceso_global` de W12; `idx_eventos_acceso_repeticion`, `repetido_de_id` de W7) y nota de la orden de abrir frente a la de `repetido_de_id` | Todo, sin pérdida |
| w8-sesiones | `seguridad/domain/roles-base.ts` | `seguridad.incidente.resolver` (W11) frente a `seguridad.sesion.ver/cerrar` (W8) en el Administrador | Los tres permisos |
| w8-sesiones | `seguridad/repository.ts` | `idsConPermiso()` (W11) frente a `bloquearSiActivo()` (W8) en `RepositorioDeSuperAdmins` | Ambos métodos |
| w8-sesiones | `api/test/helpers/fixtures.ts` | `PERMISOS_DE_ADMINISTRADOR` y `PERMISOS_DE_TITULAR`: avisos (W9) e incidentes (W11) frente a sesiones (W8) | Todos los permisos |
| w8-sesiones | `db/seeds/01_catalogo.sql` | Permisos nuevos de cuenta: `notificaciones.aviso.*` frente a `seguridad.sesion.*` | Ambos juegos; el seed corre dos veces sin error |
| w8-sesiones | `docs/modelo-datos/tablas/09_sesiones.md` | Índices: `idx_sesiones_reciente` (W12) frente a `idx_sesiones_instalacion`/`idx_sesiones_vivas` (W8) | Todos |
| w8-sesiones | `docs/gestion/plan-maestro.md` | Fila W8 con estado distinto | Fila W8 de la rama, resto de la base |

Cambios automáticos sin conflicto que conviene revisar: `api/src/config.ts` (variables de W1, W3, W6, W8), `api/test/setup.ts`, `api/src/modules/accesos/routes.ts`, `docs/decisiones/0030`, `0031`, `0032` y `docs/modelo-datos/03-schema-sql.md`.

## 4. Orden final de migraciones (64)

Sin versiones duplicadas. Aplicadas todas con un mini-dbmate en MariaDB 10.11: `up` completo, `down` de las últimas 17 y `up` otra vez, y el seed (`db/seeds/01_catalogo.sql`) ejecutado dos veces sin error.

```
20261009100001 … 20261009100016   base (16 tablas)
20261012100001 … 20261012100009   cobranza y planes
20261013100001, 20261013100002, 20261014100001, 20261015100001, 20261021100001
20261022100001 … 20261022100010   unidades, un rol por usuario, cuentas de cobro
20261026100001  alter_cuentas_estado                 (W4)
20261026100002  alter_usuarios_estado                (W4)
20261027100001  create_configuracion_limites         (W5)
20261027100002  create_excepciones_de_limite         (W5)
20261027100003  create_eventos_de_limite             (W5)
20261027100004  add_limites_de_qr_a_planes           (W5)
20261027100005  add_indice_de_creacion_a_qr_accesos  (W5)
20261027100006  create_claves_idempotencia           (W6)
20261028100001  add_repetido_de_id_a_eventos_acceso  (W7)
20261029100001  add_instalacion_y_plataforma_a_sesiones (W8)
20261030100001  create_notificaciones                (W9)
20261030100002  create_cola_de_notificaciones        (W9)
20261030100003  add_estado_de_placa_a_dispositivos   (W9)
20261031100001  create_confirmaciones_apertura       (W10)
20261031100002  add_sensor_y_apertura_a_dispositivos (W10)
20261031100003  add_apertura_fallida_a_tipos_de_notificacion (W10)
20261101100001 … 20261101100005   incidentes, resoluciones, anulaciones masivas, exportaciones, tipo de aviso (W11)
20261102100001  add_senales_a_tipos_de_notificacion  (W12)
20261102100002  create_avisos_de_senal               (W12)
20261102100003  add_indices_de_senales               (W12)
```

**Dependencias hacia versiones posteriores: ninguna.** W7 (`20261028…`) y W8 (`20261029…`) solo alteran `eventos_acceso` y `sesiones`, creadas en `20261009…`; W9 a W12 no usan `repetido_de_id` ni `instalacion_id` en SQL de migración. Las migraciones que amplían el ENUM de tipos de notificación (W9, W10, W11, W12) están en una sola línea de versiones creciente, cada una parte de la lista de la anterior. Aviso operativo: W7 y W8 quedan con versión menor que W9; si algún entorno ya tuviera aplicadas las de W9 a W12 antes que las de W7 y W8, dbmate aplica las pendientes sin importar el orden y no hay dependencia que lo impida.

## 5. Tareas de integración de W12 (ADR 0030 y D-37): hechas

Implementadas en el commit `cuenta aperturas e intentos distintos en las señales...`:

- **(a) Aperturas distintas.** `ES_APERTURA_POR_QR` ahora incluye `repetido_de_id IS NULL`: lo usan `uso_masivo`, el flujo atípico (`cuentasConAperturas` y `porDia`), el emparejamiento de `uso_imposible` (las dos consultas) y las vistas de plataforma (`/plataforma/flujo-de-cuentas`, `/plataforma/cuentas/{id}/flujo`). Decisión adicional, coherente con ADR 0032 §4.2: los **rechazos por día** de la serie de flujo cuentan solo intentos distintos.
- **(b) `qr_reenviado`.** La consulta devuelve el volumen (`rechazos`, todas las filas), los `intentos` distintos y los `lectores` con al menos un intento distinto. `gravedadDeQrReenviado(rechazos, intentos, lectores, minimo)`: alta/media exigen `intentos >= minimo`; si no, o con un solo lector, solo hay constancia baja cuando el volumen llega al triple del mínimo.
- **(c) `pin_compartido`.** La dispersión es la **mayor** entre IP distintas e instalaciones distintas (`GREATEST`), no su suma: así un teléfono que rota de IP no cuenta doble y dos aparatos tras una misma IP cuentan 2. La descripción del incidente incluye ahora `instalaciones=N`. **Sigue pendiente** la combinación «varias instalaciones y uso masivo» (alta).
- **(d) Pruebas** (`api/test/senales/integracion-repeticiones-e-instalaciones.test.ts` y `api/test/dominio/senales.test.ts`): repeticiones sembradas que no cambian `uso_masivo`, `flujo_atípico`, `uso_imposible` ni las vistas; un intento releído 9 veces es solo constancia baja; dos lectores con uno solo con intentos distintos no es «media»; instalaciones con una sola IP.

Otros arreglos por la combinación (solo pruebas, sin cambio de diseño): `exportacion.test.ts`, `confirmaciones.test.ts` e `idempotencia.test.ts` releían el mismo QR con el **mismo lector** dentro de 15 s esperando `qr.usado`; con W7 eso es una repetición que vuelve a abrir (ADR 0032 §3). Ahora la relectura la hace el otro lector (el QR se emite para ambas puertas), igual que ya hizo W7 en sus propias pruebas.

## 6. Resultados de la cascada sobre el sistema integrado

Entorno: MariaDB 10.11.14 propia (puerto 3418, copia de un datadir de pruebas), Node de la sesión.

| Parte | Etapa | Resultado |
|---|---|---|
| api | `tsc --noEmit` tras cada merge | Pasa en los cinco merges |
| api | ESLint | Pasa |
| api | Prettier `--check` | Pasa |
| api | dependency-cruiser | Pasa (285 módulos, 1409 dependencias) |
| api | Vitest, primera pasada tras los merges | 6 fallos en 3 archivos (los de la sección 5); 1226 pruebas pasan |
| api | Vitest tras los ajustes | 77 archivos y 1232 pruebas pasan (0 fallos) |
| web | ESLint, Prettier, `tsc`, Vitest (319 pruebas) y `vite build` | Pasan |
| app | `dart format`, `flutter analyze --fatal-infos` | Pasan (0 cambios, sin hallazgos) |
| app | `flutter test` | 400 pruebas pasan |
| firmware | Pruebas nativas con g++ y un shim de Unity (`-Wall -Wextra -Werror`) | 11 suites, 0 fallos (incluye `test_puerta`, 32 pruebas, con W7 y W10 juntas) |
| firmware | `pio run` / `pio test -e native` reales | **No ejecutados** (sin PlatformIO ni acceso a sus paquetes); corren en CI |
| web | `bin/verificar-nginx panel/app` | No ejecutado (necesita Docker o nginx y el build real) |

## 7. Variables de entorno nuevas

**Obligatoria (la API no arranca sin ella):**

- `QR_IDEMPOTENCIA_CLAVE` (W6): al menos 32 caracteres, propia (no reutilices `PIN_PIMIENTA`). `openssl rand -base64 32`. Rotarla invalida los reintentos de claves vigentes (24 h). Ya está en `docker-compose.prod.yml` y en `docs/gestion/produccion-variables.ejemplo`; hay que **añadirla al `.env` del CT 120** antes de desplegar, y al `.env` local de cada desarrollador.

**Cambia de comportamiento:**

- `TRUST_PROXY` (W3): ahora es un número de saltos (por omisión `1`) o una lista de IP/CIDR; `true` se rechaza al arrancar. El Nginx de delante debe **sobrescribir** `X-Forwarded-For`. Con la API expuesta sin proxy, `TRUST_PROXY=0`.

**Opcionales con valor por omisión** (W3, W8): `DB_POOL_DISPOSITIVOS`, `DB_POOL_APP`, `DB_COLA_DISPOSITIVOS`, `DB_COLA_APP`, `DB_ESPERA_MS_DISPOSITIVOS`, `DB_ESPERA_MS_APP`, `DB_CONSULTA_MS_DISPOSITIVOS`, `DB_CONSULTA_MS_APP`, `PETICION_MS_DISPOSITIVOS`, `PETICION_MS_APP`, `REINTENTO_503_SEGUNDOS`, `LIMITE_LOGIN_POR_MINUTO`, `LIMITE_REFRESCO_POR_MINUTO`, `LIMITE_ANUNCIO_POR_MINUTO`, `LIMITE_GENERAR_QR_POR_MINUTO`, `LIMITE_ESCRITURA_POR_MINUTO`, `LIMITE_LECTURA_POR_MINUTO`, `LIMITE_VALIDACION_POR_MINUTO`, `LIMITE_DISPOSITIVO_POR_MINUTO`, `LIMITE_EXPORTACION_POR_MINUTO`, `LIMITE_FALLOS_AUTENTICACION_POR_MINUTO`, `SESIONES_MAX_POR_USUARIO`, `SESIONES_MAX_POR_INSTALACION`. La API no arranca si los tiempos rompen el orden consulta < petición < espera del firmware (3000 ms). Los topes de generación, umbrales de incidentes y de señales no van en el entorno: están en `configuracion_limites` (migración y seed).

## 8. Cambios de contrato

Ninguno rompe a un cliente que respeta el contrato, pero sí hay cambios de comportamiento que las apps y el firmware deben conocer:

- `POST /qr-accesos` (W5): `texto` pasa a ser `null` cuando se **reutiliza** un QR propio vigente, aparece `reutilizado: boolean` y la respuesta es `200` (reutilizado) o `201` (nuevo). Un cliente que asuma `texto` siempre presente y `201` se rompe; la app de este repo ya se adaptó.
- `POST /qr-accesos` (W6): acepta `Idempotency-Key` (16 a 128 caracteres); errores nuevos `idempotencia.conflicto` (422) y `idempotencia.en_curso` (409).
- Cuerpos de entrada con `.strictObject` (W1): un campo de más ahora da 400 `validacion.invalida` (ADR 0005, enmienda 2026-10-26).
- Todas las respuestas de `/api/` llevan `Cache-Control: no-store` y `Vary: Authorization` (W1); el borde puede devolver 429 y 503 con `Retry-After` (W3).
- Validación de dispositivos (W7): la **relectura del mismo QR por el mismo lector dentro de 15 s** vuelve a responder `abrir: true` sin consumir otra vez (antes `qr.usado`); el firmware añade antirrebote. Otro lector sigue recibiendo `qr.usado`.
- Listado de eventos (W7, W10): campos nuevos `repeticiones`, `repeticiones_permitidas`, `repeticiones_rechazadas` y `ejecucion`; el listado y las estadísticas muestran solo los intentos originales.
- Estados `restringido`/`suspendido`/`eliminado` (W4): códigos nuevos (`qr.generacion_restringida`, `estado.impuesto_por_superior`, `sesion.usuario_suspendido`, etc.) que app y panel aún no traducen por completo.
- Nuevos permisos de cuenta y plataforma en el seed (sesiones, avisos, incidentes, exportación, señales, consumo): el seed debe correr tras migrar.
- Endpoints nuevos: sesiones, notificaciones, incidentes, anulación masiva, `GET /exportaciones/{recurso}`, `POST /dispositivos/confirmaciones`, vistas de plataforma de consumo y señales.

## 9. Pasos manuales de Miguel

1. **Instalar `seguridad.yml` (W2).** El token de la sesión no puede escribir en `.github/workflows/`. Con una rama desde `develop`: `cp docs/ci/propuestos/seguridad.yml .github/workflows/seguridad.yml && git rm -r docs/ci/propuestos`; comprobarlo con `actionlint`; activar GitHub Advanced Security (o quitar el job `codeql`) y Secret scanning. Decisiones abiertas: que bloquee o solo informe (sumarlo a `needs` de `ci`), y la licencia de `buffers@0.1.1`. Detalle en `docs/ci/propuestos/README.md`.
2. **Parche de `ci.yml` (W1 distribución).** El cambio se retiró de la rama por la misma razón. Aplicarlo a mano en `.github/workflows/ci.yml`:

   ```diff
   @@ job app
          - name: Tests (flutter test)
            run: flutter test
   +      # --base-href como el Dockerfile: la prueba de nginx mide el mismo build que se publica
          - name: Build web
   -        run: flutter build web --release
   +        run: flutter build web --release --base-href=/app/
   +      - name: Nginx de la app (cabeceras, rutas, hash del splash; ADR 0033 §2)
   +        working-directory: .
   +        run: bin/verificar-nginx app
   @@ job web
          - name: Build (Vite)
            run: npm run build
   +      - name: Nginx del panel (cabeceras, caché, 404; ADR 0033 §2)
   +        working-directory: .
   +        run: bin/verificar-nginx panel
   ```

3. **NPMplus (W1 y W3).** En el host `acceso.agrocom.com.bo`: activar HSTS (`max-age=31536000`, sin subdominios ni preload); **desactivar «Cache Assets»**; no añadir ni ocultar `Cache-Control`/`Vary` en `/api/` ni cabeceras de seguridad en la pestaña Advanced; confirmar que NPMplus añade la IP del cliente a `X-Forwarded-For` (el Nginx del CT la sobrescribe). Después, la comprobación y el checklist de `docs/gestion/despliegue.md` («Borde: NPMplus, caché y cabeceras»). Los límites de borde (`limit_req`, `limit_conn`, tope de cuerpo) siguen sin fijar.
4. **Variables del CT 120:** añadir `QR_IDEMPOTENCIA_CLAVE` y revisar `TRUST_PROXY`; los demás valores tienen por omisión.
5. **Decisiones a confirmar:** D-25 (restringir arrastra a la rama), D-29 (el Administrador solo ve su rama), D-37 (combinación de instalaciones con uso masivo, pendiente), la polaridad del sensor reed en campo (W10) y el nombre de `W14`.
6. **Después de integrar:** correr `bin/verify` completo (firmware con `pio` real y las pruebas de nginx incluidas), migrar la base de producción y sembrar el catálogo (`bin/desplegar` lo hace), y actualizar `plan-maestro.md` (estados «Integrado #N»): esta rama no lo toca.

## 10. Corrección del presupuesto de la validación (W3, `presupuestoDePeticion`)

`request.signal` de Fastify llega abortada en Node 22 en cuanto se lee el cuerpo de un POST, así que con un cliente HTTP real la validación de QR respondía 503 siempre (`inject()` no lo reproduce). W3 lo corrige con `api/src/platform/http/presupuesto.ts` y pruebas con servidor real (`api/test/platform/servidor-real.test.ts`).

- **Propagación:** `git merge` de la cadena, sin rebase ni conflictos: w4 ← w3; w5 ← w4; w6, w7, w8, w9 ← w5; w10 ← w9; w11 ← w10; w12 ← w11; w13 ← w12; `claude/integracion-olas` ← w3 y luego todas las ramas actualizadas. Ramas actualizadas y publicadas: `claude/w4-estados`, `w5-topes`, `w6-idempotencia`, `w7-ventana-repeticion`, `w8-sesiones`, `w9-notificaciones`, `w10-confirmaciones`, `w11-incidentes`, `w12-senales`, `w13-carga` y `integracion-olas`.
- **Misma trampa en W10:** `POST /dispositivos/confirmaciones` pasaba `request.signal` a `confirmarApertura` y respondía 503 con un cliente real. Ahora usa `presupuestoDePeticion(reply, PETICION_MS_DISPOSITIVOS)` (corregido en w10 y propagado a w11, w12, w13).
- **Prueba de W7 ajustada (w7):** el «segundo uso» de la prueba de servidor real ahora envejece la apertura más allá de los 15 s, porque dentro de la ventana de repetición la relectura del mismo lector reabre.
- **Pruebas nuevas con servidor real (`servidor-real.test.ts`):** confirmaciones (204 y repetida), `POST /qr-accesos` con `Idempotency-Key` (mismo QR en el reintento), `POST /qr-accesos/anulacion-masiva`, `POST /incidentes` y la relectura a los 5 s (200, `abrir: true`, sin consumir de nuevo). Ninguna responde 503.
- **Regla:** en `api/src` ya no se pasa `request.signal` a ninguna acción; toda ruta con cuerpo y plazo usa `presupuestoDePeticion`. Las demás rutas con cuerpo no usan señal ni plazo propio.
