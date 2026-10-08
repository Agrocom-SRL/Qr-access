# CLAUDE.md — invariantes de AGROCOM Acceso

Este repo es **AGROCOM Acceso** (`acceso.agrocom.com.bo`): plataforma multitenant de control de acceso a puertas eléctricas con lectura de QR. Es un **monorepo** con tres partes (ADR 0001):

| Carpeta | Qué es | Stack |
|---|---|---|
| `api/` | Backend REST | Node.js 22 LTS + TypeScript + Fastify, **SQL a mano con `mysql2`, sin ORM** (ADR 0002) |
| `app/` | App de usuarios, administradores y guardias | Flutter (Android, iOS y web) |
| `firmware/` | Controlador de la puerta | ESP32 con framework Arduino, compilado con PlatformIO |
| `db/` | Esquema MySQL 8 | Migraciones `.sql` con dbmate (ADR 0011) |

El desarrollo lo hace un equipo chico con agentes de IA como implementadores principales; estas invariantes existen para que la coherencia no dependa de la memoria de nadie. El kit de procesos (gitflow, CI/CD, agentes, skills, hooks, ADRs) viene del proyecto ACRECIA, adaptado.

Fuentes de verdad:
- **Funcional:** `docs/funcional/documento-funcional.md` (RF-xx y HU).
- **Modelo de datos:** `docs/modelo-datos/` (`03-schema-sql.md` y las fichas de `tablas/`); las dudas abiertas, en `02-dudas-y-ambiguedades.md`.
- **Decisiones técnicas:** `docs/decisiones/` (ADRs). Léelos antes de implementar algo que los toque.
- **Hardware:** `docs/hardware/README.md`.
- **Estado del proyecto:** `docs/gestion/estado_proyecto.md`.

## Invariantes no negociables

1. **Ninguna cuenta ve datos de otra.** El tenant es la **cuenta** (empresa cliente), con su propio administrador, usuarios, roles, sitios, puertas y dispositivos; AGROCOM es la plataforma (`tenant_id NULL`, super admin). Toda tabla con datos de una cuenta lleva `tenant_id` y se consulta **solo** a través del repositorio base de cuenta (`api/src/platform/db/`), que filtra por la cuenta del contexto (`ContextoCuenta`, AsyncLocalStorage) por construcción, nunca con un `WHERE tenant_id` escrito a mano en un módulo. Sin contexto, la consulta falla (falla cerrado). Saltar el aislamiento es explícito y se revisa línea por línea. Cada endpoint sobre datos de una cuenta lleva su test de aislamiento (cuenta A pidiendo un recurso de B → 404) (ADR 0004).
2. **La puerta nunca abre sin una validación positiva del servidor.** Sin red, sin respuesta o con una respuesta inválida, el firmware **no abre** (falla segura). Las únicas aperturas sin validación son las físicas: pulsador de salida y llave mecánica (ADR 0009).
3. **Un QR sirve una sola vez y vence.** Todo QR es un token firmado con vencimiento corto; el servidor rechaza un token ya usado (anti-reuso) o vencido. Nunca se codifica en un QR un dato que permita abrir sin pasar por el servidor (ADR 0008).
4. **Todo intento de acceso queda registrado**, aceptado o rechazado, con su motivo, en `eventos_acceso`: tabla de solo inserción, que no se edita ni se borra (ADR 0007).
5. **Un dispositivo se autentica con su propia credencial**, nunca con la de un usuario. La credencial se guarda hasheada en la base, se puede revocar y cada dispositivo pertenece a una sola cuenta y a una sola puerta (ADR 0004 §6, ADR 0009).
6. **Secretos fuera del código.** Ningún secreto en el repo, en el firmware compilado que se publique, en un log ni en una respuesta de la API. Los secretos de QR se guardan cifrados; las contraseñas y las claves de dispositivo, hasheadas.
7. **Las fechas se guardan en UTC** (`DATETIME(3)`), y los horarios de acceso se evalúan en la zona horaria del sitio (`sitios.zona_horaria`, por defecto `America/La_Paz`).
8. **Soft delete por defecto y autoría en toda tabla de dominio.** `deleted_at`, `created_by`, `updated_by`, `deleted_by`. Ningún `DELETE` físico salvo excepción justificada en el PR (ADR 0007).
9. **Bitácora de cambios en toda mutación relevante:** quién, cuándo, qué entidad, qué acción, valores antes/después y origen. La registra el repositorio base en la misma transacción, no cada caso de uso (ADR 0007).
10. **Un usuario, un login (cuenta + usuario + contraseña), múltiples roles, un rol activo por sesión.** Los permisos efectivos son los del rol activo, nunca la unión; se definen por acción y tienen ámbito: un rol de cuenta nunca recibe un permiso de plataforma (ADR 0004).
11. **La API tiene un contrato y se respeta:** OpenAPI generado desde los esquemas, versión en la ruta (`/api/v1`), errores con un formato único (RFC 9457) y ningún cambio incompatible dentro de una misma versión (ADR 0005).
12. **Nada visible hardcodeado en la app:** ningún color, tamaño ni duración fuera de los tokens del tema (ADR 0012) y ningún texto de interfaz fuera de los ARB (`app/lib/l10n/app_es.arb`) (ADR 0013). La API responde códigos de error, no frases: la app los traduce.

## Convenciones

- **Monorepo, un solo gitflow y una sola CI** (ADR 0001). Cada parte tiene su propia cascada en `bin/verify` y su propio job en CI.
- **Backend modular por funcionalidad** (ADR 0003): `api/src/modules/<modulo>/` en español (`seguridad`, `organizacion`, `accesos`, `dispositivos`); lo transversal en inglés (`api/src/platform/`, `api/src/plugins/`). Entre módulos, **solo** `contracts.ts` y `events.ts` del otro módulo; nunca su repositorio, sus acciones ni su SQL. Lo verifica `dependency-cruiser`.
- **Toda escritura de negocio pasa por una acción** (`actions/<verbo-objeto>.ts`, una función exportada `ejecutar`). Las rutas solo validan, autorizan e invocan.
- **SQL a mano, siempre parametrizado** (`?` de `mysql2`); jamás concatenar un valor del usuario en un SQL (ADR 0002).
- **App Flutter por funcionalidad** (ADR 0012): `app/lib/features/<modulo>/{data,domain,presentation}`, sistema de diseño en `app/lib/core/theme/` y componentes compartidos en `app/lib/shared/widgets/{atoms,molecules,organisms}`.
- **Firmware por responsabilidad** (ADR 0009): `firmware/src/{red,lector_qr,cerradura,api,config}`; nada de lógica de negocio en el firmware: lee, pregunta y obedece.
- **Dominio en español, infraestructura en inglés**: `Puerta`, `eventos_acceso`, `validarQr`, pero `routes.ts`, `repository.ts`, `plugin`, `middleware`.
- **Tablas en español, en plural y sin prefijo** (`puertas`, `reglas_acceso`); **una migración por tabla** al crearla (ADR 0011).
- **Commits en español, imperativo**, sin trailer `Co-Authored-By` ni ninguna otra atribución, tampoco en los PR. Con la cascada en verde, un commit por grupo de archivos con el mismo propósito.
- **Branching**: GitFlow simplificado (ADR 0006) con release por tag (ADR 0014); ver `CONTRIBUTING.md`.
- **Tuteo estándar**, nunca voseo ni "usted", en todo texto visible al usuario (skill `redaccion-neutra`).

## Testing

- `bin/verify` es la compuerta: ejecuta lo que exista de cada parte (`api`: ESLint + Prettier + `tsc --noEmit` + dependency-cruiser + Vitest; `app`: `dart format` + `flutter analyze` + `flutter test` + `flutter build web`; `firmware`: `pio run` + `pio test -e native`). Un cambio está terminado cuando pasa entero.
- Los tests de la API corren contra **MySQL 8** real, base `qr_access_testing` del contenedor `db`; **nunca** SQLite ni la base de desarrollo.
- Prioridad de cobertura: aislamiento entre cuentas (1), falla segura de la puerta (2), un solo uso y vencimiento del QR (3), registro de todo intento (4), autenticación de dispositivos (5).
- Una migración nueva se verifica además contra un MySQL descartable (migrar, sembrar dos veces, revertir; skill `modelo-datos`). Nunca `dbmate drop`, `DROP DATABASE`, `docker compose down -v` ni `docker volume rm` sobre la base de desarrollo.

## Qué no delegar sin revisión línea por línea

El aislamiento por cuenta, la validación de QR y su anti-reuso, la autenticación de dispositivos, el firmware que acciona la cerradura y el modelo de permisos. El resto (CRUDs, pantallas no críticas, catálogos) se revisa por diff en el PR.
