# 25 — `configuracion_limites`

**Módulo dueño:** `limites` · **Tenant:** no (plataforma) · **Migración:** `db/migrations/20261027100001_create_configuracion_limites.sql`

## Propósito

Los topes de generación de QR que AGROCOM edita desde el panel (ADR 0030 §7): una fila por clave, con su valor entero. Valen para todas las cuentas salvo que una cuenta o un usuario tenga una excepción en `excepciones_de_limite`. Nada de esto está fijo en el código: el catálogo de claves y sus extremos sí (`api/src/modules/limites/domain/claves.ts`), los valores no.

## Columnas

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | no | PK |
| `clave` | `VARCHAR(60)` | no | Una del catálogo (tabla de abajo) |
| `valor` | `INT UNSIGNED` | no | Cantidad, segundos o porcentaje según la clave |
| autoría y soft delete | | | `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by` |
| `vigente` | `TINYINT` generada | sí | `1` si no está borrada (ADR 0016) |

## Claves y valores iniciales

Los siembran la migración y `db/seeds/01_catalogo.sql` (idempotente: no pisa un valor ya editado).

| Clave | Inicial | Fuente del valor | Excepción |
|---|---|---|---|
| `qr.tope_diario` | 100 | **Supuesto** (el ADR no lo fija); holgado sobre el umbral de «ruidoso» (20) | cuenta o usuario |
| `qr.tope_pendientes` | 50 | **Supuesto** | cuenta o usuario |
| `qr.reemplazos_sin_uso_por_dia` | 5 | ADR 0030 §2.1.5 | cuenta o usuario |
| `qr.espera_reemplazo_segundos` | 120 | ADR 0030 §2.1.5 | cuenta o usuario |
| `qr.max_puertas_por_qr` | 10 | ADR 0031 §9 («por ejemplo, 10») | cuenta o usuario; también lo puede fijar el plan |
| `qr.bolsa_mensual` | 5000 | **Supuesto** (el ADR solo dice «número fijo por plan al inicio») | solo cuenta; también lo puede fijar el plan |
| `qr.bolsa_aviso_porcentaje` | 80 | ADR 0030 §5 | ninguna |
| `placa.caida_minutos` | 15 | ADR 0031 §18 | ninguna (global) |
| `placa.desaparecida_minutos` | 120 | ADR 0031 §18 | ninguna (global) |
| `placa.recuperacion_minutos` | 3 | **Supuesto W9** (histéresis: racha de latidos para dar la placa por recuperada) | ninguna (global) |
| `placa.lector_minutos` | 5 | **Supuesto W9** (lector sin respuesta; «unos minutos», no 24 h) | ninguna (global) |
| `placa.observacion_horas` | 24 | **Supuesto W9** (en observación: sin lecturas en la puerta) | ninguna (global) |
| `apertura.plazo_confirmacion_segundos` | 90 | **Supuesto W10** (cuánto se espera el informe de la placa antes de dejar `sin_respuesta`) | ninguna (global) |
| `apertura.fallidas_minimo` | 2 | **Supuesto W10** (el ADR dice «repetirse»; con 1 avisaría de cada falla) | ninguna (global) |
| `apertura.fallidas_ventana_minutos` | 60 | **Supuesto W10** | ninguna (global) |
| `incidente.reincidencia_minimo` | 3 | ADR 0033 §4.3 («por ejemplo, 3 en 30 días»); valor **supuesto W11** | solo cuenta |
| `incidente.reincidencia_ventana_dias` | 30 | ADR 0033 §4.3; **supuesto W11** | solo cuenta |
| `incidente.restriccion_automatica` | 0 | ADR 0033 §4.4 (apagada por omisión); 0 = apagada, 1 = encendida | solo cuenta (la enciende AGROCOM con una excepción de valor 1) |
| `incidente.rechazos_generacion_minimo` | 5 | **Supuesto W11** (rechazos por tope de generación que abren un incidente `generacion_ruidosa`) | ninguna (global) |
| `incidente.rechazos_generacion_ventana_horas` | 24 | **Supuesto W11** | ninguna (global) |

Las claves `incidente.*` son la política de incidentes de uso (ola W11, ADR 0033 §4): la reincidencia cuenta los incidentes CONFIRMADOS de un usuario cuyo `ocurrido_at` cae dentro de la ventana móvil (límite inclusivo). Si faltan, rigen los valores de partida (3 en 30 días, restricción automática apagada: no fallan cerrado ni restringen solas). Los extremos son 1 a 100 (mínimo), 1 a 365 (ventana en días), 0 a 1 (automática), 1 a 10000 y 1 a 720 (detección).

Las claves `apertura.*` son los umbrales del detector de aperturas fallidas (ola W10) y se tratan igual. Las claves `placa.*` son umbrales del detector de estados de placa (ola W9); no son topes de generación de QR y la generación no las lee. Se editan por la misma ruta. Si faltan, el detector usa los valores de partida (no falla cerrado: un aviso de más o de menos no abre ninguna puerta).

## Reglas

- Precedencia de cada valor: excepción del usuario, excepción de la cuenta, lo que fija el plan (solo bolsa y puertas por QR), el valor de esta tabla.
- Cada cambio entra a la bitácora con el antes y el después (`PUT /api/v1/plataforma/limites/{clave}`, permiso `limites.configuracion.editar`).
- Sin la fila de una clave, la generación falla cerrado (500): no se genera sin topes.
