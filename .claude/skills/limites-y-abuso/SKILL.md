---
name: limites-y-abuso
description: Límites de uso, rate limit, detección de abuso, señales de estadísticas, sesiones por instalación y notificaciones de AGROCOM Acceso (ADR 0030) en API, base, app y panel. Usar antes de agregar un tope, un rate limit, una señal de uso sospechoso, un aviso al propietario o a AGROCOM, o una pantalla de dispositivos conectados.
---

# Límites de uso y detección de abuso

Fuente: ADR 0030 (aceptado; §6 notificaciones es propuesta) y ADR 0031 §E. Complementa el skill `generacion-qr-segura`.

## Principios

1. **Informar y avisar antes que cortar.** Los topes de generación responden 429 y no bloquean al usuario; la bolsa mensual por plan no corta por ahora; las señales de estadísticas son informativas y decide una persona.
2. **Validar un QR nunca se limita.** La protección del endpoint de dispositivos es anti-flood por credencial, con umbral muy por encima del uso real, y jamás impide abrir con un QR válido.
3. **El límite lo hace cumplir la API**, no la app (ADR 0017).
4. **Varias sesiones o dispositivos nunca se bloquean** (ADR 0030 §4.1); se vigila la combinación de señales.

## Dónde va cada cosa

| Pieza | Capa | Nota |
|---|---|---|
| `limit_req` / `limit_conn`, tope de cuerpo, timeouts | Borde (NPMplus), `distribucion` | Documentar en `docs/gestion/despliegue.md` |
| `@fastify/rate-limit` por IP, usuario o dispositivo | `api/src/plugins/` | 429 + `Retry-After`; login y placas estrictos, validación de dispositivo holgada |
| Topes diario, pendientes, reemplazos sin uso | Acción `generar-qr` | Códigos `qr.limite_diario`, `qr.limite_pendientes`, `qr.limite_propios_sin_uso` |
| Bolsa mensual por plan | Columna en `planes` + conteo | Superarla registra y avisa; no corta |
| Configuración de topes | Tabla de plataforma, editable por AGROCOM | Valores por defecto, excepción por usuario o cuenta, bitácora de cada cambio |
| Señales (fantasma, ruidoso = 20 QR no usados/día, uso masivo, uso imposible, ciclo generar-usar, flujo atípico, altas en ráfaga, tasa de uso) | `domain/actividad-de-usuarios.ts` y vecinos | Umbrales como constantes hasta tener datos; la API calcula, las apps no |
| `instalacion_id`, `plataforma` en `sesiones`; sesión de origen en `qr_accesos` | Migración + login | El identificador lo genera la app y no lleva secretos |
| Bandeja `notificaciones` (con `tenant_id` y destinatario) | Módulo propio | Un aviso por evento y día; push con FCM es un paso posterior |
| Rechazos de generación por límite | Bitácora o tabla de solo inserción | No van a `lecturas` (no son intentos de acceso) |

## Concurrencia y prioridad (ADR 0032, propuesta)

Validar es petición-respuesta síncrona para la placa y asíncrona en Node; sin broker. La prioridad de las puertas viene de **pools de MySQL separados** (dispositivos reservados, app y panel aparte), `queueLimit`, tiempos escalonados (consulta < petición < 3 s del firmware) y `503` con `Retry-After` ante saturación. Lo diferible (notificaciones, cierre del día, estadísticas, placa fuera de línea) va por *outbox* en la misma transacción. Estados de placa (ADR 0031 §18): en línea (≤180 s), sin conexión (sin aviso), **caída sostenida** (15 min: aviso a AGROCOM y propietario), **desaparecida** (2 h: «revisar físicamente»; avisos agrupados por sitio y uno al recuperarse), en observación (en línea sin lecturas en 24 h; informativa) y lector sin respuesta (aviso en minutos).

## Quién ve qué

El propietario (Administrador) ve su cuenta, con aislamiento por cuenta; AGROCOM ve todas desde el panel y ahí sube un tope o amplía la bolsa (queda en bitácora). Se avisa a ambos al superar el tope diario, cruzar 80 % y 100 % de la bolsa, o disparar una señal de gravedad media o alta.

## Tests mínimos

Tope diario → 429 con `code` y sin bloqueo al día siguiente; pendientes → rechazo; la validación no sufre ningún límite de generación; rate limit devuelve `Retry-After`; un usuario no ve ni cuenta lo de otra cuenta; el aviso sale una sola vez por evento y día; lista de dispositivos de una cuenta no muestra sesiones de otra.

## Qué no hacer

Bloquear automáticamente por una señal; limitar la validación en el lector; contar con `WHERE tenant_id` a mano; poner frases en la API; dejar topes fijos en el código cuando ya existe la configuración de plataforma.
