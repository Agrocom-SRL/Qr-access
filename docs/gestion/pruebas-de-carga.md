# Pruebas de carga (k6): cómo montarlas, correrlas y leerlas

**Ola:** W13 (`docs/gestion/plan-maestro.md` §4.3). **Decisiones:** ADR 0030 §3 (protección contra estrés) y ADR 0032
(concurrencia, prioridad de las puertas y registro de lecturas). **Código:** `api/test/carga/` (ver `api/test/carga/README.md`) y
`bin/carga`.

**Estado de este documento:** la carga está escrita y se validó contra una API levantada en un sandbox, con cifras
**orientativas** (§9). **Todavía no hay una corrida en un entorno de prueba representativo.** Además, la validación
del QR responde 503 con un cliente HTTP real por un defecto de la API (§10.1): hasta que se corrija, ninguna cifra de
validación significa nada para producción.

---

## 1. Qué responde esta prueba

El objetivo de la ola es saber **qué puntos soporta el proyecto**: cuánto tardan las solicitudes, cuántas se atienden a la vez y
si la validación del QR de las puertas responde bien aun con la API de usuarios saturada. Cada pregunta tiene un
escenario:

| Pregunta | Escenario | Dónde está la respuesta |
|---|---|---|
| ¿Cuánto tarda validar un QR (p95, p99)? | `validacion-qr` (a) | §3 compuertas y §9 |
| ¿Sigue respondiendo la validación con la API de usuarios saturada? | `saturacion-usuarios` (d), comparado con (a) | §5.4 y §9 |
| ¿Hasta cuántos usuarios concurrentes aguanta antes de degradarse? | `rampa-stress` (f1) | §6.2 (punto de quiebre) |
| ¿Se degrada con el tiempo? | `soak` (f2), corto | §6.3 |
| ¿Funcionan los límites del ADR 0030 (429 y Retry-After)? | `verificar-limites`, y los 429 de (b), (c) y (f1) | §7 |
| ¿Cuánto tardan la generación, el login, los latidos y las confirmaciones? | (b), (c), (e) | §3 (propuestas) y §9 |

Lo que **no** responde está en §12.

---

## 2. Reglas de seguridad de la prueba

- **Nunca contra producción.** Cada corrida exige `CARGA_ENTORNO=prueba`. `api/test/carga/lib/guarda.mjs` rechaza cualquier host
  del dominio `agrocom.com.bo` (incluido `acceso.agrocom.com.bo`) y cualquier host que no sea local ni esté declarado
  en `CARGA_HOSTS_DE_PRUEBA`. El preparador y k6 aplican la misma regla.
- **Sin secretos en el repo.** `preparar-datos.mjs` toma la clave del super admin de `CARGA_ROOT_CLAVE`. Los datos
  generados (claves de placas, PIN, tokens de QR de prueba) van a `api/test/carga/datos/generados/`, con permisos 0600 y
  ignorados por git. `bin/carga` no pasa `CARGA_ROOT_CLAVE` a k6.
- **Sin acceso a la base.** Todo entra por la API, como lo haría la placa o la app.
- **`X-Forwarded-For` simulado** (`CARGA_IP_SIMULADAS=1`): solo en el entorno de prueba, sin proxy delante y con
  `TRUST_PROXY=1`. En producción, NPMplus y el Nginx reescriben esa cabecera; el truco no tendría efecto útil, y nunca
  se corre carga contra producción.

---

## 3. Umbrales: qué se exige y por qué

Los umbrales están en `api/test/carga/lib/umbrales.js` y se separan en dos clases.

**Compuertas** (si fallan, la corrida falla). Son el objetivo de W13 y las garantías de seguridad:

| Umbral | Qué mide | Por qué este valor |
|---|---|---|
| `p(95) < 1000 ms` y `p(99) < 2000 ms` en `validar_qr` | Tiempo de respuesta de `POST /dispositivos/validaciones` | Objetivo del encargo de W13. ADR 0032 §1: la placa espera **3 s** y la API corta la petición a **2,5 s** (`PETICION_MS_DISPOSITIVOS`). Un p95 de 1 s deja margen a la red WiFi del lector, que esta prueba no mide. |
| `respuestas_no_validas{endpoint:validar_qr}` = 0 | Respuestas que la placa no entiende (no es un 200 con `abrir` booleano y `evento_id`), incluidos 429 y 503 | ADR 0009: sin respuesta válida, la puerta **no abre**. Si bajo carga aparece una, la validación se está cayendo. Es lo que d debe demostrar que no pasa. |
| `aperturas_inesperadas` = 0 | `abrir: true` en una repetición de un QR ya usado | Invariante 3 (un QR sirve una vez). Los QR de repetición se usan antes de la corrida y la ventana de 15 s de ADR 0032 §3 ya pasó. |
| `primeros_usos_rechazados` = 0 | Un QR de primer uso que la placa **no** puede abrir | Si pasa, el dato está mal preparado o la suscripción venció, y la corrida no mide lo que dice. |
| `sin_datos` = 0 | Peticiones sin QR ni dispositivo disponible | El dimensionamiento está mal. Una corrida así no es válida. |
| `http_req_failed{endpoint:validar_qr}` < 0,1 % | Errores de transporte o HTTP | Ídem anterior, para los errores que no llegan a ser respuestas. |

**Propuestas** (sin respaldo en un ADR; se afinan con una corrida real, §11). Se muestran pero no son requisito:

| Ruta | Propuesta | Razón |
|---|---|---|
| `login` | p95 < 1,5 s | El login usa argon2id con memoria de 19 MB: es el trabajo más caro de la API. |
| `generar_qr` | p95 < 1 s | Acción de escritura con varias consultas y con el tope diario. |
| `confirmacion` y `latido` | p95 < 1 s | Tráfico de la flota; el latido cada pocos segundos por placa. |
| `app_qr` (rampa) | p95 < 2 s | Ubica el punto de quiebre de la app; no es compuerta de la validación. |

---

## 4. Montar el entorno de prueba

### 4.1 Requisitos

- Docker con Compose v2, y Node 22 (`api/.nvmrc`). La receta de contenedores de §4.2 y §4.3 aún no se ha ejecutado de punta a punta (ver la nota de §4.2).
- **k6 v1.3.0.** Se verificó el checksum del tarball oficial (`k6-v1.3.0-checksums.txt`). En esta versión k6 **no lee
  el entorno del proceso**: las variables `CARGA_*` van con `-e` (lo hace `bin/carga`).

### 4.2 Proyecto compose descartable, con base y puertos propios

No uses el proyecto de desarrollo ni `qr-access-verif`. El proyecto de carga es `qr-access-carga`, con su base
(`qr_access_carga`) y puertos distintos del desarrollo (3307) y de la verificación:

```bash
cd /ruta/al/repo
export MYSQL_DATABASE=qr_access_carga MYSQL_PORT=3317 API_PORT=3010
# Secretos de la API generados al vuelo: no se escriben en ningún archivo.
export JWT_SECRETO="$(openssl rand -hex 32)" PIN_PIMIENTA="$(openssl rand -base64 32)"

docker compose -p qr-access-carga up -d db
docker compose -p qr-access-carga --profile herramientas run --rm dbmate up
docker compose -p qr-access-carga up -d api
curl -sS http://127.0.0.1:3010/api/v1/salud     # {"estado":"ok","base":"ok"}
```

> **Estado de esta receta:** en el sandbox donde se escribió no hay daemon de Docker, así que los contenedores **no se
> levantaron**. Se comprobó la sintaxis con `docker compose -p qr-access-carga config --quiet` (correcta). La primera
> vez que se use en un host con Docker, anota aquí qué pasó.

Mientras corres la carga, `docker compose -p qr-access-carga down` (sin `-v`) detiene el proyecto y conserva la base.
Para empezar de cero, usa otro `MYSQL_DATABASE` en lugar de borrar volúmenes.

El servicio `api` de compose usa el target `desarrollo` (`tsx watch`, ver `api/Dockerfile`). **Para medir, usa el
target de producción**, que corre `node dist/server.js` (sin `tsx`), con la misma base y las mismas variables:

```bash
docker build --target produccion -t qr-access-api:carga ./api
docker run -d --name qr-access-carga-api --network qr-access-carga_default -p 3010:3000 \
  -e DB_HOST=db -e DB_PORT=3306 -e DB_DATABASE=qr_access_carga -e DB_USERNAME=qr_access -e DB_PASSWORD=qr_access \
  -e JWT_SECRETO="$JWT_SECRETO" -e PIN_PIMIENTA="$PIN_PIMIENTA" -e TRUST_PROXY=1 qr-access-api:carga
```

Las cifras de §9 **no** salen de esta configuración: salen de `tsx` en un sandbox (§9.1).

### 4.3 Super admin `root` (solo entorno de prueba)

`bin/reiniciar-local` y `bin/desplegar` insertan `usuarios.activo`, columna que la migración `20261026100002` eliminó:
hoy fallan en el alta de `root` (§10.2). Mientras no se corrigen, créalo a mano con la forma vigente (contraseña
temporal `0000`, que el panel obliga a cambiar; solo de prueba):

```bash
HASH=$(docker compose -p qr-access-carga exec -T api node -e "import('argon2').then(async (a) => \
  process.stdout.write(await a.hash('0000', { type: a.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })))")
docker compose -p qr-access-carga exec -T db sh -c 'mariadb -uqr_access -pqr_access qr_access_carga' <<SQL
INSERT INTO usuarios (tenant_id, etiqueta, username, contrasena_hash, contrasena_temporal)
  VALUES (NULL, 'Root', 'root', '$HASH', 1);
INSERT INTO usuario_roles (tenant_id, usuario_id, rol_id)
  SELECT NULL, u.id, r.id FROM usuarios u
    JOIN roles r ON r.tenant_id IS NULL AND r.nombre = 'Super admin' AND r.deleted_at IS NULL
   WHERE u.tenant_id IS NULL AND u.username = 'root' AND u.deleted_at IS NULL;
SQL
```

Antes, el catálogo: `docker compose -p qr-access-carga exec -T db sh -c 'mariadb -uqr_access -pqr_access qr_access_carga' < db/seeds/01_catalogo.sql`.

### 4.4 Límites: por defecto

La API corre con los **valores por defecto** (no pongas `LIMITE_*` en el `.env`), salvo que el escenario lo pida
explícitamente. Esos valores son los que se verifican:

| Variable | Por defecto | Clave |
|---|---|---|
| `LIMITE_LOGIN_POR_MINUTO` | 20 | IP |
| `LIMITE_REFRESCO_POR_MINUTO` | 60 | IP |
| `LIMITE_ANUNCIO_POR_MINUTO` | 20 | IP |
| `LIMITE_GENERAR_QR_POR_MINUTO` | 10 | usuario |
| `LIMITE_ESCRITURA_POR_MINUTO` / `LIMITE_LECTURA_POR_MINUTO` | 60 / 240 | usuario (o IP) |
| `LIMITE_VALIDACION_POR_MINUTO` | 600 | credencial de dispositivo |
| `LIMITE_DISPOSITIVO_POR_MINUTO` | 120 | credencial de dispositivo |
| `LIMITE_FALLOS_AUTENTICACION_POR_MINUTO` | 30 | IP |
| Pools (`DB_POOL_DISPOSITIVOS` / `DB_POOL_APP`) | 4 / 6 conexiones | |
| Cola (`DB_COLA_DISPOSITIVOS` / `DB_COLA_APP`) | 20 / 50 | |
| Espera por conexión (`DB_ESPERA_MS_*`) | 500 ms / 3000 ms | |
| Consulta máxima (`DB_CONSULTA_MS_*`) | 1500 ms / 5000 ms | |
| Petición máxima (`PETICION_MS_*`) | 2500 ms / 15000 ms | |
| `REINTENTO_503_SEGUNDOS` | 2 | |

Los topes de **generación** (ADR 0030 §2 y §7) viven en la base, en `configuracion_limites`, y se tocan desde el panel:
`qr.tope_diario` 100, `qr.tope_pendientes` 50, `qr.reemplazos_sin_uso_por_dia` 5, `qr.max_puertas_por_qr` 10,
`qr.bolsa_mensual` 5000. No se cambian en la corrida.

---

## 5. Cómo correr cada escenario

### 5.1 Preparar datos

Cada corrida de validación **consume** sus QR (cada uno vale una vez). Por eso **cada corrida tiene su preparación**:
no reutilices un archivo de datos después de correr validación con él.

```bash
CARGA_ENTORNO=prueba CARGA_URL=http://127.0.0.1:3010 CARGA_ROOT_CLAVE='<clave de root de prueba>' \
  bin/carga preparar --usuarios 60 --puertas 5 --qr 1450 --qr-repeticion 5
```

- Cada puerta tiene su placa; cada QR va a una puerta y lo valida la placa de esa puerta.
- Los Titulares son de prueba: tienen acceso a todas las puertas y generan QR. El plan admite hasta 100 usuarios
  (el Administrador cuenta como uno), así que `--usuarios` llega hasta 90. Cada Titular puede tener **50 QR
  pendientes** como máximo: el preparador valida que `QR / usuarios ≤ 50` y se niega a seguir si no.
- El tiempo de preparación es **≈ QR / (10 × usuarios) minutos**, porque cada usuario genera como mucho 10 QR por
  minuto. El preparador espera cuando el límite lo pide y lo dice en pantalla. Con 60 usuarios, 1450 QR tardan ~3 min.
- La cuenta de prueba nace con su primer pago y su suscripción vigente; si no, la validación rechaza con
  `suscripcion.vencida`.
- Cada preparación crea una cuenta nueva (código de 3 letras sorteado, o `CARGA_CODIGO`), así que los topes diarios y
  los de la bolsa mensual empiezan de cero en cada corrida.

### 5.2 Escenarios

Con `bin/carga` (o `k6 run -e …`), desde la raíz del repo. Las cifras de QR son para la preparación de **esa** corrida:

| Escenario | Preparación (`bin/carga preparar`) | Variables de la corrida | Duración aprox. |
|---|---|---|---|
| (a) validación | `--usuarios 60 --puertas 5 --qr 1450 --qr-repeticion 5` | `CARGA_ETAPAS=10:30,30:30,10:30` (≈1350 peticiones) | ~1 min 30 s + 20 s de repetición |
| (d) saturación | `--usuarios 60 --puertas 5 --qr 650 --qr-repeticion 5` | `CARGA_ETAPAS=10:60 CARGA_VUS_APP=40 CARGA_DURACION_S=60 CARGA_IP_SIMULADAS=1` | 1 min + repetición |
| (d) línea base | la misma que (d), **otra** preparación | `CARGA_ETAPAS=10:60` (sin `CARGA_VUS_APP`) | 1 min + repetición |
| (b) generación | `--usuarios 60 --qr 0 --qr-repeticion 0` | `CARGA_DURACION_S=120` (con `CARGA_GENERACION_SIN_PAUSA=1` para los 429) | 2 min |
| (c) login | `--usuarios 60 --qr 0 --qr-repeticion 0` | `CARGA_VUS_LOGIN=20 CARGA_DURACION_S=120 CARGA_IP_SIMULADAS=1` | 2 min |
| (e) latidos y confirmaciones | `--usuarios 60 --puertas 5 --qr 0 --qr-confirmacion 250 --qr-repeticion 0` | `CARGA_DURACION_S=120 CARGA_TASA_CONFIRMACION=2` | 2 min |
| (f1) rampa | `--usuarios 60 --puertas 5 --qr 540 --qr-repeticion 0` | `CARGA_ESCALONES=5,10,20,40 CARGA_ESCALON_S=60 CARGA_SONDA_TASA=2 CARGA_IP_SIMULADAS=1` | ~4,5 min |
| (f2) soak | `--usuarios 60 --qr 0 --qr-repeticion 0` | `CARGA_SOAK_S=600 CARGA_SOAK_TASA=1 CARGA_IP_SIMULADAS=1` | 10 min |
| límites | `--usuarios 2 --qr 0 --qr-repeticion 0` | ninguna (`bin/carga verificar-limites`) | ~1 min 30 s |

Ejemplo, la corrida (a) completa:

```bash
export CARGA_ENTORNO=prueba CARGA_URL=http://127.0.0.1:3010
bin/carga preparar --usuarios 60 --puertas 5 --qr 1450 --qr-repeticion 5   # pide CARGA_ROOT_CLAVE
CARGA_DATOS="$PWD/api/test/carga/datos/generados/prueba.json" CARGA_ETAPAS=10:30,30:30,10:30 bin/carga validacion-qr
```

`bin/carga preparar` escribe `api/test/carga/datos/generados/prueba.json`; para varias corridas, usa `--salida` para no pisar el
anterior. `CARGA_DATOS` apunta al que corresponda.

Orden recomendado: preparar → (a) → preparar → (d) → preparar → línea base de (d) → preparar → (e) → (b) → (c) → preparar
→ (f1) → (f2) → **`verificar-limites` al final**, ≥ 65 s después del último login de la misma IP. Su ventana es de un
minuto, y los logins del preparador cuentan contra ella (ver §10.5).

Los escenarios que hacen login desde una sola IP (sin `CARGA_IP_SIMULADAS=1`) se topan con 20 logins por minuto del
límite de ADR 0030 §3.2. Es esperable: es el límite trabajando, no un fallo del servidor.

### 5.3 Validación de sintaxis sin tocar la red

```bash
k6 inspect -e CARGA_ENTORNO=prueba -e CARGA_URL=http://127.0.0.1:3010 -e CARGA_DATOS=/ruta/absoluta.json \
  api/test/carga/escenarios/validacion-qr.js
```

### 5.4 Cómo se compara (d) con (a)

La pregunta de aislamiento se responde comparando **la misma carga de validación** con y sin la carga de app: misma
`CARGA_ETAPAS`, mismo número de placas, datos preparados por separado. Si las compuertas de (a) pasan y las de (d)
también, la validación no se degrada con la app saturada. Si (d) cae y (a) no, el aislamiento de pools (ADR 0032 §1)
no está haciendo su trabajo: se reporta, no se ajusta el umbral.

---

## 6. Cómo leer los resultados

### 6.1 Dónde están

`api/test/carga/resultados/<escenario>-<sello>.json` (todas las métricas, con sus umbrales) y `.csv` (una fila por métrica y
estadística, más el resultado de cada umbral). Ambos quedan fuera de git. La consola muestra un resumen corto y la
lista de umbrales que **no** se cumplen. Con `CARGA_SALIDA` se cambia la carpeta.

### 6.2 Etiquetas

- `endpoint`: la ruta de la petición (`validar_qr`, `generar_qr`, `latido`, `confirmacion`, `login`, `app_qr`…).
  Los umbrales por endpoint salen como `http_req_duration{endpoint:validar_qr}`.
- `escalon` (solo rampa): el escalón de VU (`escalon_1`…) o `pausa`. El **punto de quiebre** es el primer escalón con
  un umbral caído; la consola lo imprime al final.
- `tramo` (solo soak): tercio de la duración (`tramo1`…`tramo3`). Si `tramo3` empeora frente a `tramo1`, algo se
  degrada con el tiempo.
- Contadores: `respuestas_no_validas` (con `status`), `aperturas_inesperadas`, `primeros_usos_rechazados` (con
  `motivo`), `validaciones_rechazadas` (con `motivo`), `limites_aplicados` (429 y 503 con `Retry-After`), `sin_datos`.

### 6.3 Cómo interpretar

- **p95 y p99**: el p95 es lo que espera la mayoría; el p99, la cola. Una validación con p95 bajo y p99 alto suele ser
  contención de pool o un bloqueo puntual (deadlock reintentado).
- **`limites_aplicados` con 503**: la API rechazó por pool o por presupuesto. Es el mecanismo de ADR 0032 §1 trabajando
  (falla rápida con `Retry-After`), no un error de la prueba. Pero en la validación cuenta como respuesta no válida.
- **429 de la app en la saturación**: el límite por usuario (`LIMITE_LECTURA_POR_MINUTO`) corta antes que la base.
  Para medir capacidad de verdad, sube usuarios o la cuota de lectura del entorno de prueba, y lo anotas.
- **Una compuerta roja con p95 verde**: mira `respuestas_no_validas` y `aperturas_inesperadas`. Un p95 bueno con
  respuestas inválidas significa que la validación se cae rápido, que no es lo mismo que responder bien.

---

## 7. Qué límites se verifican (ADR 0030 y 0032)

| Límite | Valor | Cómo se verifica | Estado en el sandbox (§9) |
|---|---|---|---|
| Login por IP | 20/min | `verificar-limites`: los primeros 20 pasan, el 21.º en adelante es 429 `limite.excedido` con `Retry-After` | Verificado (ver §9.3) |
| Generar QR por usuario (ráfaga) | 10/min | `verificar-limites` (12 seguidos). La variante `generacion-qr` con `CARGA_GENERACION_SIN_PAUSA=1` existe, pero no se corrió | Verificado con `verificar-limites` (ver §9.3) |
| Lectura, escritura, refresco, anuncio, dispositivo | 240, 60, 60, 20, 120 por minuto | Observables en (f1) y (e); no hay escenario dedicado | Pendiente de corrida real |
| Validación por credencial | 600/min (mínimo 60) | (a) con tasa alta por placa; no se alcanzó | Pendiente |
| Fallos de autenticación por IP | 30/min | No hay escenario | Pendiente |
| Pool de dispositivos y cola (4 y 20) | ADR 0032 §1 | (d) y (f1): `respuestas_no_validas` y `limites_aplicados` | Pendiente de corrida real |
| 503 con `Retry-After` 2 s | ADR 0032 §1 | Contado en `limites_aplicados` | Pendiente |
| Tope diario de generación | 100/usuario/día (`qr.limite_diario`) | Manual: generar 101 QR con un usuario en un día | **No automatizado** |
| Tope de pendientes | 50 (`qr.limite_pendientes`) | Manual: 51 QR sin usar | **No automatizado** |
| Puertas por QR | 10 (`qr.limite_puertas`) | Manual: un QR con 11 puertas (422) | **No automatizado** |
| Bolsa mensual de QR | 5000 por cuenta | Manual, con cuenta de prueba dedicada | **No automatizado** |

Los topes de generación exigen cientos de QR y, en el caso diario, un día entero. Se verifican a mano, en un entorno
de prueba dedicado, y no se mezclan con esta carga.

---

## 8. Plantilla de la tabla de resultados

Una corrida = una fila por escenario. Completa cada campo; si algo no se midió, pon «no medido» y di por qué.

| Fecha | Commit | Entorno (CPU, RAM, host) | API (target, límites) | Escenario | Parámetros | Peticiones | p50 | p95 | p99 | Errores % | No válidas | Inesperadas | 429 | 503 | Compuertas | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Campos de la tabla de límites (§7) y del punto de quiebre (f1): añade una tabla por escalón con los mismos campos.

---

## 9. Resultados orientativos (sandbox, no representativos)

### 9.1 Condiciones

- **Sandbox**: VM de 4 CPU compartidas y 16 GB de RAM, con otros procesos (otras MariaDB y otras APIs de agentes
  en paralelo). No es el servidor de producción ni tiene la red del lector de QR.
- **API en `tsx` (modo desarrollo)**, no la imagen de producción. Una API compilada tendrá mejor latencia. El
  parche de §10.1 se aplicó **en una copia descartable fuera del repo**, solo para poder validar la validación; no es
  código de W13.
- **MariaDB 10.11.14** local en el puerto 3417, datadir propio; migraciones de `db/migrations` completas.
- **Datos**: 3 puertas con sus placas y 12 Titulares en las corridas de la primera parte; 5 puertas y 60 Titulares en
  la saturación de 60 usuarios (d3, d30). Entre 10 y 650 QR por preparación, según la corrida.
- **Límites por defecto** (§4.4).
- **Cifras pequeñas**: entre 3 y 60 segundos de carga por escenario, salvo la preparación. Son orientativas: sirven
  para ver que los escenarios funcionan y de qué orden son las latencias, no para dimensionar.

### 9.2 Cifras (campaña del 27 de octubre de 2026)

Se rellenan con el resumen de cada corrida en `api/test/carga/resultados/` (copiado de la carpeta de trabajo del sandbox).

Todas las cifras son de una sola ejecución por fila (no hay repeticiones ni desviación). Los n son pequeños: son
suficientes para ver el orden de magnitud, no para afirmar un p99.

| Corrida (escenario) | Datos y parámetros | Métrica | n | p50 | p95 | p99 | Compuertas |
|---|---|---|---|---|---|---|---|
| validación, humo (`validacion-qr`) | 14 primeros usos + 5 repeticiones; `CARGA_ETAPAS=10:3` | `validar_qr` | 14 | 53,1 | 61,7 | 68,8 | cumple |
| validación (`validacion-qr`, a) | 120 primeros usos; `CARGA_ETAPAS=20:4,20:4`; 5 repeticiones | `validar_qr` | 120 | 46,9 | 61,0 | 69,3 | cumple; 5/5 repeticiones `qr.usado` |
| línea base sin carga (`validacion-qr`) | 49 primeros usos; `CARGA_ETAPAS=5:20`; 12 usuarios | `validar_qr` | 49 | 48,6 | 61,8 | 67,6 | cumple |
| saturación con 12 usuarios (`saturacion-usuarios`, d) | misma carga que la línea base; 20 VU leyendo listados sin pausa | `validar_qr` | 49 | 91,2 | 119,6 | 141,3 | cumple |
| saturación con 12 usuarios | (misma corrida) | `app_qr` / `app_eventos` | 5 091 / 5 091 | 35,4 / 34,4 | 70,2 / 59,0 | 86,0 / 74,6 | informativo |
| saturación con 60 usuarios (`saturacion-usuarios`, d3) | 40 VU sobre 60 usuarios; 60 s; `CARGA_ETAPAS=10:60`; 5 repeticiones | `validar_qr` | 299 | 107,4 | 151,6 | 175,3 | cumple; 0 respuestas no válidas; 5/5 repeticiones `qr.usado` |
| | (misma corrida) | `app_qr` / `app_eventos` | 19 119 / 19 119 | 21,9 / 22,8 | 232,9 / 183,2 | 290,9 / 233,2 | informativo: **28 812 respuestas 503** y 3 771 429, todas con `Retry-After` |
| línea base con 60 usuarios (`validacion-qr`, d30) | 60 usuarios; `CARGA_ETAPAS=10:60`; sin carga de app | `validar_qr` | 300 | 48,3 | 62,0 | 74,3 | cumple; 5/5 repeticiones `qr.usado` |
| latidos y confirmaciones (`latidos-confirmaciones`, e) | 3 placas, latido cada 2 s; 1 confirmación/s durante 10 s | `latido` | 15 | 60,9 | 78,2 | 79,9 | propuesta: cumple |
| | | `confirmacion` | 11 | 43,9 | 54,8 | 54,9 | propuesta: cumple |
| | | `validar_qr` (primer uso) | 11 | 48,5 | 62,9 | 64,4 | cumple |
| generación de QR (`generacion-qr`, b) | 12 usuarios, pausa de 6 s, 30 s | `generar_qr` | 60 | 36,5 | 88,8 | 102,8 | propuesta: cumple; todos 201 |
| login y sesiones (`login-sesiones`, c) | 5 VU, IP simulada, 20 s | `login` | 95 | 63,9 | 93,2 | 122,9 | propuesta: cumple |
| | | `sesion_actual` | 95 | 11,2 | 22,8 | 29,3 | informativo |
| | | `refresco` | 95 | 10,6 | 27,0 | 29,7 | informativo |
| rampa (`rampa-stress`, f1) | escalones de 5 y 10 VU, 10 s cada uno; sonda de 2/s | `validar_qr` | 49 | 49,0 | 68,6 | 106,0 | cumple en ambos escalones |
| | | `app_qr` escalón 1 (5 VU) | 100 | 10,8 | 18,2 | 26,2 | sin umbral caído |
| | | `app_qr` escalón 2 (10 VU) | 200 | 10,2 | 27,8 | 41,1 | sin umbral caído |
| soak corto (`soak`, f2) | 30 s, 1 ciclo por segundo, 31 ciclos completos | `validar_qr` tramos 1 / 2 / 3 | 10 / 10 / 11 | 51,5 / 50,1 / 55,1 | 67,2 / 71,4 / 68,9 | 67,9 / 73,4 / 71,7 | cumple en los tres |
| | | `generar_qr` / `confirmacion` | 31 / 31 | 17,3 / 47,1 | 23,2 / 63,2 | 24,7 / 65,7 | propuesta: cumple |
| límites (`verificar-limites`, g) | 25 logins desde una IP; 12 QR de un usuario | `login` 1 a 20 / 21 a 25 | 20 / 5 | | | | 200 y 429 con Retry-After |
| | | `generar_limite` 1 a 10 / 11 a 12 | 10 / 2 | | | | 201 y 429 `limite.excedido` |

Todas las corridas de validación tuvieron **0 respuestas no válidas**, **0 aperturas inesperadas**, **0 primeros
usos rechazados** y **0 peticiones sin datos**. Los rechazos que sí aparecen son las repeticiones, que el servidor
rechazó como `qr.usado`: 5 de 5 en a, d3 y d30; 3 de 3 en d y d0.

### 9.3 Qué se confirmó

**Confirmado en el sandbox** (orientativo: API en `tsx` con el parche de §10.1):

- Los escenarios corren de extremo a extremo: `preparar-datos.mjs` crea cuenta, sitio, puertas, placas vinculadas,
  Titulares y QR, y cada escenario k6 escribe su resumen en JSON y CSV con sus umbrales.
- **Ningún QR de primer uso dejó de abrir** en las corridas de validación (120 de 120 en a, 49 de 49 en d y en la
  rampa, 31 de 31 en el soak, 11 de 11 en e). Ninguna respuesta no válida ni apertura inesperada.
- **La repetición se rechaza como `qr.usado`** (5 de 5 en a, d3 y d30; 3 de 3 en d y d0), con la preparación hecha con
  más de 15 s de antelación.
- **El límite de login por IP responde como dice ADR 0030 §3.2**: 20 logins aceptados y el 21.º en adelante, 429
  `limite.excedido` con `Retry-After` (5 de 5 en `verificar-limites`).
- **El límite de generación por usuario responde como dice ADR 0030 §3.2**: 10 QR en 201 y los siguientes, 429
  `limite.excedido` con `Retry-After` (2 de 2).
- **Aislamiento de pools, con presión real sobre la app** (60 usuarios, 40 VU leyendo listados sin pausa, §9.2 filas
  d3 y d30): la app devolvió **28 812 respuestas 503** con `Retry-After` y 3 771 429, y la validación no tuvo **ninguna**
  respuesta no válida (0 de 299) ni apertura inesperada. Los 503 no pueden ser de la validación, porque su conteo de
  respuestas no válidas es cero; la carga que se saturó fue la de la app, como pide ADR 0032 §1.
- **Pero la latencia de la validación sí sube bajo esa presión**: p95 de 62 ms sin carga a 152 ms con la app saturada, y
  p99 de 74 ms a 175 ms. Sigue dentro de compuerta, pero el aumento es de más del doble. En el sandbox, la app
  saturada y la validación comparten 4 núcleos con MariaDB y k6, así que parte de esa subida puede ser CPU y no
  contención de pool. La corrida en un entorno con CPU propia es la que lo separa (§11, punto 1).
- La guarda de entorno rechaza `acceso.agrocom.com.bo`, cualquier host no declarado y la falta de `CARGA_ENTORNO`,
  tanto en k6 como en el preparador (verificado con `k6 inspect` y con `preparar-datos.mjs`).

**No confirmado** (no se llegó o no se midió):

- **El punto de quiebre de la API no se alcanzó en la rampa.** Llegó a 10 VU, sin umbral caído. La saturación con 60
  usuarios sí llevó a la app a 503, pero eso no es una rampa ni dice el número de usuarios de quiebre.
- **Qué pasó con la app saturada, sin medir su capacidad**: los 503 llegaron en masa, pero la corrida no separa cuáles
  son del pool y cuáles de la cola (ambos salen como `servicio.no_disponible`). La cifra de capacidad de la app no
  sale de aquí.
- **Compuertas sobre la API de producción**: no hay cifras de un entorno representativo (ver §12).
- **Los topes diarios y de pendientes** (§7): no se probaron.
- **La validación con cliente real** (§10.1): con la API sin parchear, responde 503. Estas cifras son de la API parcheada.

---

## 10. Hallazgos durante la preparación

### 10.1 BLOQUEANTE: la validación del QR responde 503 con cualquier cliente HTTP real

**Síntoma.** `POST /api/v1/dispositivos/validaciones` con un cuerpo válido responde **503** `servicio.no_disponible` en
≈50 ms, para cualquier cliente que mande el cuerpo por HTTP real (curl, la placa, k6). El log muestra
`PresupuestoAgotado` en `enTransaccion`. Los latidos (204) y la configuración (200) funcionan, porque no usan la señal.
Un cuerpo que no pasa el esquema responde 400 antes de cualquier consulta, así que ese 400 no dice nada sobre la señal.

**Causa.** Fastify 5.12.7 (`api/node_modules/fastify/lib/route.js`) crea un `AbortController` por petición con
`handlerTimeout` y registra `req.on('close', onAbort)`. En Node 22 el `IncomingMessage` emite `close` **justo después
de `end`** de un POST con cuerpo, es decir, antes de que corra el handler. Así `request.signal` ya está abortada cuando
la validación la lee (`api/src/modules/accesos/routes.ts`, `api/src/platform/db/transaccion.ts`). Reproducido con un
servidor mínimo de Node: `eventos: ["end","close"]` para un POST con cuerpo y sin respuesta todavía.

**Por qué las pruebas no lo ven.** Los tests de la API usan `app.inject()` (53 archivos) y ninguno levanta un servidor
que escuche en un puerto: el camino de red real no se prueba. No he verificado si `inject` dispara el mismo evento.

**Impacto.** Falla segura: la puerta no abre (correcto por ADR 0009), pero por el mismo camino HTTP las placas recibirían
503 en cada validación con esta versión de Node y de Fastify. Es el caso central del sistema. La imagen de producción usa `node:22-alpine`; lo
reproducido es con Node v22.22.0 (no verificado en la imagen de producción).

**Parche usado en el sandbox (fuera del repo, solo para medir).** Un hook `onRequest` en una copia de `api/src` que quita
el listener `close` llamado `onAbort`. Con ese parche la validación abre, y la repetición da `qr.usado`.

**Recomendación (no aplicada: es código de `api/`, fuera del alcance de W13).** Que la señal se aborte por el cierre de la **conexión
antes de responder** (p. ej. el `close` del socket o de la respuesta, no del `IncomingMessage`), o por el tiempo máximo.
Añadir una prueba de integración con un servidor que escuche de verdad, para que este caso quede cubierto.

### 10.2 `bin/desplegar` y `bin/reiniciar-local` insertan `usuarios.activo`

La migración `20261026100002_alter_usuarios_estado` elimina la columna `activo` de `usuarios` y la sustituye por `estado`.
Los dos scripts siguen insertando `activo`, así que el alta de `root` falla. `bin/desplegar` corre en cada `master`
(`deploy.yml`). Afecta a un primer despliegue o a una base recreada. **No se tocó** (fuera del alcance de W13: solo
se permitió `bin/carga`).

### 10.3 La ventana de repetición de 15 s todavía no existe (ADR 0032 §3, W7 pendiente)

Con esta base, presentar el mismo QR otra vez dentro de 15 s responde `qr.usado`, no `abrir: true`. Es lo que pide el
estado actual del plan (W7 pendiente). La prueba de repetición de `validacion-qr` espera `qr.usado` y usa QR preparados
con más de 15 s de antelación, para que siga siendo válida cuando W7 llegue. Cuando W7 esté, la expectativa no cambia
para esos QR.

### 10.4 `Idempotency-Key` (W6) no está en esta base

`CARGA_IDEMPOTENCIA=1` manda la cabecera, pero la API la ignora. Por eso la idempotencia de la generación **no** se
prueba aquí.

### 10.5 Los límites por IP se consumen desde una sola máquina

Todo lo que corre desde `127.0.0.1` comparte el límite de login de 20 por minuto. El preparador hace un login por
Titular y el escenario de límites necesita su propia ventana. Por eso `verificar-limites` va al final y las cargas de
login usan `CARGA_IP_SIMULADAS=1`.

---

## 11. Qué ajustar tras una corrida real (propuestas, no aplicadas)

No se cambian los límites ni los pools de producción con datos de un sandbox. Tras la primera corrida en un entorno de
prueba representativo:

1. **Si la línea base de (d) pasa y la validación con la app saturada falla**: el aislamiento no es total. Revisar
   `DB_CONSULTA_MS_DISPOSITIVOS`, la cola y la espera del pool de dispositivos antes de tocar el de la app. No subir el
   umbral. En el sandbox, con 60 usuarios, la validación no tuvo respuestas no válidas, pero su p95 subió de 62 a 152 ms:
   separar CPU de contención es lo primero que hay que hacer en un entorno con CPU propia.
2. **Si p99 de validación se acerca a 1,5 s** (la consulta máxima de la ruta): ver contención o deadlocks en
   `innodb_trx` antes de subir nada.
3. **Propuestas** (login, generación, confirmación, latido, app): fijarlas en p95 observado + margen, y aprobarlas como
   umbral con su ADR. Hoy no tienen respaldo.
4. **Cuota de lectura** (`LIMITE_LECTURA_POR_MINUTO`): si la rampa se corta con 429 antes que con 503, la cifra que se
   reporta es la cuota, no la capacidad. Repetir con la cuota del entorno de prueba más alta, dejándolo escrito.
5. **Rampa**: si el punto de quiebre cae en el primer escalón, revisar el dimensionamiento (QR, usuarios) antes de
   concluir algo sobre la API.

---

## 12. Qué no mide

- **La red real**: WiFi del lector, latencia entre la placa y el Mac o el CT 120, pérdidas. La compuerta de 1 s es del
  lado de la API.
- **NPMplus y Nginx**: `limit_req`, `limit_conn`, tope de cuerpo y timeouts de borde (ADR 0030 §3.1). No están en
  `docker-compose`. Sus reglas se documentan en `docs/gestion/despliegue.md` y se verifican en producción, no aquí.
- **El firmware**: lectura del QR, antirrebote, reintentos, tiempos de espera de la placa, sensor de puerta y el
  disparo de la cerradura. Esta prueba solo emula lo que la placa envía y cómo interpreta la respuesta.
- **Multi-instancia**: una sola API (V1). El contador de límites vive en memoria.
- **La MariaDB compartida de producción** (ADR 0034) y su carga de otros clientes.
- **Días y meses**: el tope diario se reinicia a medianoche de La Paz, y la bolsa mensual, al mes. Un soak de 10
  minutos no lo prueba.
- **Idempotencia** (W6), **ventana de repetición** (W7) y **señales de abuso** (ADR 0030 §4): no están implementadas o
  no tienen escenario.
- **La latencia de las cifras de §9**: son de un sandbox con `tsx`, no de la imagen de producción.

---

## 13. Procedimiento para la corrida real

1. Confirma que la validación responde 200 con un cliente HTTP real (§10.1): si no, la corrida no sirve.
2. Confirma que el commit y el target de la API son los de producción (`produccion`), con los límites por defecto.
3. Crea el proyecto `qr-access-carga` (§4.2) y el super admin de prueba (§4.3).
4. Anota en la tabla de §8 la máquina, el commit y la versión de k6.
5. Prepara datos, corre (a) y su línea base, (d), (e), (b), (c), (f1), (f2) y `verificar-limites` en ese orden.
6. Revisa los umbrales que no se cumplen en la consola y en el CSV antes de sacar conclusiones.
7. Guarda los resúmenes y completa la tabla. Las propuestas de §11 se discuten con el equipo.
