# Pruebas de carga (k6)

Escenarios de carga de AGROCOM Acceso (ADR 0030 §3, ADR 0032). Cómo montar el entorno, qué mide cada escenario
y cómo leer los resultados están en [`docs/gestion/pruebas-de-carga.md`](../docs/gestion/pruebas-de-carga.md).
Este README es la referencia rápida de la carpeta.

**Solo contra un entorno de prueba.** Cada corrida exige `CARGA_ENTORNO=prueba` y un host local o declarado en
`CARGA_HOSTS_DE_PRUEBA`. Cualquier dominio `agrocom.com.bo` se rechaza, incluido `acceso.agrocom.com.bo`.

## Contenido

| Ruta | Qué es |
|---|---|
| `preparar-datos.mjs` | Crea por la API la cuenta, las puertas, las placas vinculadas, los Titulares y los QR pregenerados. Escribe `datos/generados/*.json` (ignorado por git). |
| `escenarios/*.js` | Un archivo por escenario k6 (ver tabla abajo). |
| `lib/*.js`, `lib/*.mjs` | Cliente HTTP, sesiones, validación de placa, métricas, umbrales, resumen. `guarda.mjs` lo usan también Node y k6. |
| `datos/ejemplo-prueba.json` | Formato del archivo de datos, con valores **falsos**. Solo para leerlo. |
| `resultados/` | Resúmenes JSON y CSV de cada corrida (ignorado por git). |

| Escenario | Qué mide | Compuertas |
|---|---|---|
| `validacion-qr` (a) | Ráfagas de primer uso y repetición de QR usados | p95 < 1 s, p99 < 2 s, 0 respuestas no válidas, 0 aperturas inesperadas |
| `saturacion-usuarios` (d) | La validación mientras la API de usuarios está saturada (aislamiento de pools) | Las mismas que (a); la app solo se informa |
| `generacion-qr` (b) | Generación de QR por usuarios; `CARGA_GENERACION_SIN_PAUSA=1` prueba los 429 | Propuesta: p95 < 1 s (sin ADR) |
| `login-sesiones` (c) | Login, sesión actual y refresco | Propuesta: p95 de login < 1,5 s; checks > 99 % con `CARGA_IP_SIMULADAS=1` |
| `latidos-confirmaciones` (e) | Latidos de flota y confirmaciones de apertura | Las de validación; propuestas para latido y confirmación |
| `rampa-stress` (f1) | Escalones de usuarios hasta el punto de quiebre, con una sonda de validación | Por escalón; el primero que cae se informa |
| `soak` (f2) | Ciclo completo (generar, validar, confirmar) sostenido, con tres tramos | Las de validación por tramo |
| `verificar-limites` | Los límites del ADR 0030 (login por IP, ráfaga de QR): 429 `limite.excedido` con Retry-After | `checks` = 100 % |

## Uso rápido

```bash
# 1. Preparar datos (una vez por corrida de validación: cada QR se usa una sola vez).
CARGA_ENTORNO=prueba CARGA_URL=http://127.0.0.1:3000 CARGA_ROOT_CLAVE='<clave de root del entorno>' \
  node carga/preparar-datos.mjs --puertas 5 --usuarios 12 --qr 300 --qr-confirmacion 30 --qr-repeticion 5

# 2. Correr un escenario desde la raíz del repo. k6 necesita las variables con -e (no como prefijo del shell).
k6 run -e CARGA_ENTORNO=prueba -e CARGA_URL=http://127.0.0.1:3000 \
  -e CARGA_DATOS="$PWD/carga/datos/generados/prueba.json" -e CARGA_ETAPAS=10:30,50:10,10:30 \
  carga/escenarios/validacion-qr.js
```

Con `bin/carga` el paso 2 se simplifica: `bin/carga validacion-qr` (ver `bin/carga lista`).

## Variables

Todas son opcionales salvo las marcadas. Las de k6 se pasan con `-e` o con `bin/carga`: **k6 no lee el entorno
del proceso** en esta versión (probado con v1.3.0).

| Variable | Dónde | Para qué |
|---|---|---|
| `CARGA_ENTORNO` | todas (**obligatoria**) | Debe valer `prueba`. |
| `CARGA_URL` | todas (**obligatoria**) | Origen de la API, sin `/api/v1` (p. ej. `http://127.0.0.1:3000`). |
| `CARGA_HOSTS_DE_PRUEBA` | todas | Hosts no locales permitidos, separados por comas. Nunca un dominio de AGROCOM. |
| `CARGA_DATOS` | escenarios (**obligatoria**) | Ruta **absoluta** al JSON de `preparar-datos.mjs`. |
| `CARGA_ETAPAS` | validación | `tasa:segundos,…`. Una etapa es carga constante; varias, ráfagas. |
| `CARGA_REPETICIONES` | validación | QR de repetición a presentar (por omisión 5). |
| `CARGA_IP_SIMULADAS` | login, saturación, rampa, soak | `1` reparte una IP sintética por VU (`X-Forwarded-For`). **Solo sin proxy delante** y con `TRUST_PROXY=1`: ver la nota de seguridad abajo. |
| `CARGA_IDEMPOTENCIA` | generación, soak | `1` manda `Idempotency-Key`. W6 la introduce; en esta base la API la ignora. |
| `CARGA_GENERACION_SIN_PAUSA` | generación | `1` quita la pausa de 6 s entre QR: se espera 429. |
| `CARGA_PAUSA_GENERACION_S` | generación | Pausa entre QR de un mismo usuario (por omisión 6). |
| `CARGA_VUS_LOGIN`, `CARGA_VUS_APP` | login, saturación | VU concurrentes (por omisión 10 y 20). |
| `CARGA_DURACION_S` | varios | Duración de la fase de carga de fondo, en segundos. |
| `CARGA_ESCALONES`, `CARGA_ESCALON_S`, `CARGA_PAUSA_ESCALON_S`, `CARGA_SONDA_TASA` | rampa | Escalones de VU, duración de cada uno, pausa y tasa de la sonda. |
| `CARGA_SOAK_S`, `CARGA_SOAK_TASA` | soak | Duración en segundos y tasa de ciclos por segundo. |
| `CARGA_TASA_CONFIRMACION`, `CARGA_LATIDO_S` | latidos y confirmaciones | Tasa de confirmaciones por segundo y periodo de latido. |
| `CARGA_SALIDA` | todas | Carpeta de resúmenes (por omisión `carga/resultados`). |
| `CARGA_ROOT_CLAVE` | `preparar-datos.mjs` (**obligatoria**) | Contraseña del super admin del entorno de prueba. Nunca va a k6 ni a git. |
| `CARGA_ROOT_USUARIO` | `preparar-datos.mjs` | Usuario del super admin (por omisión `root`). |
| `CARGA_PLAN_ID`, `CARGA_CODIGO` | `preparar-datos.mjs` | Plan de la cuenta de prueba y código de 3 letras (si no, se sortea). |

Los límites de la API en el entorno de prueba se leen de `LIMITE_*` del `.env` del servidor (`verificar-limites` los
toma como referencia, con `LIMITE_LOGIN_POR_MINUTO` y `LIMITE_GENERAR_QR_POR_MINUTO`).

## Notas de seguridad

- Los datos generados contienen claves de placas, PIN y tokens de QR **de prueba**. Viven en `datos/generados/`,
  con permisos 0600 y fuera de git. No los copies a un canal compartido.
- `CARGA_IP_SIMULADAS=1` confía en `X-Forwarded-For` porque el entorno de prueba no tiene proxy. En un despliegue
  con NPMplus o Nginx delante, la cabecera la sobrescribe el proxy y el truco no hace nada útil; en producción,
  además, nunca se corre esta carga.
- Ningún escenario lee ni escribe la base de datos: todo entra por la API.

## Verificar la sintaxis sin tocar la red

```bash
k6 inspect -e CARGA_ENTORNO=prueba -e CARGA_URL=http://127.0.0.1:3000 -e CARGA_DATOS=/ruta/absoluta.json \
  carga/escenarios/validacion-qr.js
node --check carga/preparar-datos.mjs
```
